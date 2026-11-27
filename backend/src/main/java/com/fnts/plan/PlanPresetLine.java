package com.fnts.plan;

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

/** One line of a preset: what it is and the time it is finished, like a plan block. */
@Getter
@Setter
@Entity
@Table(name = "plan_preset_lines")
public class PlanPresetLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "preset_id")
    private PlanPreset preset;

    /** Minutes since midnight, 0..1439. */
    @Column(name = "end_minute", nullable = false)
    private int endMinute;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(nullable = false, columnDefinition = "text")
    private String title;

    /** The habit this line stands for; null for a plain line or a deleted habit. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "habit_id")
    private Habit habit;
}
