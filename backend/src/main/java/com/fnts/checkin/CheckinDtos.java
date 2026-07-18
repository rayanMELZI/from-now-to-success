package com.fnts.checkin;

import java.time.LocalDate;
import java.util.List;

import com.fnts.habit.HabitSchedule;
import com.fnts.habit.HabitStatus;
import com.fnts.habit.HabitType;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CheckinDtos {

    public record Entry(
            @NotNull Long habitId,
            @NotNull Boolean done,
            @Size(max = 500) String reason,
            Boolean freeze) {}

    public record CheckinRequest(@NotEmpty List<Entry> entries) {}

    /** One habit's row on the check-in screen. */
    public record TodayEntry(
            Long habitId,
            String name,
            String description,
            HabitStatus status,
            HabitSchedule schedule,
            HabitType habitType,
            int gauge,
            int currentStreak,
            int requiredStreak,
            int basePoints,
            float multiplier,
            int daysLeftInPeriod,
            int timesPerPeriod,
            int doneThisPeriod,
            String todayStatus /* DONE | MISSED | PENDING | DONE_TODAY */) {}

    public record TodayResponse(
            LocalDate date,
            boolean allChecked,
            int pointsToday,
            int freezesLeft,
            int deepFreezesLeft,
            List<TodayEntry> entries) {}

    public record CheckinResult(
            int earnedPoints,
            int totalPoints,
            int level,
            int freezesLeft,
            int deepFreezesLeft,
            List<String> becameValid,
            List<String> unlocked) {}

    public record HistoryDay(LocalDate date, int done, int missed, int points) {}

    private CheckinDtos() {}
}
