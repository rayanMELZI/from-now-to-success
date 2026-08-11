package com.fnts.checkin;

import java.util.ArrayList;
import java.util.List;

/**
 * The milestone ladder of a timer habit.
 *
 * A timer habit does not count days done — it counts how far the current
 * clean run has climbed. The rungs are the human durations people actually
 * celebrate (a day, a week, a month…), cut off at the habit's own goal,
 * which is always the last rung. Reaching every rung validates the habit.
 */
public final class Milestones {

    private static final long HOUR = 3600L;
    private static final long DAY = 24 * HOUR;

    private static final long[] RUNGS = {
            HOUR,
            6 * HOUR,
            12 * HOUR,
            DAY,
            3 * DAY,
            7 * DAY,
            14 * DAY,
            30 * DAY,
            90 * DAY,
            180 * DAY,
            365 * DAY,
    };

    /** Every rung strictly below the goal, then the goal itself. */
    public static List<Long> ladder(long goalSeconds) {
        List<Long> steps = new ArrayList<>();
        for (long rung : RUNGS) {
            if (rung < goalSeconds) {
                steps.add(rung);
            }
        }
        steps.add(goalSeconds);
        return steps;
    }

    /** How many rungs a run of this length has passed. */
    public static int reached(List<Long> ladder, long elapsedSeconds) {
        int count = 0;
        for (long step : ladder) {
            if (elapsedSeconds >= step) {
                count++;
            }
        }
        return count;
    }

    /** The next rung to aim for, or 0 once the goal is behind you. */
    public static long next(List<Long> ladder, long elapsedSeconds) {
        for (long step : ladder) {
            if (elapsedSeconds < step) {
                return step;
            }
        }
        return 0;
    }

    private Milestones() {}
}
