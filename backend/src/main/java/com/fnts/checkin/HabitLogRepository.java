package com.fnts.checkin;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.fnts.habit.HabitSchedule;

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
              AND log.habit.schedule <> :excluded
              AND log.logDate >= :monthStart
            """)
    int countNormalFrozenSince(Long userId, LocalDate monthStart, HabitSchedule excluded);

    @Query("""
            SELECT COUNT(log) FROM HabitLog log
            WHERE log.habit.user.id = :userId AND log.frozen = true
              AND log.habit.schedule = :schedule
              AND log.logDate >= :quarterStart
            """)
    int countFrozenBySchedule(Long userId, LocalDate quarterStart, HabitSchedule schedule);

    @Query("""
            SELECT COUNT(log) FROM HabitLog log
            WHERE log.habit.id = :habitId AND log.status = 'MISSED'
              AND log.logDate >= :from AND log.logDate < :toExclusive
            """)
    int countMissedInPeriod(Long habitId, LocalDate from, LocalDate toExclusive);

    @Query("""
            SELECT COUNT(log) FROM HabitLog log
            WHERE log.habit.id = :habitId AND log.status = 'DONE'
              AND log.logDate >= :from AND log.logDate < :toExclusive
            """)
    int countDoneInPeriod(Long habitId, LocalDate from, LocalDate toExclusive);
}
