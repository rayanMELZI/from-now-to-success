package com.fnts.checkin;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.TimerDtos.FallResult;
import com.fnts.checkin.TimerDtos.RunEntry;
import com.fnts.common.ApiException;
import com.fnts.habit.Habit;
import com.fnts.habit.HabitRepository;
import com.fnts.habit.HabitService;
import com.fnts.habit.HabitStatus;
import com.fnts.habit.TrackingMode;
import com.fnts.user.Levels;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

/** The write side of timer habits: owning up to a relapse restarts the clock. */
@Service
public class TimerService {

    private static final int HISTORY_LIMIT = 10;

    /** How far ahead of the server a device clock may be without complaint. */
    private static final Duration CLOCK_SKEW = Duration.ofMinutes(5);

    private final HabitTimerRunRepository runRepository;
    private final HabitRepository habitRepository;
    private final UserRepository userRepository;
    private final HabitService habitService;

    public TimerService(HabitTimerRunRepository runRepository,
                        HabitRepository habitRepository,
                        UserRepository userRepository,
                        HabitService habitService) {
        this.runRepository = runRepository;
        this.habitRepository = habitRepository;
        this.userRepository = userRepository;
        this.habitService = habitService;
    }

    @Transactional
    public FallResult fall(Long userId, Long habitId, String reason, Instant slippedAt) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        Instant now = Instant.now();

        Habit habit = habitService.getOwned(userId, habitId);
        if (habit.getTrackingMode() != TrackingMode.TIMER) {
            throw ApiException.badRequest("That habit is not a timer");
        }
        if (habit.getStatus() == HabitStatus.LOCKED || habit.getClockStartedAt() == null) {
            throw ApiException.badRequest("This timer has not started yet");
        }
        Instant fellAt = resolveMoment(slippedAt, habit.getClockStartedAt(), now);

        // The run gets everything it earned right up to the relapse. These
        // points are already on the user's total — only the penalty is left
        // to apply, or the milestones would be paid twice. The other clocks
        // catch up to now; this one stops at the moment of the slip, so a
        // milestone the user only crossed on paper is never banked.
        int banked = habitService.advanceTimers(user, now, habitId).points();
        int upToSlip = GameRules.advanceTimer(habit, fellAt).points();
        if (upToSlip != 0) {
            user.setTotalPoints(Math.max(0, user.getTotalPoints() + upToSlip));
        }
        banked += upToSlip;

        boolean excused = reason != null && !reason.isBlank();
        Instant startedAt = habit.getClockStartedAt();
        long previousBest = habit.getBestCleanSeconds();
        long lasted = GameRules.elapsedSeconds(habit, fellAt);
        int milestonesHit = habit.getGauge();

        GameRules.TimerResult fall = GameRules.applyFall(habit, excused, fellAt);
        user.setTotalPoints(Math.max(0, user.getTotalPoints() + fall.points()));
        int earned = banked + fall.points();

        HabitTimerRun run = new HabitTimerRun();
        run.setHabit(habit);
        run.setStartedAt(startedAt);
        run.setEndedAt(fellAt);
        run.setDurationSeconds(lasted);
        run.setMilestonesHit(milestonesHit);
        run.setReason(excused ? reason.trim() : null);
        runRepository.save(run);

        // Losing VALID re-locks whatever this habit was holding open. The
        // habits are managed entities, so re-reading their status after the
        // sync is enough to see which ones closed.
        List<Habit> others = habitRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
        List<Habit> wereOpen = others.stream()
                .filter(other -> other.getStatus() != HabitStatus.LOCKED)
                .toList();
        habitService.syncLockStates(userId, Periods.logicalToday(user));
        List<String> relocked = wereOpen.stream()
                .filter(other -> other.getStatus() == HabitStatus.LOCKED)
                .map(Habit::getName)
                .toList();

        return new FallResult(earned, user.getTotalPoints(),
                Levels.levelFor(user.getTotalPoints()), lasted,
                habit.getBestCleanSeconds(), lasted > previousBest && previousBest > 0,
                relocked, GameRules.elapsedSeconds(habit, now));
    }

    /**
     * Where to place the relapse on the clock. No moment given means now.
     * A moment slightly ahead of the server is a device clock running fast,
     * not a claim about the future, so it is pulled back rather than refused;
     * anything further ahead, or earlier than the run it is ending, cannot be
     * made sense of and is rejected.
     */
    static Instant resolveMoment(Instant slippedAt, Instant runStartedAt, Instant now) {
        if (slippedAt == null) {
            return now;
        }
        if (slippedAt.isAfter(now.plus(CLOCK_SKEW))) {
            throw ApiException.badRequest("A slip cannot be in the future");
        }
        if (slippedAt.isBefore(runStartedAt)) {
            throw ApiException.badRequest(
                    "This run only started later — pick a moment after the clock began");
        }
        return slippedAt.isAfter(now) ? now : slippedAt;
    }

    @Transactional
    public List<RunEntry> history(Long userId, Long habitId) {
        habitService.getOwned(userId, habitId); // ownership check
        return runRepository
                .findByHabitIdOrderByEndedAtDesc(habitId, Limit.of(HISTORY_LIMIT)).stream()
                .map(run -> new RunEntry(run.getStartedAt(), run.getEndedAt(),
                        run.getDurationSeconds(), run.getMilestonesHit(), run.getReason()))
                .toList();
    }
}
