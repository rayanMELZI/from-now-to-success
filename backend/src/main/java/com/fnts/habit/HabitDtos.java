package com.fnts.habit;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class HabitDtos {

    public record HabitRequest(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description,
            @Min(1) @Max(100) Integer basePoints,
            @Min(2) @Max(90) Integer requiredStreak,
            HabitSchedule schedule,
            List<Long> prerequisiteIds) {}

    public record HabitResponse(
            Long id,
            String name,
            String description,
            int basePoints,
            int requiredStreak,
            HabitSchedule schedule,
            HabitStatus status,
            int gauge,
            int currentStreak,
            int bestStreak,
            int consecutiveMisses,
            LocalDate startDate,
            List<Long> prerequisiteIds) {}

    public static HabitResponse toResponse(Habit habit) {
        return new HabitResponse(
                habit.getId(),
                habit.getName(),
                habit.getDescription(),
                habit.getBasePoints(),
                habit.getRequiredStreak(),
                habit.getSchedule(),
                habit.getStatus(),
                habit.getGauge(),
                habit.getCurrentStreak(),
                habit.getBestStreak(),
                habit.getConsecutiveMisses(),
                habit.getStartDate(),
                habit.getPrerequisites().stream().map(Habit::getId).sorted().toList());
    }

    private HabitDtos() {}
}
