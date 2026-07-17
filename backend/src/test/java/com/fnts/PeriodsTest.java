package com.fnts;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.DayOfWeek;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.fnts.checkin.Periods;
import com.fnts.habit.HabitSchedule;

class PeriodsTest {

    // Wednesday 2026-07-15
    private static final LocalDate WED = LocalDate.of(2026, 7, 15);

    @Test
    void dailyPeriodIsTheDayItself() {
        assertEquals(WED, Periods.periodStart(HabitSchedule.DAILY, WED, DayOfWeek.MONDAY));
        assertEquals(WED.plusDays(1),
                Periods.nextPeriodStart(HabitSchedule.DAILY, WED));
    }

    @Test
    void weeklyPeriodStartsOnTheUsersWeekStart() {
        assertEquals(LocalDate.of(2026, 7, 13), // Monday
                Periods.periodStart(HabitSchedule.WEEKLY, WED, DayOfWeek.MONDAY));
        assertEquals(LocalDate.of(2026, 7, 11), // Saturday
                Periods.periodStart(HabitSchedule.WEEKLY, WED, DayOfWeek.SATURDAY));
    }

    @Test
    void weekStartDayItselfBeginsANewWeek() {
        LocalDate saturday = LocalDate.of(2026, 7, 11);
        assertEquals(saturday,
                Periods.periodStart(HabitSchedule.WEEKLY, saturday, DayOfWeek.SATURDAY));
    }

    @Test
    void monthlyPeriodIsTheFirstOfTheMonth() {
        assertEquals(LocalDate.of(2026, 7, 1),
                Periods.periodStart(HabitSchedule.MONTHLY, WED, DayOfWeek.MONDAY));
        assertEquals(LocalDate.of(2026, 8, 1),
                Periods.nextPeriodStart(HabitSchedule.MONTHLY, LocalDate.of(2026, 7, 1)));
    }

    @Test
    void daysLeftCountsTodayAsOneOnTheLastDay() {
        // Sunday with Monday week start: last day of the week
        LocalDate sunday = LocalDate.of(2026, 7, 19);
        assertEquals(1, Periods.daysLeftInPeriod(HabitSchedule.WEEKLY, sunday, DayOfWeek.MONDAY));
        assertEquals(5, Periods.daysLeftInPeriod(HabitSchedule.WEEKLY, WED, DayOfWeek.MONDAY));
        assertEquals(1, Periods.daysLeftInPeriod(HabitSchedule.DAILY, WED, DayOfWeek.MONDAY));
    }
}
