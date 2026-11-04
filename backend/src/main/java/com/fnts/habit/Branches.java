package com.fnts.habit;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A branch of the roadmap: a habit and everything that, directly or through
 * other habits, requires it. Archiving works on whole branches, because a
 * habit left on the map with its prerequisite put away could never unlock.
 */
public final class Branches {

    /** The habit itself and every habit downstream of it. */
    public static Set<Habit> branch(Habit root, Collection<Habit> all) {
        Map<Long, List<Habit>> dependents = dependents(all);
        Set<Habit> branch = new LinkedHashSet<>();
        Deque<Habit> toVisit = new ArrayDeque<>(List.of(root));
        Set<Long> seen = new HashSet<>();
        while (!toVisit.isEmpty()) {
            Habit current = toVisit.pop();
            if (!seen.add(current.getId())) {
                continue;
            }
            branch.add(current);
            toVisit.addAll(dependents.getOrDefault(current.getId(), List.of()));
        }
        return branch;
    }

    /**
     * What restoring an archived habit brings back: the habits put away along
     * with it (same moment or later), never a sub-branch that was archived on
     * its own before, and never a habit that still needs something left in
     * the archive — it would sit on the map locked for good.
     */
    public static Set<Habit> restorable(Habit root, Collection<Habit> all) {
        Instant since = root.getArchivedAt();
        Set<Habit> restore = new LinkedHashSet<>();
        if (since == null) {
            return restore;
        }
        for (Habit habit : branch(root, all)) {
            if (habit.getArchivedAt() != null && !habit.getArchivedAt().isBefore(since)) {
                restore.add(habit);
            }
        }
        boolean changed = true;
        while (changed) {
            changed = restore.removeIf(habit -> habit != root
                    && habit.getPrerequisites().stream().anyMatch(p ->
                            p.getArchivedAt() != null && !restore.contains(p)));
        }
        return restore;
    }

    private static Map<Long, List<Habit>> dependents(Collection<Habit> all) {
        Map<Long, List<Habit>> dependents = new HashMap<>();
        for (Habit habit : all) {
            for (Habit prerequisite : habit.getPrerequisites()) {
                dependents.computeIfAbsent(prerequisite.getId(), id -> new ArrayList<>())
                        .add(habit);
            }
        }
        return dependents;
    }

    private Branches() {}
}
