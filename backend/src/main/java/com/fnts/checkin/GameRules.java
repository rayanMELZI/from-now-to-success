package com.fnts.checkin;

import com.fnts.habit.Habit;
import com.fnts.habit.HabitStatus;

/**
 * The rules of the game, in one place:
 *
 * - Doing a habit grows its streak and earns basePoints x a streak multiplier.
 * - One missed day is forgiven (streak survives).
 * - Two consecutive misses reset the streak to zero.
 * - Three consecutive misses demote a VALID habit back to ACTIVE.
 * - Reaching requiredStreak consecutive days makes an ACTIVE habit VALID
 *   (which is what unlocks dependent habits) and pays a one-time bonus.
 */
public final class GameRules {

    public static final int CHECKIN_BONUS = 5;
    public static final int VALIDATION_BONUS = 50;
    public static final int MISSES_TO_RESET_STREAK = 2;
    public static final int MISSES_TO_DEMOTE = 3;

    public record DayResult(int points, boolean becameValid) {}

    public static DayResult applyDone(Habit habit) {
        habit.setConsecutiveMisses(0);
        habit.setCurrentStreak(habit.getCurrentStreak() + 1);
        habit.setBestStreak(Math.max(habit.getBestStreak(), habit.getCurrentStreak()));

        int points = Math.round(habit.getBasePoints() * multiplier(habit.getCurrentStreak()));

        boolean becameValid = false;
        if (habit.getStatus() == HabitStatus.ACTIVE
                && habit.getCurrentStreak() >= habit.getRequiredStreak()) {
            habit.setStatus(HabitStatus.VALID);
            points += VALIDATION_BONUS;
            becameValid = true;
        }
        return new DayResult(points, becameValid);
    }

    public static DayResult applyMiss(Habit habit) {
        habit.setConsecutiveMisses(habit.getConsecutiveMisses() + 1);

        if (habit.getConsecutiveMisses() >= MISSES_TO_RESET_STREAK) {
            habit.setCurrentStreak(0);
        }
        if (habit.getStatus() == HabitStatus.VALID
                && habit.getConsecutiveMisses() >= MISSES_TO_DEMOTE) {
            habit.setStatus(HabitStatus.ACTIVE);
        }
        return new DayResult(0, false);
    }

    public static float multiplier(int streak) {
        if (streak >= 30) return 3.0f;
        if (streak >= 14) return 2.0f;
        if (streak >= 7) return 1.5f;
        return 1.0f;
    }

    private GameRules() {}
}
