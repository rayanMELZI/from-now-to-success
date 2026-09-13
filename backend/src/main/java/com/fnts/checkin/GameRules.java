package com.fnts.checkin;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import com.fnts.habit.Habit;
import com.fnts.habit.HabitStatus;
import com.fnts.habit.TrackingMode;

/**
 * The rules of the game, in one place.
 *
 * The GAUGE is the heart of it: it fills by 1 per done day up to
 * requiredStreak (its max), and drops by 1 per missed day. A full gauge
 * makes an ACTIVE habit VALID (which unlocks dependents). A VALID habit
 * survives small dips; it is demoted back to ACTIVE only when the gauge
 * sinks below DEMOTION_RATIO of its max. Re-validation needs a full
 * gauge again.
 *
 * The STREAK exists for points: basePoints x a multiplier that grows with
 * consecutive done days. One missed day is forgiven; two consecutive
 * misses reset the streak (but only dent the gauge by one each).
 *
 * TIMER habits play the same game with a different clock: the gauge counts
 * MILESTONES passed by the current clean run instead of days done, so a
 * full gauge still means VALID and still unlocks dependents. There is no
 * idle income — points come from climbing rungs and from beating your own
 * record. A relapse empties the gauge in one go.
 */
public final class GameRules {

    public static final int CHECKIN_BONUS = 5;
    public static final int VALIDATION_BONUS = 50;
    public static final int MISSES_TO_RESET_STREAK = 2;
    /** A VALID habit is demoted when gauge < ceil(requiredStreak * ratio). */
    public static final float DEMOTION_RATIO = 0.6f;
    /** Streak freezes (daily + weekly habits) per user per calendar month. */
    public static final int FREEZES_PER_MONTH = 3;
    /** Deep Freezes (monthly habits) per user per rolling 3 months. */
    public static final int DEEP_FREEZES_PER_QUARTER = 1;
    /** Passing your longest-ever run pays basePoints x this, once per run. */
    public static final float RECORD_BONUS_FACTOR = 2f;

    public record DayResult(int points, boolean becameValid) {}

    public static DayResult applyDone(Habit habit) {
        habit.setConsecutiveMisses(0);
        habit.setCurrentStreak(habit.getCurrentStreak() + 1);
        habit.setBestStreak(Math.max(habit.getBestStreak(), habit.getCurrentStreak()));
        habit.setGauge(Math.min(habit.getGauge() + 1, habit.getRequiredStreak()));

        int points = Math.round(habit.getBasePoints() * multiplier(habit.getCurrentStreak()));

        boolean becameValid = false;
        if (habit.getStatus() == HabitStatus.ACTIVE
                && habit.getGauge() >= habit.getRequiredStreak()) {
            habit.setStatus(HabitStatus.VALID);
            points += VALIDATION_BONUS;
            becameValid = true;
        }
        return new DayResult(points, becameValid);
    }

    /**
     * One completion of a weekly/monthly habit. Every completion pays points
     * immediately; gauge/streak/validation only move when this completion
     * reaches the period's target (timesPerPeriod).
     */
    public static DayResult applyPeriodicDone(Habit habit, boolean targetReached) {
        if (!targetReached) {
            int points = Math.round(
                    habit.getBasePoints() * multiplier(habit.getCurrentStreak() + 1));
            return new DayResult(points, false);
        }
        return applyDone(habit);
    }

    /**
     * A miss costs the habit's base points; giving a reason (excused) halves
     * the cost. A streak freeze fully protects gauge, streak and miss counter
     * (points are still lost — freezes buy protection, not absolution).
     */
    public static DayResult applyMiss(Habit habit, boolean excused, boolean frozen) {
        int penalty = excused
                ? -Math.round(habit.getBasePoints() / 2f)
                : -habit.getBasePoints();

        if (!frozen) {
            habit.setConsecutiveMisses(habit.getConsecutiveMisses() + 1);
            if (habit.getConsecutiveMisses() >= MISSES_TO_RESET_STREAK) {
                habit.setCurrentStreak(0);
            }
            habit.setGauge(Math.max(habit.getGauge() - 1, 0));

            if (habit.getStatus() == HabitStatus.VALID
                    && habit.getGauge() < demotionFloor(habit.getRequiredStreak())) {
                habit.setStatus(HabitStatus.ACTIVE);
            }
        }
        return new DayResult(penalty, false);
    }

    /**
     * Recomputes a daily habit's derived state by folding its entire log
     * history from scratch, and returns the correction owed to the user's
     * total points.
     *
     * A check-in that was queued offline rewrites a day the game has already
     * counted, and the effect of a miss cannot be undone in place: a gauge
     * clamped at 0 and a streak reset to 0 have both forgotten what they
     * were. The logs are the complete record for a daily habit — the catch-up
     * fills every unanswered day — so folding them is the only way to reach
     * the state the user would have had if the answer had arrived on time.
     *
     * Only the days in {@code rewritten} have their stored points corrected.
     * Everything earlier keeps the points it was actually paid: basePoints
     * and requiredStreak are editable, so re-deriving old days at today's
     * settings would silently restate history the user has already banked.
     *
     * @param logsInDateOrder every log of this habit, oldest first
     * @param rewritten       the days this request answered late
     * @return points to add to the user's total (may be negative)
     */
    public static int replayDaily(Habit habit, List<HabitLog> logsInDateOrder,
                                  Set<LocalDate> rewritten) {
        habit.setGauge(0);
        habit.setCurrentStreak(0);
        habit.setBestStreak(0);
        habit.setConsecutiveMisses(0);
        habit.setStatus(HabitStatus.ACTIVE);

        int delta = 0;
        for (HabitLog log : logsInDateOrder) {
            DayResult result = log.getStatus() == HabitLog.Status.DONE
                    ? applyDone(habit)
                    : applyMiss(habit, isExcused(log), log.isFrozen());

            if (rewritten.contains(log.getLogDate())) {
                delta += result.points() - log.getPointsAwarded();
                log.setPointsAwarded(result.points());
            }
        }
        return delta;
    }

    /** A miss with a written reason costs half — the record of that is the text. */
    private static boolean isExcused(HabitLog log) {
        return log.getStatus() == HabitLog.Status.MISSED
                && log.getReason() != null && !log.getReason().isBlank();
    }

    /* ---------- timer habits ---------- */

    public record TimerResult(int points, boolean becameValid,
                              int milestonesGained, boolean recordBeaten) {}

    private static final TimerResult NOTHING = new TimerResult(0, false, 0, false);

    /**
     * Banks every milestone the running clock has passed since the last look.
     * Rung n is worth basePoints x n, so the ladder pays more the further you
     * climb; the last rung is the goal and validates the habit. Passing your
     * previous record pays its own bonus, once per run.
     *
     * Safe to call as often as you like: the gauge remembers what was paid.
     */
    public static TimerResult advanceTimer(Habit habit, Instant now) {
        if (habit.getTrackingMode() != TrackingMode.TIMER
                || habit.getClockStartedAt() == null
                || habit.getGoalSeconds() == null) {
            return NOTHING;
        }
        long elapsed = elapsedSeconds(habit, now);
        List<Long> ladder = Milestones.ladder(habit.getGoalSeconds());
        int reached = Milestones.reached(ladder, elapsed);

        int points = 0;
        for (int rung = habit.getGauge() + 1; rung <= reached; rung++) {
            points += habit.getBasePoints() * rung;
        }
        int gained = Math.max(0, reached - habit.getGauge());
        if (gained > 0) {
            habit.setGauge(reached);
            habit.setCurrentStreak(reached);
            habit.setBestStreak(Math.max(habit.getBestStreak(), reached));
        }

        boolean recordBeaten = false;
        if (!habit.isRecordBonusPaid() && habit.getBestCleanSeconds() > 0
                && elapsed > habit.getBestCleanSeconds()) {
            points += Math.round(habit.getBasePoints() * RECORD_BONUS_FACTOR);
            habit.setRecordBonusPaid(true);
            recordBeaten = true;
        }

        boolean becameValid = false;
        if (habit.getStatus() == HabitStatus.ACTIVE && reached >= ladder.size()) {
            habit.setStatus(HabitStatus.VALID);
            points += VALIDATION_BONUS;
            becameValid = true;
        }
        return new TimerResult(points, becameValid, gained, recordBeaten);
    }

    /**
     * The relapse: the run ends, the clock restarts from zero and the gauge
     * empties in one go (a timer habit is all-or-nothing — that is the point).
     * A VALID habit therefore always falls back to ACTIVE and re-locks its
     * dependents. Like any miss it costs base points, halved with a reason.
     */
    public static TimerResult applyFall(Habit habit, boolean excused, Instant now) {
        long elapsed = elapsedSeconds(habit, now);
        if (elapsed > habit.getBestCleanSeconds()) {
            habit.setBestCleanSeconds(elapsed);
        }
        habit.setGauge(0);
        habit.setCurrentStreak(0);
        habit.setConsecutiveMisses(habit.getConsecutiveMisses() + 1);
        habit.setClockStartedAt(now);
        habit.setRecordBonusPaid(false);
        if (habit.getStatus() == HabitStatus.VALID) {
            habit.setStatus(HabitStatus.ACTIVE);
        }

        int penalty = excused
                ? -Math.round(habit.getBasePoints() / 2f)
                : -habit.getBasePoints();
        return new TimerResult(penalty, false, 0, false);
    }

    /** How long the current run has been going, never negative. */
    public static long elapsedSeconds(Habit habit, Instant now) {
        if (habit.getClockStartedAt() == null) {
            return 0;
        }
        return Math.max(0, Duration.between(habit.getClockStartedAt(), now).getSeconds());
    }

    public static int demotionFloor(int requiredStreak) {
        return (int) Math.ceil(requiredStreak * DEMOTION_RATIO);
    }

    public static float multiplier(int streak) {
        if (streak >= 30) return 3.0f;
        if (streak >= 14) return 2.0f;
        if (streak >= 7) return 1.5f;
        return 1.0f;
    }

    private GameRules() {}
}
