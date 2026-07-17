package com.fnts.habit;

public enum HabitSchedule {
    /** Done (or missed) every day. */
    DAILY,
    /** Done once per week; auto-missed when the week ends without it. */
    WEEKLY,
    /** Done once per month; auto-missed when the month ends without it. */
    MONTHLY
}
