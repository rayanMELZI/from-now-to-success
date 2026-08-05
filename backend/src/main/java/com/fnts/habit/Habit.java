package com.fnts.habit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

import com.fnts.common.EncryptedStringConverter;
import com.fnts.user.User;

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
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "habits")
public class Habit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(nullable = false, columnDefinition = "text")
    private String name;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "base_points", nullable = false)
    private int basePoints = 10;

    @Column(name = "required_streak", nullable = false)
    private int requiredStreak = 7;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HabitStatus status = HabitStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HabitSchedule schedule = HabitSchedule.DAILY;

    @Enumerated(EnumType.STRING)
    @Column(name = "habit_type", nullable = false)
    private HabitType habitType = HabitType.BUILD;

    /** Completions needed per week/month (always 1 for daily habits). */
    @Column(name = "times_per_period", nullable = false)
    private int timesPerPeriod = 1;

    /** Period-start of the last week/month whose outcome hit gauge/streak. */
    @Column(name = "last_evaluated_period")
    private LocalDate lastEvaluatedPeriod;

    /** Validation progress: fills to requiredStreak, drops 1 per miss. */
    @Column(nullable = false)
    private int gauge = 0;

    @Column(name = "current_streak", nullable = false)
    private int currentStreak = 0;

    @Column(name = "best_streak", nullable = false)
    private int bestStreak = 0;

    @Column(name = "consecutive_misses", nullable = false)
    private int consecutiveMisses = 0;

    /** Tracking starts here; days before it are never counted as missed. */
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** User-chosen position in the check-in list; ties break on id. */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "habit_prerequisites",
            joinColumns = @JoinColumn(name = "habit_id"),
            inverseJoinColumns = @JoinColumn(name = "prerequisite_id"))
    private Set<Habit> prerequisites = new HashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;
}
