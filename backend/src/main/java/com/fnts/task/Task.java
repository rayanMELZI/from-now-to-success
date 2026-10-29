package com.fnts.task;

import java.time.Instant;
import java.time.LocalDate;

import com.fnts.common.EncryptedStringConverter;
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
 * A one-off thing to get done. No rhythm, no points: once it is ticked it is
 * simply finished — and can be unticked if that was a slip.
 */
@Getter
@Setter
@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(nullable = false, columnDefinition = "text")
    private String title;

    /** The day it should be done by; null when there is no deadline. */
    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(nullable = false)
    private boolean done = false;

    /** When it was ticked, so finished tasks can be listed most recent first. */
    @Column(name = "done_at")
    private Instant doneAt;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    /** Ticks or unticks the task, keeping the moment it was finished in step. */
    public void markDone(boolean value) {
        if (value == done) return;
        done = value;
        doneAt = value ? Instant.now() : null;
    }
}
