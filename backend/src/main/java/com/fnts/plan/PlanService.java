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
import com.fnts.plan.PlanDtos.BlockRequest;
import com.fnts.plan.PlanDtos.BlockResponse;
import com.fnts.plan.PlanDtos.PlanDayResponse;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

/**
 * The daily plan: a list of "at this time, do this" lines for one date. It
 * holds no game rules — nothing here touches points, gauges or streaks. A
 * block may point at a habit, but ticking the block is the check-in screen's
 * job, not this one's.
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
                blockRepository.findByUserIdAndPlanDateOrderByStartMinuteAscIdAsc(userId, from);
        if (source.isEmpty()) {
            throw ApiException.badRequest("That day has nothing to copy");
        }

        for (PlanBlock original : source) {
            PlanBlock copy = new PlanBlock();
            copy.setUser(user);
            copy.setPlanDate(target);
            copy.setStartMinute(original.getStartMinute());
            copy.setTitle(original.getTitle());
            copy.setHabit(original.getHabit());
            // A copied plan is a plan for the day ahead: nothing is done yet.
            copy.setDone(false);
            blockRepository.save(copy);
        }
        return day(user, target);
    }

    /**
     * A day is listed in the order the user lives it, not in clock order: with
     * a day that ends at 04:00, a 01:00 block is the last thing on the plan,
     * not the first. Ties keep insertion order so two blocks at the same time
     * stay put.
     */
    private PlanDayResponse day(User user, LocalDate date) {
        List<BlockResponse> blocks = blockRepository
                .findByUserIdAndPlanDateOrderByStartMinuteAscIdAsc(user.getId(), date).stream()
                .sorted(Comparator
                        .comparingInt((PlanBlock block) -> Periods.minuteOfUserDay(
                                block.getStartMinute(), user.getDayEndHour()))
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
        block.setStartMinute(request.startMinute());
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
