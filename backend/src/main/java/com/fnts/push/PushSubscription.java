package com.fnts.push;

import java.time.Instant;

import com.fnts.user.User;

import jakarta.persistence.Column;
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

@Getter
@Setter
@Entity
@Table(name = "push_subscriptions")
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    /** The browser-issued push URL; unique per browser+device+site. */
    @Column(nullable = false, unique = true, columnDefinition = "text")
    private String endpoint;

    @Column(nullable = false, columnDefinition = "text")
    private String p256dh;

    @Column(nullable = false, columnDefinition = "text")
    private String auth;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;
}
