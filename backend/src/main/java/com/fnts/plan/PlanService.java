package com.fnts.plan;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.Periods;
import com.fnts.common.ApiException;
import com.fnts.habit.Habit;
import com.fnts.habit.HabitService;
import com.fnts.plan.PlanDtos.BlockRequest;
import com.fnts.plan.PlanDtos.BlockResponse;
import com.fnts.plan.PlanDtos.PlanDayResponse;
import com.fnts.plan.PlanDtos.ShiftRequest;
import com.fnts.plan.PlanDtos.ShiftResult;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

/**
 * The daily plan: a list of "this is finished by then" lines for one date.
 * Each block runs from the end of the block before it, so the first line of a
 * day has no known start. It holds no game rules — nothing here touches
 * points, gauges or streaks.
 */
@Service
public class PlanService {

    private final PlanBlockRepository blockRepository;
    private final UserRepository userRepository;
    private final HabitService habitService;

    public PlanService(PlanBlockRepository blockRepository,
                       UserRepository userRepository,
                       HabitService habitService) {
        this.blockRepository = blockRepository;
        this.userRepository = userRepository;
        this.habitService = habitService;
    }

    @Transactional(readOnly = true)
    public PlanDayResponse getDay(Long userId, LocalDate date) {
        User user = load(userId);
        LocalDate day = date != null ? date : Periods.logicalToday(user);
        return day(user, day);
    }

    @Transactional
    public BlockResponse addBlock(Long userId, LocalDate date, BlockRequest request) {
        User user = load(userId);
        LocalDate day = date != null ? date : Periods.logicalToday(user);
        if (blockRepository.countByUserIdAndPlanDate(userId, day)
                >= PlanDtos.MAX_BLOCKS_PER_DAY) {
            throw ApiException.badRequest(
                    "A day can hold at most " + PlanDtos.MAX_BLOCKS_PER_DAY + " blocks");
        }

        PlanBlock block = new PlanBlock();
        block.setUser(user);
        block.setPlanDate(day);
        apply(block, request, userId);
        return PlanDtos.toResponse(blockRepository.save(block));
    }

    @Transactional
    public BlockResponse updateBlock(Long userId, Long blockId, BlockRequest request) {
        PlanBlock block = getOwned(userId, blockId);
        apply(block, request, userId);
        return PlanDtos.toResponse(block);
    }

    @Transactional
    public BlockResponse setDone(Long userId, Long blockId, boolean done) {
        PlanBlock block = getOwned(userId, blockId);
        block.setDone(done);
        return PlanDtos.toResponse(block);
    }

    @Transactional
    public void deleteBlock(Long userId, Long blockId) {
        blockRepository.delete(getOwned(userId, blockId));
    }

    /**
     * Yesterday's routine is usually today's too, so a day can be seeded from
     * another one instead of retyped. Only ever onto an empty day — copying
     * over a plan the user already wrote would destroy work.
     */
    @Transactional
    public PlanDayResponse copyDay(Long userId, LocalDate date, LocalDate from) {
        User user = load(userId);
        LocalDate target = date != null ? date : Periods.logicalToday(user);
        if (target.equals(from)) {
            throw ApiException.badRequest("That is the same day");
        }
        if (blockRepository.countByUserIdAndPlanDate(userId, target) > 0) {
            throw ApiException.badRequest("This day already has a plan");
        }

        List<PlanBlock> source =
                blockRepository.findByUserIdAndPlanDateOrderByEndMinuteAscIdAsc(userId, from);
        if (source.isEmpty()) {
            throw ApiException.badRequest("That day has nothing to copy");
        }

        for (PlanBlock original : source) {
            PlanBlock copy = new PlanBlock();
            copy.setUser(user);
            copy.setPlanDate(target);
            copy.setEndMinute(original.getEndMinute());
            copy.setTitle(original.getTitle());
            copy.setHabit(original.getHabit());
            // A copied plan is a plan for the day ahead: nothing is done yet.
            copy.setDone(false);
            blockRepository.save(copy);
        }
        return day(user, target);
    }

    /**
     * Waking up half an hour late does not change WHAT the day holds, only
     * WHEN — so a handful of lines can be slid earlier or later together,
     * keeping the gaps between them exactly as they were. The shift is
     * trimmed to whatever fits inside the user's day, and the amount that
     * actually landed comes back so the client can say when it was less.
     */
    @Transactional
    public ShiftResult shiftBlocks(Long userId, ShiftRequest request) {
        User user = load(userId);
        Set<Long> ids = new LinkedHashSet<>(request.blockIds());
        List<PlanBlock> blocks = blockRepository.findByIdInAndUserId(ids, userId);
        if (blocks.size() != ids.size()) {
            throw ApiException.notFound("Plan block not found");
        }

        // A shift is one day's business: mixing days would slide lines the
        // user cannot even see, and there is no single day to send back.
        LocalDate date = blocks.getFirst().getPlanDate();
        if (blocks.stream().anyMatch(block -> !block.getPlanDate().equals(date))) {
            throw ApiException.badRequest("Those blocks are not all on the same day");
        }

        int dayEndHour = user.getDayEndHour();
        int delta = PlanShift.fittedDelta(
                blocks.stream().map(PlanBlock::getEndMinute).toList(),
                request.deltaMinutes(),
                dayEndHour);
        for (PlanBlock block : blocks) {
            block.setEndMinute(PlanShift.shifted(block.getEndMinute(), delta, dayEndHour));
        }
        return new ShiftResult(delta, day(user, date));
    }

    /**
     * A day is listed in the order the user lives it, not in clock order: with
     * a day that ends at 04:00, a 01:00 block is the last thing on the plan,
     * not the first. Ties keep insertion order so two blocks finishing at the
     * same time stay put.
     */
    private PlanDayResponse day(User user, LocalDate date) {
        List<BlockResponse> blocks = blockRepository
                .findByUserIdAndPlanDateOrderByEndMinuteAscIdAsc(user.getId(), date).stream()
                .sorted(Comparator
                        .comparingInt((PlanBlock block) -> Periods.minuteOfUserDay(
                                block.getEndMinute(), user.getDayEndHour()))
                        .thenComparing(PlanBlock::getId))
                .map(PlanDtos::toResponse)
                .toList();
        return new PlanDayResponse(
                date,
                Periods.logicalToday(user),
                blockRepository.findLastPlannedDateBefore(user.getId(), date).orElse(null),
                blocks);
    }

    private void apply(PlanBlock block, BlockRequest request, Long userId) {
        block.setTitle(request.title().trim());
        block.setEndMinute(request.endMinute());
        Habit habit = request.habitId() == null
                ? null
                : habitService.getOwned(userId, request.habitId());
        block.setHabit(habit);
    }

    private PlanBlock getOwned(Long userId, Long blockId) {
        return blockRepository.findByIdAndUserId(blockId, userId)
                .orElseThrow(() -> ApiException.notFound("Plan block not found"));
    }

    private User load(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
