package com.fnts.user;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String role = "USER";

    @Column(name = "total_points", nullable = false)
    private int totalPoints = 0;

    @Column(nullable = false)
    private String timezone = "UTC";

    @Column(name = "reminder_hour", nullable = false)
    private int reminderHour = 21;

    /** "My day ends at this hour": 3 means 01:00 still counts as yesterday. */
    @Column(name = "day_end_hour", nullable = false)
    private int dayEndHour = 0;

    /** ISO day-of-week: 1 = Monday ... 7 = Sunday. */
    @Column(name = "week_start_day", nullable = false)
    private int weekStartDay = 1;

    /** Opt-in: the daily plan page stays hidden until the user asks for it. */
    @Column(name = "planner_enabled", nullable = false)
    private boolean plannerEnabled = false;

    /** Each new day opens with a copy of the last plan — the routine. */
    @Column(name = "plan_repeat_daily", nullable = false)
    private boolean planRepeatDaily = false;

    /** The last day seeded from the routine; a day cleared on purpose stays clear. */
    @Column(name = "plan_seeded_date")
    private LocalDate planSeededDate;

    @Column(name = "last_reminder_date")
    private LocalDate lastReminderDate;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;
}
