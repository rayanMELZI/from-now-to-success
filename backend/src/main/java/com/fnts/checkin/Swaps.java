package com.fnts.checkin;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;

import com.fnts.habit.Habit;

/**
 * The swap: a habit you are quitting paired with the good habit you do in
 * its place. Dropping a bad habit leaves an empty slot in the day, and the
 * pairing is the app's answer to "then what?".
 *
 * The pair pays a bonus on the day BOTH sides come true — the bad habit
 * avoided and its replacement done. It is paid exactly once per day: a habit
 * can only be answered once a day, so the pair closes on whichever of the two
 * is answered second, and only that request sees both sides done.
 */
public final class Swaps {

    /** A closed pair: the habit avoided and the one done instead. */
    public record Pair(Habit quit, Habit replacement) {}

    /**
     * The pairs that closed in the request being handled.
     *
     * @param habits      the habits in play (a timer habit is never answered,
     *                    so its pairing is a nudge at the slip, not a bonus)
     * @param answeredNow ids answered in this request — keeps the bonus to the
     *                    moment the pair closes instead of paying it all day
     * @param doneToday   whether a habit was ticked off today
     */
    public static List<Pair> completed(List<Habit> habits,
                                       Set<Long> answeredNow,
                                       Predicate<Habit> doneToday) {
        List<Pair> pairs = new ArrayList<>();
        for (Habit quit : habits) {
            Habit replacement = quit.getReplacement();
            if (replacement == null) {
                continue;
            }
            if (!answeredNow.contains(quit.getId())
                    && !answeredNow.contains(replacement.getId())) {
                continue;
            }
            if (doneToday.test(quit) && doneToday.test(replacement)) {
                pairs.add(new Pair(quit, replacement));
            }
        }
        return pairs;
    }

    private Swaps() {}
}
