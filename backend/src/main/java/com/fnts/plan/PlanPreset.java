package com.fnts.plan;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.fnts.common.EncryptedStringConverter;
import com.fnts.user.User;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * A named day template ("Workday", "Gym day"): a list of plan lines without
 * a date, that an empty day can be started from.
 */
@Getter
@Setter
@Entity
@Table(name = "plan_presets")
public class PlanPreset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(nullable = false, columnDefinition = "text")
    private String name;

    /** Saving a preset replaces its lines wholesale, so orphans go with them. */
    @OneToMany(mappedBy = "preset", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("endMinute ASC, id ASC")
    private List<PlanPresetLine> lines = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;
}
