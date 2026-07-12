package com.fnts.user;

/** Level curve: every 500 points is one level. Level 1 at 0 points. */
public final class Levels {

    public static final int POINTS_PER_LEVEL = 500;

    public static int levelFor(int totalPoints) {
        return totalPoints / POINTS_PER_LEVEL + 1;
    }

    public static int pointsIntoLevel(int totalPoints) {
        return totalPoints % POINTS_PER_LEVEL;
    }

    private Levels() {}
}
