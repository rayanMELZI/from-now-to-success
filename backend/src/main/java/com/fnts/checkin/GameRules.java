package com.fnts.checkin;

import com.fnts.habit.Habit;
import com.fnts.habit.HabitStatus;

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
