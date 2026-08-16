package com.fnts.plan;

import java.time.Instant;
import java.time.LocalDate;

import com.fnts.common.EncryptedStringConverter;
import com.fnts.habit.Habit;
import com.fnts.user.User;

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

/**
 * One line of the day's plan: a thing and the time it is FINISHED. A block
 * runs from the end of the one before it, so a plan is an ordered list of
 * finish times — and the first line's start is simply unknown.
 */
@Getter
@Setter
@Entity
@Table(name = "plan_blocks")
public class PlanBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "plan_date", nullable = false)
    private LocalDate planDate;

    /** When this is done, in minutes since midnight, 0..1439. */
    @Column(name = "end_minute", nullable = false)
    private int endMinute;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(nullable = false, columnDefinition = "text")
    private String title;

    /**
     * The habit this block stands for, when it was picked from the roadmap
     * instead of typed. Null for plain blocks (and for blocks whose habit was
     * deleted — the line keeps its title either way).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "habit_id")
    private Habit habit;

    @Column(nullable = false)
    private boolean done = false;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;
}
