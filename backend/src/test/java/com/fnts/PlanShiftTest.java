package com.fnts;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fnts.plan.PlanShift;

class PlanShiftTest {

    /** 07:00, 08:30, 12:00 — a normal morning, day ending at midnight. */
    private static final List<Integer> MORNING = List.of(420, 510, 720);

    @Test
    void aShiftThatFitsIsTakenAsAskedFor() {
        assertEquals(60, PlanShift.fittedDelta(MORNING, 60, 0));
        assertEquals(-60, PlanShift.fittedDelta(MORNING, -60, 0));
        assertEquals(0, PlanShift.fittedDelta(MORNING, 0, 0));
    }

    @Test
    void theSelectionKeepsItsShape() {
        List<Integer> moved = MORNING.stream().map(m -> PlanShift.shifted(m, -60, 0)).toList();
        assertEquals(List.of(360, 450, 660), moved); // 06:00, 07:30, 11:00
    }

    @Test
    void movingEarlierStopsAtTheStartOfTheDay() {
        // The earliest line sits at 07:00, so only 7 hours of room exist.
        assertEquals(-420, PlanShift.fittedDelta(MORNING, -600, 0));
        assertEquals(0, PlanShift.shifted(420, -420, 0));
    }

    @Test
    void movingLaterStopsAtTheEndOfTheDay() {
        // The latest line sits at 12:00, so 11h59 of room is left.
        assertEquals(719, PlanShift.fittedDelta(MORNING, 900, 0));
        assertEquals(1439, PlanShift.shifted(720, 719, 0));
    }

    @Test
    void theEdgesAreTheUsersOwnDayNotMidnight() {
        // dayEndHour 4: the day runs 04:00 → 03:59, so 03:45 is nearly out of
        // room going later — and 04:00 is the very start, with none going back.
        assertEquals(14, PlanShift.fittedDelta(List.of(225), 60, 4));
        assertEquals(239, PlanShift.shifted(225, 14, 4)); // 03:59
        assertEquals(0, PlanShift.fittedDelta(List.of(240), -60, 4));
        // A line in the small hours still has the whole night behind it.
        assertEquals(-60, PlanShift.fittedDelta(List.of(60), -60, 4));
        assertEquals(0, PlanShift.shifted(60, -60, 4)); // 00:00
    }

    @Test
    void aLineCanCrossMidnightInsideTheUsersDay() {
        // dayEndHour 4 again: 23:30 pushed an hour later is 00:30, still the
        // same night — not a jump to the top of the plan.
        assertEquals(30, PlanShift.shifted(1410, 60, 4));
    }
}
