package com.fnts.checkin;

import java.time.LocalDate;
import java.util.List;

import com.fnts.habit.HabitStatus;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public class CheckinDtos {

    public record Entry(@NotNull Long habitId, @NotNull Boolean done) {}

    public record CheckinRequest(@NotEmpty List<Entry> entries) {}

    /** One habit's row on the check-in screen. */
    public record TodayEntry(
            Long habitId,
            String name,
            String description,
            HabitStatus status,
            int gauge,
            int currentStreak,
            int requiredStreak,
            int basePoints,
            float multiplier,
            String todayStatus /* DONE | MISSED | PENDING */) {}

    public record TodayResponse(
            LocalDate date,
            boolean allChecked,
            int pointsToday,
            List<TodayEntry> entries) {}

    public record CheckinResult(
            int earnedPoints,
            int totalPoints,
            int level,
            List<String> becameValid,
            List<String> unlocked) {}

    public record HistoryDay(LocalDate date, int done, int missed, int points) {}

    private CheckinDtos() {}
}
