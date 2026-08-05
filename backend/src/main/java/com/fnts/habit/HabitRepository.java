package com.fnts.habit;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitRepository extends JpaRepository<Habit, Long> {

    /** Manual order first; id breaks ties so the listing is always stable. */
    List<Habit> findByUserIdOrderBySortOrderAscIdAsc(Long userId);

    Optional<Habit> findByIdAndUserId(Long id, Long userId);

    List<Habit> findByUserIdAndStatusInOrderBySortOrderAscIdAsc(Long userId, List<HabitStatus> statuses);

    Optional<Habit> findTopByUserIdOrderBySortOrderDesc(Long userId);
}
