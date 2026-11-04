package com.fnts.habit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

class ArchiveTest {

    private static final Instant T1 = Instant.parse("2026-10-01T10:00:00Z");
    private static final Instant T2 = Instant.parse("2026-10-05T10:00:00Z");

    private static Habit habit(long id, Habit... prerequisites) {
        Habit habit = new Habit();
        habit.setId(id);
        habit.getPrerequisites().addAll(List.of(prerequisites));
        return habit;
    }

    @Test
    void aBranchIsTheHabitAndEverythingDownstream() {
        Habit a = habit(1);
        Habit b = habit(2, a);
        Habit c = habit(3, b);
        Habit other = habit(4);
        Habit d = habit(5, b, other);

        assertEquals(Set.of(a, b, c, d), Branches.branch(a, List.of(a, b, c, other, d)));
        assertEquals(Set.of(b, c, d), Branches.branch(b, List.of(a, b, c, other, d)));
        assertEquals(Set.of(other, d), Branches.branch(other, List.of(a, b, c, other, d)));
    }

    @Test
    void restoringBringsBackWhatWasArchivedWithIt() {
        Habit a = habit(1);
        Habit b = habit(2, a);
        Habit c = habit(3, b);
        a.setArchivedAt(T2);
        b.setArchivedAt(T2);
        c.setArchivedAt(T2);

        assertEquals(Set.of(a, b, c), Branches.restorable(a, List.of(a, b, c)));
    }

    @Test
    void aSubBranchArchivedEarlierStaysPutAway() {
        Habit a = habit(1);
        Habit b = habit(2, a);
        Habit c = habit(3, b);
        b.setArchivedAt(T1);
        c.setArchivedAt(T1);
        a.setArchivedAt(T2);

        assertEquals(Set.of(a), Branches.restorable(a, List.of(a, b, c)));
    }

    @Test
    void aHabitStillWaitingOnAnArchivedOneStaysPutAway() {
        Habit a = habit(1);
        Habit other = habit(2);
        Habit d = habit(3, a, other);
        other.setArchivedAt(T1);
        d.setArchivedAt(T1);
        a.setArchivedAt(T2);

        assertEquals(Set.of(a), Branches.restorable(a, List.of(a, other, d)));
    }

    @Test
    void comingBackForgivesTheTimeAway() {
        Habit daily = habit(1);
        daily.setStartDate(LocalDate.parse("2026-09-01"));
        daily.setArchivedAt(T1);

        ArchiveService.comeBack(daily, T2, LocalDate.parse("2026-10-05"));

        assertEquals(LocalDate.parse("2026-10-05"), daily.getStartDate());
        assertNull(daily.getArchivedAt());
    }

    @Test
    void aTimerPicksUpWhereItsClockStood() {
        Habit timer = habit(1);
        timer.setTrackingMode(TrackingMode.TIMER);
        timer.setClockStartedAt(Instant.parse("2026-09-30T10:00:00Z")); // one day clean
        timer.setArchivedAt(T1);

        ArchiveService.comeBack(timer, T2, LocalDate.parse("2026-10-05"));

        // Four days away: still one day clean on its return.
        assertEquals(Instant.parse("2026-10-04T10:00:00Z"), timer.getClockStartedAt());
    }
}
