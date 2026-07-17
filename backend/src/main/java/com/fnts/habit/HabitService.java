package com.fnts.habit;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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
        return habitRepository.findByUserIdOrderByIdAsc(userId).stream()
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

    @Transactional
    public void delete(Long userId, Long habitId) {
        Habit habit = getOwned(userId, habitId);
        // Other habits may reference this one as a prerequisite; detach those links first.
        for (Habit other : habitRepository.findByUserIdOrderByIdAsc(userId)) {
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
        for (Habit habit : habitRepository.findByUserIdOrderByIdAsc(userId)) {
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
        return LocalDate.now(ZoneId.of(user.getTimezone()));
    }
}
