package com.fnts.habit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.GameRules;
import com.fnts.checkin.Milestones;
import com.fnts.common.ApiException;
import com.fnts.habit.HabitDtos.HabitRequest;
import com.fnts.habit.HabitDtos.HabitResponse;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

@Service
public class HabitService {

    private static final List<HabitStatus> TRACKABLE =
            List.of(HabitStatus.ACTIVE, HabitStatus.VALID);

    private final HabitRepository habitRepository;
    private final UserRepository userRepository;

    public HabitService(HabitRepository habitRepository, UserRepository userRepository) {
        this.habitRepository = habitRepository;
        this.userRepository = userRepository;
    }

    /** What the running clocks earned while nobody was looking. */
    public record TimerCatchUp(int points, List<String> becameValid) {}

    // Not readOnly: reading the roadmap also banks any milestone the running
    // clocks passed since the last request.
    @Transactional
    public List<HabitResponse> list(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        advanceTimers(user, Instant.now());
        return habitRepository.findByUserIdOrderBySortOrderAscIdAsc(userId).stream()
                .map(HabitDtos::toResponse)
                .toList();
    }

    /**
     * Banks the milestones every running timer has passed. Timer habits have
     * nothing to answer, so this is what moves them: it runs before any read
     * or write, exactly like the check-in catch-up does for scheduled habits.
     */
    @Transactional
    public TimerCatchUp advanceTimers(User user, Instant now) {
        return advanceTimers(user, now, null);
    }

    /**
     * The same catch-up, with one habit held back. A backdated relapse needs
     * this: the other clocks are honestly clean up to {@code now}, but the one
     * being reset only earned up to the moment of the slip, so its caller
     * advances it separately rather than letting this loop overshoot.
     */
    @Transactional
    public TimerCatchUp advanceTimers(User user, Instant now, Long skipHabitId) {
        int earned = 0;
        List<String> becameValid = new ArrayList<>();

        for (Habit habit : habitRepository
                .findByUserIdAndTrackingModeAndStatusInOrderBySortOrderAscIdAsc(
                        user.getId(), TrackingMode.TIMER, TRACKABLE)) {
            if (habit.getId().equals(skipHabitId)) {
                continue;
            }
            GameRules.TimerResult result = GameRules.advanceTimer(habit, now);
            earned += result.points();
            if (result.becameValid()) {
                becameValid.add(habit.getName());
            }
        }
        if (earned != 0) {
            user.setTotalPoints(Math.max(0, user.getTotalPoints() + earned));
        }
        if (!becameValid.isEmpty()) {
            syncLockStates(user.getId(), today(user));
        }
        return new TimerCatchUp(earned, becameValid);
    }

    @Transactional
    public HabitResponse create(Long userId, HabitRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        Habit habit = new Habit();
        habit.setUser(user);
        applyRequest(habit, request, userId);

        boolean unlocked = habit.getPrerequisites().stream()
                .allMatch(p -> p.getStatus() == HabitStatus.VALID);
        habit.setStatus(unlocked ? HabitStatus.ACTIVE : HabitStatus.LOCKED);
        habit.setStartDate(today(user));
        if (unlocked) {
            startClock(habit);
        }
        // New habits land at the bottom of the user's manual order.
        habit.setSortOrder(habitRepository.findTopByUserIdOrderBySortOrderDesc(userId)
                .map(last -> last.getSortOrder() + 1)
                .orElse(1));

        return HabitDtos.toResponse(habitRepository.save(habit));
    }

    @Transactional
    public HabitResponse update(Long userId, Long habitId, HabitRequest request) {
        Habit habit = getOwned(userId, habitId);
        applyRequest(habit, request, userId);
        assertNoCycle(habit);
        syncLockStates(userId, today(habit.getUser()));
        // A habit that just turned into a timer starts ticking right away —
        // unless it is locked, where unlock() will start it later.
        if (habit.getTrackingMode() == TrackingMode.TIMER
                && habit.getStatus() != HabitStatus.LOCKED
                && habit.getClockStartedAt() == null) {
            startClock(habit);
        }
        return HabitDtos.toResponse(habit);
    }

    /**
     * Applies a user-chosen order. The request may cover only part of the
     * habits (the check-in list hides LOCKED ones), so the moved habits take
     * over the slots that subset already occupied — untouched habits keep
     * their exact place in the overall list.
     */
    @Transactional
    public List<HabitResponse> reorder(Long userId, List<Long> habitIds) {
        List<Habit> all = habitRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
        // Rows migrated from before this feature can share a sort_order; make
        // the positions dense and distinct first so slot swapping is well-defined.
        for (int i = 0; i < all.size(); i++) {
            all.get(i).setSortOrder(i + 1);
        }

        Map<Long, Habit> byId = all.stream()
                .collect(Collectors.toMap(Habit::getId, habit -> habit));
        List<Habit> moved = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (Long habitId : habitIds) {
            if (!seen.add(habitId)) {
                throw ApiException.badRequest("Duplicate habit in the new order");
            }
            Habit habit = byId.get(habitId);
            if (habit == null) {
                throw ApiException.notFound("Habit not found");
            }
            moved.add(habit);
        }

        List<Integer> slots = moved.stream().map(Habit::getSortOrder).sorted().toList();
        for (int i = 0; i < moved.size(); i++) {
            moved.get(i).setSortOrder(slots.get(i));
        }

        return all.stream()
                .sorted(Comparator.comparingInt(Habit::getSortOrder).thenComparing(Habit::getId))
                .map(HabitDtos::toResponse)
                .toList();
    }

    @Transactional
    public void delete(Long userId, Long habitId) {
        Habit habit = getOwned(userId, habitId);
        // Other habits may reference this one as a prerequisite; detach those links first.
        for (Habit other : habitRepository.findByUserIdOrderBySortOrderAscIdAsc(userId)) {
            other.getPrerequisites().remove(habit);
        }
        habitRepository.delete(habit);
        syncLockStates(userId, today(habit.getUser()));
    }

    /**
     * Enforces the lock invariant over ALL of the user's habits, in both
     * directions: a non-VALID habit is LOCKED if and only if any of its
     * prerequisites is not VALID. Returns the names of habits that unlocked.
     * (VALID habits never lock; validation is earned and only the gauge/miss
     * rules can take it away.)
     */
    @Transactional
    public List<String> syncLockStates(Long userId, LocalDate today) {
        List<String> unlockedNames = new ArrayList<>();
        for (Habit habit : habitRepository.findByUserIdOrderBySortOrderAscIdAsc(userId)) {
            if (habit.getStatus() == HabitStatus.VALID) {
                continue;
            }
            boolean eligible = habit.getPrerequisites().stream()
                    .allMatch(p -> p.getStatus() == HabitStatus.VALID);
            if (eligible && habit.getStatus() == HabitStatus.LOCKED) {
                unlock(habit, today);
                unlockedNames.add(habit.getName());
            } else if (!eligible && habit.getStatus() == HabitStatus.ACTIVE) {
                habit.setStatus(HabitStatus.LOCKED);
            }
        }
        return unlockedNames;
    }

    public Habit getOwned(Long userId, Long habitId) {
        return habitRepository.findByIdAndUserId(habitId, userId)
                .orElseThrow(() -> ApiException.notFound("Habit not found"));
    }

    private void unlock(Habit habit, LocalDate today) {
        habit.setStatus(HabitStatus.ACTIVE);
        // Tracking (and therefore missing) only starts on the unlock day.
        habit.setStartDate(today);
        startClock(habit);
    }

    /**
     * The timer half of a habit request. The gauge of a timer habit counts
     * milestones, so the goal — not the user — decides how tall it is.
     */
    private void applyTimerRequest(Habit habit, HabitRequest request, TrackingMode wasMode) {
        if (request.goalSeconds() != null) {
            habit.setGoalSeconds(request.goalSeconds());
        } else if (habit.getGoalSeconds() == null) {
            throw ApiException.badRequest("A timer habit needs a goal duration");
        }
        habit.setRequiredStreak(Milestones.ladder(habit.getGoalSeconds()).size());
        habit.setTimesPerPeriod(1);

        if (wasMode != TrackingMode.TIMER) {
            // Fresh clock: create() and unlock() start it once the habit is tracked.
            habit.setClockStartedAt(null);
            resetProgress(habit);
        } else {
            // A changed goal reshapes the ladder — never leave the gauge past its top.
            habit.setGauge(Math.min(habit.getGauge(), habit.getRequiredStreak()));
        }
    }

    private void resetProgress(Habit habit) {
        habit.setGauge(0);
        habit.setCurrentStreak(0);
        habit.setRecordBonusPaid(false);
    }

    /** A timer habit's clock only runs while the habit is actually tracked. */
    private void startClock(Habit habit) {
        if (habit.getTrackingMode() != TrackingMode.TIMER) {
            return;
        }
        habit.setClockStartedAt(Instant.now());
        habit.setGauge(0);
        habit.setRecordBonusPaid(false);
    }

    private void applyRequest(Habit habit, HabitRequest request, Long userId) {
        habit.setName(request.name());
        habit.setDescription(request.description());
        if (request.basePoints() != null) {
            habit.setBasePoints(request.basePoints());
        }
        if (request.schedule() != null) {
            habit.setSchedule(request.schedule());
        }
        if (request.habitType() != null) {
            habit.setHabitType(request.habitType());
        }
        if (request.timesPerPeriod() != null) {
            habit.setTimesPerPeriod(request.timesPerPeriod());
        }

        TrackingMode wasMode = habit.getTrackingMode();
        if (request.trackingMode() != null) {
            habit.setTrackingMode(request.trackingMode());
        }
        if (habit.getTrackingMode() == TrackingMode.TIMER) {
            applyTimerRequest(habit, request, wasMode);
        } else {
            if (wasMode == TrackingMode.TIMER) {
                // Back to a scheduled habit: the clock and its ladder are void.
                habit.setClockStartedAt(null);
                habit.setGoalSeconds(null);
                resetProgress(habit);
            }
            if (request.requiredStreak() != null) {
                habit.setRequiredStreak(request.requiredStreak());
            } else if (wasMode == TrackingMode.TIMER) {
                habit.setRequiredStreak(7);
            }
        }

        // A daily habit is by definition once per day.
        if (habit.getSchedule() == HabitSchedule.DAILY) {
            habit.setTimesPerPeriod(1);
        }
        if (request.prerequisiteIds() != null) {
            Set<Habit> prerequisites = new HashSet<>();
            for (Long prereqId : request.prerequisiteIds()) {
                if (prereqId.equals(habit.getId())) {
                    throw ApiException.badRequest("A habit cannot be its own prerequisite");
                }
                prerequisites.add(getOwned(userId, prereqId));
            }
            habit.setPrerequisites(prerequisites);
        }
    }

    /** Rejects prerequisite chains that loop back to the habit itself. */
    private void assertNoCycle(Habit habit) {
        Deque<Habit> toVisit = new ArrayDeque<>(habit.getPrerequisites());
        Set<Long> seen = new HashSet<>();
        while (!toVisit.isEmpty()) {
            Habit current = toVisit.pop();
            if (current.getId().equals(habit.getId())) {
                throw ApiException.badRequest("Prerequisites form a cycle");
            }
            if (seen.add(current.getId())) {
                toVisit.addAll(current.getPrerequisites());
            }
        }
    }

    private LocalDate today(User user) {
        return com.fnts.checkin.Periods.logicalToday(user);
    }
}
