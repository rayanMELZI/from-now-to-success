package com.fnts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.fnts.checkin.GameRules;
import com.fnts.habit.Habit;
import com.fnts.habit.HabitStatus;

class GameRulesTest {

    private Habit habit(HabitStatus status, int gauge, int streak, int misses) {
        Habit habit = new Habit();
        habit.setName("test");
        habit.setBasePoints(10);
        habit.setRequiredStreak(5);
        habit.setStatus(status);
        habit.setGauge(gauge);
        habit.setCurrentStreak(streak);
        habit.setBestStreak(streak);
        habit.setConsecutiveMisses(misses);
        return habit;
    }

    /* ---------- gauge behaviour ---------- */

    @Test
    void doneFillsGaugeByOne() {
        Habit habit = habit(HabitStatus.ACTIVE, 2, 2, 0);
        GameRules.applyDone(habit);
        assertEquals(3, habit.getGauge());
    }

    @Test
    void gaugeCapsAtRequiredStreak() {
        Habit habit = habit(HabitStatus.VALID, 5, 50, 0);
        GameRules.applyDone(habit);
        assertEquals(5, habit.getGauge()); // full stays full, even mid-50-streak
    }

    @Test
    void missDropsGaugeByOne() {
        Habit habit = habit(HabitStatus.ACTIVE, 3, 3, 0);
        GameRules.applyMiss(habit, false, false);
        assertEquals(2, habit.getGauge());
    }

    @Test
    void gaugeNeverGoesBelowZero() {
        Habit habit = habit(HabitStatus.ACTIVE, 0, 0, 5);
        GameRules.applyMiss(habit, false, false);
        assertEquals(0, habit.getGauge());
    }

    /* ---------- validation via the gauge ---------- */

    @Test
    void fullGaugeMakesHabitValidWithBonus() {
        Habit habit = habit(HabitStatus.ACTIVE, 4, 4, 0);
        var result = GameRules.applyDone(habit); // gauge 4 -> 5 = full

        assertTrue(result.becameValid());
        assertEquals(HabitStatus.VALID, habit.getStatus());
        assertEquals(10 + GameRules.VALIDATION_BONUS, result.points());
    }

    @Test
    void gaugeCanFillDespiteAnEarlierStreakReset() {
        // Two misses reset the streak, but the gauge only lost 2 notches:
        // the player recovers in 2 days instead of starting from zero.
        Habit habit = habit(HabitStatus.ACTIVE, 3, 0, 2);
        GameRules.applyDone(habit); // gauge 4
        var result = GameRules.applyDone(habit); // gauge 5 -> VALID
        assertTrue(result.becameValid());
    }

    /* ---------- demotion via the gauge floor ---------- */

    @Test
    void validSurvivesSmallGaugeDips() {
        // floor for requiredStreak 5 is ceil(5 * 0.6) = 3
        Habit habit = habit(HabitStatus.VALID, 5, 10, 0);
        GameRules.applyMiss(habit, false, false); // gauge 4
        GameRules.applyMiss(habit, false, false); // gauge 3, still >= floor
        assertEquals(HabitStatus.VALID, habit.getStatus());
    }

    @Test
    void validDemotedWhenGaugeSinksBelowFloor() {
        Habit habit = habit(HabitStatus.VALID, 3, 0, 2);
        GameRules.applyMiss(habit, false, false); // gauge 2 < floor 3
        assertEquals(HabitStatus.ACTIVE, habit.getStatus());
    }

    @Test
    void demotionFloorRoundsUp() {
        assertEquals(3, GameRules.demotionFloor(5));   // ceil(3.0)
        assertEquals(5, GameRules.demotionFloor(7));   // ceil(4.2)
        assertEquals(18, GameRules.demotionFloor(30)); // ceil(18.0)
    }

    /* ---------- streak (points multiplier) rules ---------- */

    @Test
    void doneGrowsStreakAndAwardsBasePoints() {
        Habit habit = habit(HabitStatus.ACTIVE, 0, 0, 0);
        var result = GameRules.applyDone(habit);

        assertEquals(1, habit.getCurrentStreak());
        assertEquals(10, result.points());
        assertFalse(result.becameValid());
    }

    @Test
    void singleMissForgivesStreak() {
        Habit habit = habit(HabitStatus.ACTIVE, 3, 3, 0);
        GameRules.applyMiss(habit, false, false);
        assertEquals(3, habit.getCurrentStreak());
        assertEquals(1, habit.getConsecutiveMisses());
    }

    @Test
    void twoConsecutiveMissesResetTheStreak() {
        Habit habit = habit(HabitStatus.ACTIVE, 3, 3, 1);
        GameRules.applyMiss(habit, false, false);
        assertEquals(0, habit.getCurrentStreak());
    }

    @Test
    void doneResetsConsecutiveMisses() {
        Habit habit = habit(HabitStatus.ACTIVE, 2, 2, 1);
        GameRules.applyDone(habit);
        assertEquals(0, habit.getConsecutiveMisses());
    }

    @Test
    void bestStreakIsRemembered() {
        Habit habit = habit(HabitStatus.ACTIVE, 4, 9, 0);
        GameRules.applyDone(habit);
        assertEquals(10, habit.getBestStreak());

        GameRules.applyMiss(habit, false, false);
        GameRules.applyMiss(habit, false, false);
        assertEquals(0, habit.getCurrentStreak());
        assertEquals(10, habit.getBestStreak());
    }

    @Test
    void multiplierTiers() {
        assertEquals(1.0f, GameRules.multiplier(6));
        assertEquals(1.5f, GameRules.multiplier(7));
        assertEquals(2.0f, GameRules.multiplier(14));
        assertEquals(3.0f, GameRules.multiplier(30));
    }

    @Test
    void streakMultiplierAppliesToPoints() {
        Habit habit = habit(HabitStatus.VALID, 5, 6, 0);
        var result = GameRules.applyDone(habit); // streak becomes 7
        assertEquals(15, result.points()); // 10 * 1.5
    }

    /* ---------- periodic (N times per week/month) ---------- */

    @Test
    void periodicCompletionBelowTargetPaysPointsButLeavesGauge() {
        Habit habit = habit(HabitStatus.ACTIVE, 2, 2, 0);
        var result = GameRules.applyPeriodicDone(habit, false);

        assertEquals(10, result.points()); // base x multiplier(streak+1=3 -> x1)
        assertEquals(2, habit.getGauge());
        assertEquals(2, habit.getCurrentStreak());
        assertFalse(result.becameValid());
    }

    @Test
    void periodicTargetReachedActsLikeADoneDay() {
        Habit habit = habit(HabitStatus.ACTIVE, 4, 4, 0);
        var result = GameRules.applyPeriodicDone(habit, true);

        assertEquals(5, habit.getGauge());
        assertEquals(5, habit.getCurrentStreak());
        assertTrue(result.becameValid());
        assertEquals(10 + GameRules.VALIDATION_BONUS, result.points());
    }

    /* ---------- miss penalties, excuses, freezes ---------- */

    @Test
    void plainMissCostsBasePoints() {
        Habit habit = habit(HabitStatus.ACTIVE, 3, 3, 0);
        var result = GameRules.applyMiss(habit, false, false);
        assertEquals(-10, result.points());
    }

    @Test
    void excusedMissCostsHalf() {
        Habit habit = habit(HabitStatus.ACTIVE, 3, 3, 0);
        var result = GameRules.applyMiss(habit, true, false);
        assertEquals(-5, result.points());
        assertEquals(2, habit.getGauge()); // excuse softens points, not the gauge
    }

    @Test
    void frozenMissProtectsGaugeStreakAndMissCounter() {
        Habit habit = habit(HabitStatus.VALID, 5, 12, 0);
        var result = GameRules.applyMiss(habit, true, true);

        assertEquals(5, habit.getGauge());
        assertEquals(12, habit.getCurrentStreak());
        assertEquals(0, habit.getConsecutiveMisses());
        assertEquals(HabitStatus.VALID, habit.getStatus());
        assertEquals(-5, result.points()); // freeze protects progress, not points
    }
}
