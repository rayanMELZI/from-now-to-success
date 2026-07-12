package com.fnts.habit;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitRepository extends JpaRepository<Habit, Long> {

    List<Habit> findByUserIdOrderByIdAsc(Long userId);

    Optional<Habit> findByIdAndUserId(Long id, Long userId);

    List<Habit> findByUserIdAndStatusInOrderByIdAsc(Long userId, List<HabitStatus> statuses);
}
