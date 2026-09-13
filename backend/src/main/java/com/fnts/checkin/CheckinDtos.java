package com.fnts.checkin;

import java.time.Instant;
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

    /**
     * {@code forDate} is the logical day the answers belong to, for check-ins
     * that were made offline and queued: the client stamps the day it asked
     * the question, because by the time the queue drains the server's "today"
     * may have rolled on. Absent (the online path) means today.
     */
    public record CheckinRequest(@NotEmpty List<Entry> entries, LocalDate forDate) {}

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

    /**
     * One timer habit's live card. The client ticks the clock itself from
     * clockStartedAt; serverNow on the response lets it correct for a device
     * clock that disagrees with the server.
     */
    public record TimerEntry(
            Long habitId,
            String name,
            String description,
            HabitStatus status,
            HabitType habitType,
            Instant clockStartedAt,
            long goalSeconds,
            long bestCleanSeconds,
            /** The rung being climbed now; 0 once the goal is behind you. */
            long nextMilestoneSeconds,
            int gauge,
            int requiredStreak,
            int basePoints) {}

    public record TodayResponse(
            LocalDate date,
            Instant serverNow,
            boolean allChecked,
            int pointsToday,
            int freezesLeft,
            int deepFreezesLeft,
            List<TodayEntry> entries,
            List<TimerEntry> timers) {}

    public record CheckinResult(
            /** The logical day these answers landed on — echoed for late replays. */
            LocalDate date,
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
