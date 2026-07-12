package com.fnts.habit;

public enum HabitStatus {
    /** Prerequisites not yet valid; not tracked, not shown in check-ins. */
    LOCKED,
    /** Being tracked daily, building a streak toward validation. */
    ACTIVE,
    /** Streak goal reached; still tracked, and it unlocks dependent habits. */
    VALID
}
