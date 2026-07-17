package com.fnts.checkin;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface HabitLogRepository extends JpaRepository<HabitLog, Long> {

    Optional<HabitLog> findByHabitIdAndLogDate(Long habitId, LocalDate logDate);

    Optional<HabitLog> findTopByHabitIdOrderByLogDateDesc(Long habitId);

    boolean existsByHabitIdAndLogDate(Long habitId, LocalDate logDate);

    List<HabitLog> findByHabitIdInAndLogDate(List<Long> habitIds, LocalDate logDate);

    @Query("""
            SELECT log FROM HabitLog log
            WHERE log.habit.user.id = :userId AND log.logDate >= :from
            ORDER BY log.logDate ASC
            """)
    List<HabitLog> findRecentForUser(Long userId, LocalDate from);

    @Query("""
            SELECT COUNT(log) FROM HabitLog log
            WHERE log.habit.user.id = :userId AND log.frozen = true
              AND log.logDate >= :monthStart
            """)
    int countFrozenSince(Long userId, LocalDate monthStart);
}
