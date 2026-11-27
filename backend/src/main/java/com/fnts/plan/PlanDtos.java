package com.fnts.plan;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class PlanDtos {

    /** Minutes in a day: a start time is 0 (00:00) .. 1439 (23:59). */
    public static final int LAST_MINUTE = 1439;
    /** A day only holds so many lines; the cap keeps one user's day bounded. */
    public static final int MAX_BLOCKS_PER_DAY = 60;
    /** How far back the "copy another day" picker reaches. */
    public static final int MAX_COPY_SOURCES = 60;
    /** Enough for every kind of day a person lives, few enough to scan at a glance. */
    public static final int MAX_PRESETS = 30;

    public record BlockRequest(
            @NotBlank @Size(max = 120) String title,
            /** When this is finished; the block runs from the end of the one before. */
            @NotNull @Min(0) @Max(LAST_MINUTE) Integer endMinute,
            /** The habit this block stands for; null for a plain block. */
            Long habitId,
            /** The task this block stands for; null when it was not pulled from the list. */
            Long taskId) {}

    /** One line of a preset, as written in the preset editor or taken from a day. */
    public record PresetLineRequest(
            @NotBlank @Size(max = 120) String title,
            @NotNull @Min(0) @Max(LAST_MINUTE) Integer endMinute,
            /** The habit this line stands for; null for a plain line. */
            Long habitId) {}

    /** Creates or replaces a preset: its name and, wholesale, its lines. */
    public record PresetRequest(
            @NotBlank @Size(max = 60) String name,
            @NotEmpty @Size(max = MAX_BLOCKS_PER_DAY) List<@Valid PresetLineRequest> lines) {}

    /** Saves the plan of a day as a new preset. */
    public record PresetFromDayRequest(
            @NotBlank @Size(max = 60) String name,
            @NotNull LocalDate date) {}

    /** Starts an empty day from a preset. */
    public record ApplyPresetRequest(@NotNull Long presetId) {}

    public record PresetLineResponse(
            int endMinute,
            String title,
            Long habitId,
            /** The linked habit's current name — it may have been renamed since. */
            String habitName) {}

    public record PresetResponse(Long id, String name, List<PresetLineResponse> lines) {}

    public record DoneRequest(@NotNull Boolean done) {}

    /** Copies another day's blocks onto the requested one. */
    public record CopyRequest(@NotNull LocalDate from) {}

    /**
     * Slides some of a day's blocks earlier (negative) or later (positive).
     * The whole selection moves by the same amount, so its shape survives.
     */
    public record ShiftRequest(
            @NotEmpty @Size(max = MAX_BLOCKS_PER_DAY) List<Long> blockIds,
            @NotNull @Min(-LAST_MINUTE) @Max(LAST_MINUTE) Integer deltaMinutes) {}

    /** Several of one day's blocks, removed together. */
    public record DeleteRequest(
            @NotEmpty @Size(max = MAX_BLOCKS_PER_DAY) List<Long> blockIds) {}

    public record BlockResponse(
            Long id,
            LocalDate date,
            int endMinute,
            String title,
            Long habitId,
            /** The linked habit's current name — it may have been renamed since. */
            String habitName,
            Long taskId,
            boolean done) {}

    /**
     * What a shift actually did. The applied amount can be smaller than the
     * one asked for — the day has edges — so the client can say so.
     */
    public record ShiftResult(int appliedMinutes, PlanDayResponse day) {}

    public record PlanDayResponse(
            LocalDate date,
            /** The user's logical today, so the client can label the day it shows. */
            LocalDate today,
            /** Days that already have a plan, most recent first — copy sources. */
            List<LocalDate> plannedDates,
            List<BlockResponse> blocks) {}

    public static BlockResponse toResponse(PlanBlock block) {
        return new BlockResponse(
                block.getId(),
                block.getPlanDate(),
                block.getEndMinute(),
                block.getTitle(),
                block.getHabit() == null ? null : block.getHabit().getId(),
                block.getHabit() == null ? null : block.getHabit().getName(),
                block.getTask() == null ? null : block.getTask().getId(),
                block.isDone());
    }

    private PlanDtos() {}
}
