package com.fnts.habit;

import java.time.LocalDate;
import java.time.ZoneId;
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

import com.fnts.common.ApiException;
import com.fnts.habit.HabitDtos.HabitRequest;
import com.fnts.habit.HabitDtos.HabitResponse;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

@Service
public class HabitService {

    private final HabitRepository habitRepository;
    private final UserRepository userRepository;

    public HabitService(HabitRepository habitRepository, UserRepository userRepository) {
        this.habitRepository = habitRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<HabitResponse> list(Long userId) {
        return habitRepository.findByUserIdOrderBySortOrderAscIdAsc(userId).stream()
                .map(HabitDtos::toResponse)
                .toList();
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
    }

    private void applyRequest(Habit habit, HabitRequest request, Long userId) {
        habit.setName(request.name());
        habit.setDescription(request.description());
        if (request.basePoints() != null) {
            habit.setBasePoints(request.basePoints());
        }
        if (request.requiredStreak() != null) {
            habit.setRequiredStreak(request.requiredStreak());
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
