package com.fnts.checkin;

import java.time.Instant;

import com.fnts.common.EncryptedStringConverter;
import com.fnts.habit.Habit;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** One finished run of a timer habit: how long it lasted before the relapse. */
@Getter
@Setter
@Entity
@Table(name = "habit_timer_runs")
public class HabitTimerRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id")
    private Habit habit;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at", nullable = false)
    private Instant endedAt;

    @Column(name = "duration_seconds", nullable = false)
    private long durationSeconds;

    /** Milestones this run had banked before it ended. */
    @Column(name = "milestones_hit", nullable = false)
    private int milestonesHit = 0;

    /** What happened, in the user's words; halves the relapse penalty. */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(columnDefinition = "text")
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;
}
