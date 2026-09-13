package com.fnts.checkin;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.fnts.habit.Habit;
import com.fnts.habit.HabitStatus;

/**
 * A check-in made offline arrives after the catch-up has already written that
 * day off as missed. Replaying the habit's log history is what lets the late
 * answer land as if it had been on time — these are the cases that matter.
 */
class LateCheckinReplayTest {

    private static final LocalDate DAY1 = LocalDate.of(2026, 3, 2);

    private Habit habit(int requiredStreak) {
        Habit habit = new Habit();
        habit.setName("test");
        habit.setBasePoints(10);
        habit.setRequiredStreak(requiredStreak);
        habit.setStatus(HabitStatus.ACTIVE);
        habit.setStartDate(DAY1);
        return habit;
    }

    /** One log per day from DAY1, described as "D" done, "M" miss, "F" frozen miss. */
    private List<HabitLog> logs(String pattern) {
        List<HabitLog> logs = new ArrayList<>();
        for (int i = 0; i < pattern.length(); i++) {
            char c = pattern.charAt(i);
            HabitLog log = new HabitLog();
            log.setLogDate(DAY1.plusDays(i));
            log.setStatus(c == 'D' ? HabitLog.Status.DONE : HabitLog.Status.MISSED);
            log.setFrozen(c == 'F');
            // What the catch-up would have paid: a done day's points are only
            // meaningful once replayed, a missed day costs basePoints.
            log.setPointsAwarded(c == 'D' ? 10 : -10);
            logs.add(log);
        }
        return logs;
    }

    private LocalDate day(int oneBased) {
        return DAY1.plusDays(oneBased - 1);
    }

    /* ---------- the whole point: a miss that turns out to be a done ---------- */

    @Test
    void lateDoneRestoresTheStreakTheAutoMissBroke() {
        Habit habit = habit(5);
        List<HabitLog> history = logs("DDD");
        // Day 3 was auto-missed; the queued answer says it was done.
        history.get(2).setStatus(HabitLog.Status.DONE);

        GameRules.replayDaily(habit, history, Set.of(day(3)));

        assertEquals(3, habit.getCurrentStreak());
        assertEquals(3, habit.getGauge());
        assertEquals(0, habit.getConsecutiveMisses());
    }

    @Test
    void lateDonePaysTheDifferenceForThatDayOnly() {
        Habit habit = habit(5);
        List<HabitLog> history = logs("DDM");
        history.get(2).setStatus(HabitLog.Status.DONE); // the late answer

        int delta = GameRules.replayDaily(habit, history, Set.of(day(3)));

        // The day was charged -10 as a miss and is worth +10 as a done.
        assertEquals(20, delta);
        assertEquals(10, history.get(2).getPointsAwarded());
    }

    @Test
    void daysBeforeTheCorrectionKeepThePointsTheyWerePaid() {
        Habit habit = habit(5);
        List<HabitLog> history = logs("DDM");
        // basePoints and requiredStreak are editable, so an old day may have
        // been paid at settings that no longer apply. Replay must not restate it.
        history.get(0).setPointsAwarded(999);
        history.get(2).setStatus(HabitLog.Status.DONE);

        GameRules.replayDaily(habit, history, Set.of(day(3)));

        assertEquals(999, history.get(0).getPointsAwarded());
    }

    /* ---------- validation survives the correction ---------- */

    @Test
    void lateDoneKeepsAHabitTheMissesHadDemoted() {
        Habit habit = habit(3);
        // DDD validates (gauge 3); two misses drop it to gauge 1, below the
        // floor of 2, so the live run demoted it back to ACTIVE.
        List<HabitLog> history = logs("DDDMM");
        history.get(4).setStatus(HabitLog.Status.DONE); // day 5 was really done

        GameRules.replayDaily(habit, history, Set.of(day(5)));

        assertEquals(HabitStatus.VALID, habit.getStatus());
        assertEquals(3, habit.getGauge());
    }

    @Test
    void replayReachesTheSameStateTheLiveRulesWould() {
        // The fold must not drift from applyDone/applyMiss: two misses in a
        // row reset the streak and dent the gauge once each.
        Habit habit = habit(5);
        GameRules.replayDaily(habit, logs("DDMM"), Set.of());

        assertEquals(0, habit.getCurrentStreak());
        assertEquals(0, habit.getGauge());
        assertEquals(2, habit.getConsecutiveMisses());
        assertEquals(2, habit.getBestStreak());
    }

    @Test
    void replayHonoursAFrozenMiss() {
        Habit habit = habit(5);
        GameRules.replayDaily(habit, logs("DDF"), Set.of());

        // A freeze protects gauge, streak and the miss counter alike.
        assertEquals(2, habit.getGauge());
        assertEquals(2, habit.getCurrentStreak());
        assertEquals(0, habit.getConsecutiveMisses());
    }

    @Test
    void replayHalvesTheCostOfAnExcusedMiss() {
        Habit habit = habit(5);
        List<HabitLog> history = logs("DM");
        history.get(1).setReason("was ill");
        history.get(1).setPointsAwarded(0); // force the delta to show the charge

        int delta = GameRules.replayDaily(habit, history, Set.of(day(2)));

        assertEquals(-5, delta);
    }

    @Test
    void replayRebuildsBestStreakFromTheWholeHistory() {
        Habit habit = habit(10);
        habit.setBestStreak(0);
        GameRules.replayDaily(habit, logs("DDDDMMD"), Set.of());

        assertEquals(4, habit.getBestStreak()); // the run before the two misses
        assertEquals(1, habit.getCurrentStreak());
    }
}
