package com.fnts.habit;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitRepository extends JpaRepository<Habit, Long> {

    /** Manual order first; id breaks ties so the listing is always stable. */
    List<Habit> findByUserIdOrderBySortOrderAscIdAsc(Long userId);

    Optional<Habit> findByIdAndUserId(Long id, Long userId);

    List<Habit> findByUserIdAndStatusInOrderBySortOrderAscIdAsc(Long userId, List<HabitStatus> statuses);

    /** Scheduled and timer habits never share a code path — always ask for one. */
    List<Habit> findByUserIdAndTrackingModeAndStatusInOrderBySortOrderAscIdAsc(
            Long userId, TrackingMode trackingMode, List<HabitStatus> statuses);

    Optional<Habit> findTopByUserIdOrderBySortOrderDesc(Long userId);

    /** The quit habits this one stands in for — the pairing seen backwards. */
    List<Habit> findByUserIdAndReplacementId(Long userId, Long replacementId);
}
