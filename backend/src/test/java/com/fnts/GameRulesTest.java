package com.fnts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.fnts.checkin.GameRules;
import com.fnts.habit.Habit;
import com.fnts.habit.HabitStatus;

class GameRulesTest {

    private Habit habit(HabitStatus status, int streak, int misses) {
        Habit habit = new Habit();
        habit.setName("test");
        habit.setBasePoints(10);
        habit.setRequiredStreak(7);
        habit.setStatus(status);
        habit.setCurrentStreak(streak);
        habit.setBestStreak(streak);
        habit.setConsecutiveMisses(misses);
        return habit;
    }

    @Test
    void doneGrowsStreakAndAwardsBasePoints() {
        Habit habit = habit(HabitStatus.ACTIVE, 0, 0);
        var result = GameRules.applyDone(habit);

        assertEquals(1, habit.getCurrentStreak());
        assertEquals(10, result.points());
        assertFalse(result.becameValid());
    }

    @Test
    void doneResetsConsecutiveMisses() {
        Habit habit = habit(HabitStatus.ACTIVE, 3, 1);
        GameRules.applyDone(habit);
        assertEquals(0, habit.getConsecutiveMisses());
    }

    @Test
    void streakMultiplierKicksInAtSevenDays() {
        Habit habit = habit(HabitStatus.VALID, 6, 0);
        var result = GameRules.applyDone(habit); // streak becomes 7
        assertEquals(15, result.points()); // 10 * 1.5
    }

    @Test
    void reachingRequiredStreakMakesHabitValidWithBonus() {
        Habit habit = habit(HabitStatus.ACTIVE, 6, 0);
        var result = GameRules.applyDone(habit); // streak becomes 7 = requiredStreak

        assertTrue(result.becameValid());
        assertEquals(HabitStatus.VALID, habit.getStatus());
        assertEquals(15 + GameRules.VALIDATION_BONUS, result.points());
    }

    @Test
    void singleMissIsForgiven() {
        Habit habit = habit(HabitStatus.ACTIVE, 5, 0);
        GameRules.applyMiss(habit);

        assertEquals(5, habit.getCurrentStreak()); // streak survives
        assertEquals(1, habit.getConsecutiveMisses());
    }

    @Test
    void twoConsecutiveMissesResetTheStreak() {
        Habit habit = habit(HabitStatus.ACTIVE, 5, 1);
        GameRules.applyMiss(habit);

        assertEquals(0, habit.getCurrentStreak());
        assertEquals(2, habit.getConsecutiveMisses());
    }

    @Test
    void threeConsecutiveMissesDemoteAValidHabit() {
        Habit habit = habit(HabitStatus.VALID, 0, 2);
        GameRules.applyMiss(habit);

        assertEquals(HabitStatus.ACTIVE, habit.getStatus());
    }

    @Test
    void missesNeverAwardNegativePoints() {
        Habit habit = habit(HabitStatus.ACTIVE, 5, 1);
        var result = GameRules.applyMiss(habit);
        assertEquals(0, result.points());
    }

    @Test
    void bestStreakIsRemembered() {
        Habit habit = habit(HabitStatus.ACTIVE, 9, 0);
        GameRules.applyDone(habit);
        assertEquals(10, habit.getBestStreak());

        GameRules.applyMiss(habit);
        GameRules.applyMiss(habit); // streak resets
        assertEquals(0, habit.getCurrentStreak());
        assertEquals(10, habit.getBestStreak());
    }

    @Test
    void multiplierTiers() {
        assertEquals(1.0f, GameRules.multiplier(1));
        assertEquals(1.0f, GameRules.multiplier(6));
        assertEquals(1.5f, GameRules.multiplier(7));
        assertEquals(2.0f, GameRules.multiplier(14));
        assertEquals(3.0f, GameRules.multiplier(30));
        assertEquals(3.0f, GameRules.multiplier(100));
    }
}
