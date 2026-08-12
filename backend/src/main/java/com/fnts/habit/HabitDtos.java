package com.fnts.habit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class HabitDtos {

    /** One hour — the shortest goal a timer habit can be given. */
    public static final long MIN_GOAL_SECONDS = 3600L;
    /** Five years. */
    public static final long MAX_GOAL_SECONDS = 5L * 365 * 24 * 3600;

    public record HabitRequest(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description,
            @Min(1) @Max(100) Integer basePoints,
            @Min(2) @Max(90) Integer requiredStreak,
            HabitSchedule schedule,
            HabitType habitType,
            TrackingMode trackingMode,
            @Min(MIN_GOAL_SECONDS) @Max(MAX_GOAL_SECONDS) Long goalSeconds,
            @Min(1) @Max(30) Integer timesPerPeriod,
            List<Long> prerequisiteIds) {}

    /** The user's habit ids in the exact order they want to see them. */
    public record ReorderRequest(@NotEmpty List<@NotNull Long> habitIds) {}

    public record HabitResponse(
            Long id,
            String name,
            String description,
            int basePoints,
            int requiredStreak,
            HabitSchedule schedule,
            HabitType habitType,
            TrackingMode trackingMode,
            Long goalSeconds,
            Instant clockStartedAt,
            long bestCleanSeconds,
            int timesPerPeriod,
            HabitStatus status,
            int gauge,
            int currentStreak,
            int bestStreak,
            int consecutiveMisses,
            LocalDate startDate,
            int sortOrder,
            List<Long> prerequisiteIds) {}

    public static HabitResponse toResponse(Habit habit) {
        return new HabitResponse(
                habit.getId(),
                habit.getName(),
                habit.getDescription(),
                habit.getBasePoints(),
                habit.getRequiredStreak(),
                habit.getSchedule(),
                habit.getHabitType(),
                habit.getTrackingMode(),
                habit.getGoalSeconds(),
                habit.getClockStartedAt(),
                habit.getBestCleanSeconds(),
                habit.getTimesPerPeriod(),
                habit.getStatus(),
                habit.getGauge(),
                habit.getCurrentStreak(),
                habit.getBestStreak(),
                habit.getConsecutiveMisses(),
                habit.getStartDate(),
                habit.getSortOrder(),
                habit.getPrerequisites().stream().map(Habit::getId).sorted().toList());
    }

    private HabitDtos() {}
}
