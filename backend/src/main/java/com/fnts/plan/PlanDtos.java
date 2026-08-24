package com.fnts.plan;

import java.time.LocalDate;
import java.util.List;

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

    public record BlockRequest(
            @NotBlank @Size(max = 120) String title,
            /** When this is finished; the block runs from the end of the one before. */
            @NotNull @Min(0) @Max(LAST_MINUTE) Integer endMinute,
            /** The habit this block stands for; null for a plain block. */
            Long habitId) {}

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

    public record BlockResponse(
            Long id,
            LocalDate date,
            int endMinute,
            String title,
            Long habitId,
            /** The linked habit's current name — it may have been renamed since. */
            String habitName,
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
            /** The most recent earlier day that has a plan, or null. */
            LocalDate lastPlannedDate,
            List<BlockResponse> blocks) {}

    public static BlockResponse toResponse(PlanBlock block) {
        return new BlockResponse(
                block.getId(),
                block.getPlanDate(),
                block.getEndMinute(),
                block.getTitle(),
                block.getHabit() == null ? null : block.getHabit().getId(),
                block.getHabit() == null ? null : block.getHabit().getName(),
                block.isDone());
    }

    private PlanDtos() {}
}
