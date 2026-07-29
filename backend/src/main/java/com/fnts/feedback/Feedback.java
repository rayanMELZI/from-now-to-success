package com.fnts.feedback;

import java.time.Instant;

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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "feedback")
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(nullable = false, columnDefinition = "text")
    private String message;

    /** Which page the user was on when they clicked feedback, e.g. "/checkin". */
    private String page;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FeedbackStatus status = FeedbackStatus.NEW;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "ai_summary", columnDefinition = "text")
    private String aiSummary;

    @Column(name = "ai_category")
    private String aiCategory;

    @Column(name = "ai_effort")
    private String aiEffort;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "ai_verdict", columnDefinition = "text")
    private String aiVerdict;

    /** The model's build/skip decision; null until a briefing succeeds. */
    @Column(name = "ai_worth_doing")
    private Boolean aiWorthDoing;

    /** Short imperative title for the GitHub issue (can restate the request). */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "ai_issue_title", columnDefinition = "text")
    private String aiIssueTitle;

    /** Set once a GitHub issue exists; also the guard against filing twice. */
    @Column(name = "github_issue_url", columnDefinition = "text")
    private String githubIssueUrl;

    /** Null while the briefing email is still owed. */
    @Column(name = "notified_at")
    private Instant notifiedAt;

    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "last_error", length = 500)
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;
}
