package com.fnts.checkin;

import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitTimerRunRepository extends JpaRepository<HabitTimerRun, Long> {

    /** Most recent runs first — the habit's relapse history. */
    List<HabitTimerRun> findByHabitIdOrderByEndedAtDesc(Long habitId, Limit limit);
}
