package com.fnts.plan;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.Periods;
import com.fnts.common.ApiException;
import com.fnts.habit.Habit;
import com.fnts.habit.HabitService;
import com.fnts.plan.PlanDtos.PlanDayResponse;
import com.fnts.plan.PlanDtos.PresetLineRequest;
import com.fnts.plan.PlanDtos.PresetLineResponse;
import com.fnts.plan.PlanDtos.PresetRequest;
import com.fnts.plan.PlanDtos.PresetResponse;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

/**
 * Presets: named day templates. Most days are one of a handful of kinds — a
 * workday, a gym day, a Sunday — so a day starts from the right one instead
 * of from nothing, or from whichever past day happened to look closest.
 * Like the plan itself, nothing here touches points, gauges or streaks.
 */
@Service
public class PlanPresetService {

    private final PlanPresetRepository presetRepository;
    private final PlanBlockRepository blockRepository;
    private final UserRepository userRepository;
    private final HabitService habitService;
    private final PlanService planService;

    public PlanPresetService(PlanPresetRepository presetRepository,
                             PlanBlockRepository blockRepository,
                             UserRepository userRepository,
                             HabitService habitService,
                             PlanService planService) {
        this.presetRepository = presetRepository;
        this.blockRepository = blockRepository;
        this.userRepository = userRepository;
        this.habitService = habitService;
        this.planService = planService;
    }

    @Transactional(readOnly = true)
    public List<PresetResponse> list(Long userId) {
        User user = load(userId);
        return presetRepository.findByUserIdOrderByIdAsc(userId).stream()
                .map(preset -> toResponse(preset, user))
                .toList();
    }

    @Transactional
    public PresetResponse create(Long userId, PresetRequest request) {
        User user = load(userId);
        checkRoom(userId);
        PlanPreset preset = new PlanPreset();
        preset.setUser(user);
        preset.setName(request.name().trim());
        setLines(preset, request.lines(), userId);
        return toResponse(presetRepository.save(preset), user);
    }

    /**
     * A day that went well is the best template there is, so it can be kept
     * as one as it stands. Ticks are dropped — a preset is a plan, not a
     * record — and so are task links: a task is done once, not every week.
     */
    @Transactional
    public PresetResponse createFromDay(Long userId, String name, LocalDate date) {
        User user = load(userId);
        checkRoom(userId);
        List<PlanBlock> blocks =
                blockRepository.findByUserIdAndPlanDateOrderByEndMinuteAscIdAsc(userId, date);
        if (blocks.isEmpty()) {
            throw ApiException.badRequest("That day has nothing to save");
        }
        PlanPreset preset = new PlanPreset();
        preset.setUser(user);
        preset.setName(name.trim());
        for (PlanBlock block : blocks) {
            PlanPresetLine line = new PlanPresetLine();
            line.setPreset(preset);
            line.setEndMinute(block.getEndMinute());
            line.setTitle(block.getTitle());
            line.setHabit(block.getHabit());
            preset.getLines().add(line);
        }
        return toResponse(presetRepository.save(preset), user);
    }

    /** Renames a preset and replaces its lines with the ones sent. */
    @Transactional
    public PresetResponse update(Long userId, Long presetId, PresetRequest request) {
        User user = load(userId);
        PlanPreset preset = getOwned(userId, presetId);
        preset.setName(request.name().trim());
        setLines(preset, request.lines(), userId);
        return toResponse(preset, user);
    }

    @Transactional
    public void delete(Long userId, Long presetId) {
        presetRepository.delete(getOwned(userId, presetId));
    }

    /**
     * Lays a preset out on a day. Only ever onto an empty day, like a copy:
     * pouring a template over a plan the user already wrote would bury it.
     */
    @Transactional
    public PlanDayResponse apply(Long userId, LocalDate date, Long presetId) {
        User user = load(userId);
        LocalDate target = date != null ? date : Periods.logicalToday(user);
        PlanPreset preset = getOwned(userId, presetId);
        if (blockRepository.countByUserIdAndPlanDate(userId, target) > 0) {
            throw ApiException.badRequest("This day already has a plan");
        }
        for (PlanPresetLine line : preset.getLines()) {
            PlanBlock block = new PlanBlock();
            block.setUser(user);
            block.setPlanDate(target);
            block.setEndMinute(line.getEndMinute());
            block.setTitle(line.getTitle());
            block.setHabit(line.getHabit());
            block.setDone(false);
            blockRepository.save(block);
        }
        return planService.getDay(userId, target);
    }

    private void setLines(PlanPreset preset, List<PresetLineRequest> lines, Long userId) {
        preset.getLines().clear();
        for (PresetLineRequest request : lines) {
            PlanPresetLine line = new PlanPresetLine();
            line.setPreset(preset);
            line.setEndMinute(request.endMinute());
            line.setTitle(request.title().trim());
            Habit habit = request.habitId() == null
                    ? null
                    : habitService.getOwned(userId, request.habitId());
            line.setHabit(habit);
            preset.getLines().add(line);
        }
    }

    private void checkRoom(Long userId) {
        if (presetRepository.countByUserId(userId) >= PlanDtos.MAX_PRESETS) {
            throw ApiException.badRequest(
                    "You can keep at most " + PlanDtos.MAX_PRESETS + " presets");
        }
    }

    /** Lines come back in the order the user lives them, like a day's plan. */
    private static PresetResponse toResponse(PlanPreset preset, User user) {
        List<PresetLineResponse> lines = preset.getLines().stream()
                .sorted(Comparator.comparingInt((PlanPresetLine line) ->
                        Periods.minuteOfUserDay(line.getEndMinute(), user.getDayEndHour())))
                .map(line -> new PresetLineResponse(
                        line.getEndMinute(),
                        line.getTitle(),
                        line.getHabit() == null ? null : line.getHabit().getId(),
                        line.getHabit() == null ? null : line.getHabit().getName()))
                .toList();
        return new PresetResponse(preset.getId(), preset.getName(), lines);
    }

    private PlanPreset getOwned(Long userId, Long presetId) {
        return presetRepository.findByIdAndUserId(presetId, userId)
                .orElseThrow(() -> ApiException.notFound("Preset not found"));
    }

    private User load(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
