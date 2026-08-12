package com.fnts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.fnts.checkin.GameRules;
import com.fnts.checkin.Milestones;
import com.fnts.habit.Habit;
import com.fnts.habit.HabitStatus;
import com.fnts.habit.TrackingMode;

class TimerRulesTest {

    private static final long HOUR = 3600L;
    private static final long DAY = 24 * HOUR;
    private static final Instant START = Instant.parse("2026-01-01T00:00:00Z");

    /** A 7-day goal: rungs at 1h, 6h, 12h, 1d, 3d, then the 7d goal itself. */
    private Habit timer() {
        Habit habit = new Habit();
        habit.setName("stop smoking");
        habit.setBasePoints(10);
        habit.setTrackingMode(TrackingMode.TIMER);
        habit.setGoalSeconds(7 * DAY);
        habit.setRequiredStreak(Milestones.ladder(7 * DAY).size());
        habit.setStatus(HabitStatus.ACTIVE);
        habit.setClockStartedAt(START);
        return habit;
    }

    private Instant after(long seconds) {
        return START.plus(Duration.ofSeconds(seconds));
    }

    /* ---------- the ladder ---------- */

    @Test
    void ladderStopsAtTheGoalAndAlwaysEndsOnIt() {
        assertEquals(List.of(HOUR, 6 * HOUR, 12 * HOUR, DAY, 3 * DAY, 7 * DAY),
                Milestones.ladder(7 * DAY));
    }

    @Test
    void aGoalShorterThanTheFirstRungIsItsOwnLadder() {
        assertEquals(List.of(HOUR), Milestones.ladder(HOUR));
    }

    @Test
    void nextRungIsZeroOnceTheGoalIsPassed() {
        List<Long> ladder = Milestones.ladder(7 * DAY);
        assertEquals(6 * HOUR, Milestones.next(ladder, 2 * HOUR));
        assertEquals(0, Milestones.next(ladder, 8 * DAY));
    }

    /* ---------- climbing ---------- */

    @Test
    void milestonesFillTheGaugeAsTheClockRuns() {
        Habit habit = timer();
        GameRules.advanceTimer(habit, after(13 * HOUR));
        assertEquals(3, habit.getGauge()); // 1h, 6h, 12h
    }

    @Test
    void eachRungPaysMoreThanTheLast() {
        Habit habit = timer();
        // rungs 1 + 2 + 3 = 6 x basePoints
        assertEquals(60, GameRules.advanceTimer(habit, after(13 * HOUR)).points());
    }

    @Test
    void alreadyBankedMilestonesAreNeverPaidTwice() {
        Habit habit = timer();
        GameRules.advanceTimer(habit, after(13 * HOUR));
        assertEquals(0, GameRules.advanceTimer(habit, after(13 * HOUR)).points());
    }

    @Test
    void reachingTheGoalValidatesTheHabit() {
        Habit habit = timer();
        GameRules.TimerResult result = GameRules.advanceTimer(habit, after(7 * DAY));
        assertTrue(result.becameValid());
        assertEquals(HabitStatus.VALID, habit.getStatus());
        assertEquals(habit.getRequiredStreak(), habit.getGauge());
    }

    @Test
    void beatingYourRecordPaysOnceAndOnlyOnce() {
        Habit habit = timer();
        habit.setBestCleanSeconds(2 * HOUR);
        assertTrue(GameRules.advanceTimer(habit, after(3 * HOUR)).recordBeaten());
        assertFalse(GameRules.advanceTimer(habit, after(4 * HOUR)).recordBeaten());
    }

    @Test
    void aFirstRunHasNoRecordToBeat() {
        Habit habit = timer();
        assertFalse(GameRules.advanceTimer(habit, after(3 * HOUR)).recordBeaten());
    }

    /* ---------- falling ---------- */

    @Test
    void fallingStoresTheRunAsTheNewRecord() {
        Habit habit = timer();
        GameRules.applyFall(habit, false, after(4 * DAY));
        assertEquals(4 * DAY, habit.getBestCleanSeconds());
    }

    @Test
    void aShorterRunDoesNotTouchTheRecord() {
        Habit habit = timer();
        habit.setBestCleanSeconds(10 * DAY);
        GameRules.applyFall(habit, false, after(DAY));
        assertEquals(10 * DAY, habit.getBestCleanSeconds());
    }

    @Test
    void fallingEmptiesTheGaugeAndRestartsTheClock() {
        Habit habit = timer();
        GameRules.advanceTimer(habit, after(2 * DAY));
        Instant fellAt = after(2 * DAY);
        GameRules.applyFall(habit, false, fellAt);

        assertEquals(0, habit.getGauge());
        assertEquals(0, habit.getCurrentStreak());
        assertEquals(fellAt, habit.getClockStartedAt());
    }

    @Test
    void fallingDemotesAValidHabit() {
        Habit habit = timer();
        GameRules.advanceTimer(habit, after(7 * DAY));
        GameRules.applyFall(habit, false, after(8 * DAY));
        assertEquals(HabitStatus.ACTIVE, habit.getStatus());
    }

    @Test
    void fallingCostsBasePointsAndHalfThatWithAReason() {
        assertEquals(-10, GameRules.applyFall(timer(), false, after(DAY)).points());
        assertEquals(-5, GameRules.applyFall(timer(), true, after(DAY)).points());
    }

    @Test
    void theRecordBonusIsPayableAgainOnTheNextRun() {
        Habit habit = timer();
        habit.setBestCleanSeconds(HOUR);
        GameRules.advanceTimer(habit, after(2 * HOUR)); // beats it, bonus paid
        GameRules.applyFall(habit, false, after(2 * HOUR));
        assertFalse(habit.isRecordBonusPaid());
    }

    /* ---------- guards ---------- */

    @Test
    void aScheduledHabitIsNeverTouchedByTheTimerRules() {
        Habit habit = timer();
        habit.setTrackingMode(TrackingMode.SCHEDULED);
        assertEquals(0, GameRules.advanceTimer(habit, after(30 * DAY)).points());
        assertEquals(0, habit.getGauge());
    }

    @Test
    void aClockThatHasNotStartedDoesNothing() {
        Habit habit = timer();
        habit.setClockStartedAt(null);
        assertEquals(0, GameRules.advanceTimer(habit, after(30 * DAY)).points());
    }
}
