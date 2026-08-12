package com.fnts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.function.Predicate;

import org.junit.jupiter.api.Test;

import com.fnts.checkin.Swaps;
import com.fnts.habit.Habit;
import com.fnts.habit.HabitType;

class SwapsTest {

    private Habit habit(long id, String name, HabitType type) {
        Habit habit = new Habit();
        habit.setId(id);
        habit.setName(name);
        habit.setHabitType(type);
        return habit;
    }

    /** A quit habit and the build habit that stands in for it. */
    private List<Habit> pair() {
        Habit good = habit(2, "walk", HabitType.BUILD);
        Habit bad = habit(1, "smoking", HabitType.QUIT);
        bad.setReplacement(good);
        return List.of(bad, good);
    }

    private Predicate<Habit> doneToday(Long... ids) {
        Set<Long> done = Set.of(ids);
        return habit -> done.contains(habit.getId());
    }

    @Test
    void pairClosesWhenBothSidesCameTrue() {
        List<Swaps.Pair> pairs =
                Swaps.completed(pair(), Set.of(2L), doneToday(1L, 2L));

        assertEquals(1, pairs.size());
        assertEquals("smoking", pairs.get(0).quit().getName());
        assertEquals("walk", pairs.get(0).replacement().getName());
    }

    @Test
    void eitherSideCanCloseThePair() {
        // Same day, but this time the bad habit is the one just answered.
        assertEquals(1, Swaps.completed(pair(), Set.of(1L), doneToday(1L, 2L)).size());
    }

    @Test
    void avoidingTheBadHabitAloneIsNotASwap() {
        assertTrue(Swaps.completed(pair(), Set.of(1L), doneToday(1L)).isEmpty());
    }

    @Test
    void doingTheGoodHabitAloneIsNotASwap() {
        assertTrue(Swaps.completed(pair(), Set.of(2L), doneToday(2L)).isEmpty());
    }

    @Test
    void bonusIsNotPaidAgainLaterInTheDay() {
        // Both sides are long done; this request answered some third habit, so
        // the pair did not close now and must not pay twice.
        assertTrue(Swaps.completed(pair(), Set.of(9L), doneToday(1L, 2L)).isEmpty());
    }

    @Test
    void unpairedHabitsAreIgnored() {
        List<Habit> habits = List.of(
                habit(1, "smoking", HabitType.QUIT),
                habit(2, "walk", HabitType.BUILD));

        assertTrue(Swaps.completed(habits, Set.of(1L, 2L), doneToday(1L, 2L)).isEmpty());
    }
}
