package com.fnts.plan;

import java.util.List;

import com.fnts.checkin.Periods;

/**
 * Moving a handful of a day's blocks earlier or later, all together.
 *
 * The selection travels as ONE rigid piece: waking up an hour late does not
 * squash the morning, it slides it. So the asked-for shift is trimmed until
 * the whole selection fits inside the user's day, and every block then moves
 * by that same trimmed amount — the gaps between them never change.
 */
public final class PlanShift {

    /** Minutes in a day: a block sits at 0 (00:00) .. 1439 (23:59). */
    public static final int DAY_MINUTES = 24 * 60;

    /**
     * How far the selection can actually move, given where its earliest and
     * latest blocks already sit in the user's day. Returns the asked-for
     * delta when it fits, otherwise the largest shift in the same direction
     * that keeps every block inside the day.
     */
    public static int fittedDelta(List<Integer> endMinutes, int delta, int dayEndHour) {
        int earliest = DAY_MINUTES;
        int latest = 0;
        for (int minute : endMinutes) {
            int inDay = Periods.minuteOfUserDay(minute, dayEndHour);
            earliest = Math.min(earliest, inDay);
            latest = Math.max(latest, inDay);
        }
        // Room left on each side of the block of selected lines.
        return Math.max(-earliest, Math.min(delta, DAY_MINUTES - 1 - latest));
    }

    /** The wall-clock minute a block lands on once the day is slid by delta. */
    public static int shifted(int endMinute, int delta, int dayEndHour) {
        int moved = Periods.minuteOfUserDay(endMinute, dayEndHour) + delta;
        return Math.floorMod(moved + dayEndHour * 60, DAY_MINUTES);
    }

    private PlanShift() {}
}
