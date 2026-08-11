package com.fnts.habit;

/**
 * How a habit is tracked. The mode decides which engine moves the gauge —
 * everything else about a habit (points, prerequisites, validation, the
 * roadmap) works the same way whichever mode it is in.
 */
public enum TrackingMode {
    /** The original: a daily/weekly/monthly question answered at check-in. */
    SCHEDULED,
    /** A clock the user resets on every relapse; milestones fill the gauge. */
    TIMER
}
