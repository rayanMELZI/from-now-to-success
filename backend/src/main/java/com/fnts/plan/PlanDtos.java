package com.fnts.plan;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class PlanDtos {

    /** Minutes in a day: a start time is 0 (00:00) .. 1439 (23:59). */
    public static final int LAST_MINUTE = 1439;
    /** A day only holds so many lines; the cap keeps one user's day bounded. */
    public static final int MAX_BLOCKS_PER_DAY = 60;

    public record BlockRequest(
            @NotBlank @Size(max = 120) String title,
            @NotNull @Min(0) @Max(LAST_MINUTE) Integer startMinute,
            /** The habit this block stands for; null for a plain block. */
            Long habitId) {}

    public record DoneRequest(@NotNull Boolean done) {}

    /** Copies another day's blocks onto the requested one. */
    public record CopyRequest(@NotNull LocalDate from) {}

    public record BlockResponse(
            Long id,
            LocalDate date,
            int startMinute,
            String title,
            Long habitId,
            /** The linked habit's current name — it may have been renamed since. */
            String habitName,
            boolean done) {}

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
                block.getStartMinute(),
                block.getTitle(),
                block.getHabit() == null ? null : block.getHabit().getId(),
                block.getHabit() == null ? null : block.getHabit().getName(),
                block.isDone());
    }

    private PlanDtos() {}
}
