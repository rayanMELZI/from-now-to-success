package com.fnts.checkin;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;

import com.fnts.habit.HabitSchedule;
import com.fnts.user.User;

/**
 * All calendar math in one pure, testable place.
 *
 * A habit's log is keyed by its PERIOD START date: the day itself for daily
 * habits, the user's week-start day for weekly ones, the 1st for monthly.
 * "Logical today" honours the user's day-end hour: with dayEndHour = 3,
 * a check-in at 01:00 still belongs to yesterday.
 */
public final class Periods {

    public static LocalDate logicalToday(User user) {
        return ZonedDateTime.now(ZoneId.of(user.getTimezone()))
                .minusHours(user.getDayEndHour())
                .toLocalDate();
    }

    public static LocalDate periodStart(HabitSchedule schedule, LocalDate day, DayOfWeek weekStart) {
        return switch (schedule) {
            case DAILY -> day;
            case WEEKLY -> day.with(TemporalAdjusters.previousOrSame(weekStart));
            case MONTHLY -> day.withDayOfMonth(1);
        };
    }

    public static LocalDate nextPeriodStart(HabitSchedule schedule, LocalDate periodStart) {
        return switch (schedule) {
            case DAILY -> periodStart.plusDays(1);
            case WEEKLY -> periodStart.plusWeeks(1);
            case MONTHLY -> periodStart.plusMonths(1);
        };
    }

    /** Days remaining in the current period, counting today (1 = last day). */
    public static int daysLeftInPeriod(HabitSchedule schedule, LocalDate day, DayOfWeek weekStart) {
        LocalDate next = nextPeriodStart(schedule, periodStart(schedule, day, weekStart));
        return (int) ChronoUnit.DAYS.between(day, next);
    }

    private Periods() {}
}
