package com.fnts.habit;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.CheckinService;
import com.fnts.checkin.Periods;
import com.fnts.common.ApiException;
import com.fnts.habit.HabitDtos.HabitResponse;

/**
 * Puts a branch of the roadmap away and brings it back. An archived habit is
 * not deleted: its gauge, streaks, record and history stay exactly as they
 * were, it just stops being asked about until the user wants it again.
 */
@Service
public class ArchiveService {

    private final HabitRepository habitRepository;
    private final HabitService habitService;
    private final CheckinService checkinService;

    public ArchiveService(HabitRepository habitRepository,
                          HabitService habitService,
                          CheckinService checkinService) {
        this.habitRepository = habitRepository;
        this.habitService = habitService;
        this.checkinService = checkinService;
    }

    /** Archives the habit and every habit that depends on it. */
    @Transactional
    public List<HabitResponse> archive(Long userId, Long habitId) {
        Habit root = habitService.getOwned(userId, habitId);
        if (root.getArchivedAt() != null) {
            throw ApiException.badRequest("This habit is already archived");
        }
        // Whatever the branch owes up to now is settled before it is frozen.
        checkinService.catchUp(userId);

        // One shared instant marks the branch, so restoring it brings back
        // exactly this set. Microseconds: what the database keeps.
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        List<Habit> all = habitRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
        for (Habit habit : Branches.branch(root, all)) {
            if (habit.getArchivedAt() == null) {
                habit.setArchivedAt(now);
            }
        }
        return all.stream().map(HabitDtos::toResponse).toList();
    }

    /** Brings an archived habit back, with the branch that was put away with it. */
    @Transactional
    public List<HabitResponse> restore(Long userId, Long habitId) {
        Habit root = habitService.getOwned(userId, habitId);
        if (root.getArchivedAt() == null) {
            throw ApiException.badRequest("This habit is not archived");
        }
        root.getPrerequisites().stream()
                .filter(p -> p.getArchivedAt() != null)
                .findFirst()
                .ifPresent(p -> {
                    throw ApiException.badRequest(
                            "It needs \"" + p.getName() + "\", which is archived — restore that first");
                });

        Instant now = Instant.now();
        LocalDate today = Periods.logicalToday(root.getUser());
        List<Habit> all = habitRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
        Set<Habit> restored = Branches.restorable(root, all);
        for (Habit habit : restored) {
            comeBack(habit, now, today);
        }
        habitService.syncLockStates(userId, today);
        return all.stream().map(HabitDtos::toResponse).toList();
    }

    /**
     * The time away is a pause, not a gap: no day of it counts as missed, and
     * a timer picks up from where its clock stood when it was put away.
     */
    static void comeBack(Habit habit, Instant now, LocalDate today) {
        if (habit.getTrackingMode() == TrackingMode.TIMER && habit.getClockStartedAt() != null) {
            Duration away = Duration.between(habit.getArchivedAt(), now);
            if (!away.isNegative()) {
                habit.setClockStartedAt(habit.getClockStartedAt().plus(away));
            }
        }
        // The catch-up never asks about days before the start date.
        habit.setStartDate(today);
        habit.setArchivedAt(null);
    }
}
