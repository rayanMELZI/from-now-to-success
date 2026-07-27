package com.fnts.checkin;

import java.time.Instant;
import java.time.LocalDate;

import com.fnts.common.EncryptedStringConverter;
import com.fnts.habit.Habit;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "habit_logs",
        uniqueConstraints = @UniqueConstraint(columnNames = {"habit_id", "log_date"}))
public class HabitLog {

    public enum Status { DONE, MISSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id")
    private Habit habit;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(name = "points_awarded", nullable = false)
    private int pointsAwarded = 0;

    /** User-provided excuse for a miss; halves the point penalty. */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(columnDefinition = "text")
    private String reason;

    /** A streak freeze was spent on this miss: gauge and streak untouched. */
    @Column(nullable = false)
    private boolean frozen = false;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;
}
