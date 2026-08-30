package com.fnts.checkin;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.CheckinDtos.CheckinRequest;
import com.fnts.checkin.CheckinDtos.CheckinResult;
import com.fnts.checkin.CheckinDtos.Entry;
import com.fnts.checkin.CheckinDtos.HistoryDay;
import com.fnts.checkin.CheckinDtos.TimerEntry;
import com.fnts.checkin.CheckinDtos.TodayEntry;
import com.fnts.checkin.CheckinDtos.TodayResponse;
import com.fnts.common.ApiException;
import com.fnts.habit.Habit;
import com.fnts.habit.HabitRepository;
import com.fnts.habit.HabitSchedule;
import com.fnts.habit.HabitService;
import com.fnts.habit.HabitStatus;
import com.fnts.habit.TrackingMode;
import com.fnts.user.Levels;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

@Service
public class CheckinService {

    private static final List<HabitStatus> TRACKABLE =
            List.of(HabitStatus.ACTIVE, HabitStatus.VALID);

    private final HabitRepository habitRepository;
    private final HabitLogRepository logRepository;
    private final UserRepository userRepository;
    private final HabitService habitService;

    public CheckinService(HabitRepository habitRepository,
                          HabitLogRepository logRepository,
                          UserRepository userRepository,
                          HabitService habitService) {
        this.habitRepository = habitRepository;
        this.logRepository = logRepository;
        this.userRepository = userRepository;
        this.habitService = habitService;
    }

    /** Everything the check-in needs to know about one habit right now. */
    private record PeriodState(HabitLog todayLog, int doneThisPeriod, boolean targetMet,
                               boolean periodFrozen) {}

    @Transactional
    public TodayResponse getToday(Long userId) {
        User user = loadUser(userId);
        LocalDate today = Periods.logicalToday(user);
        DayOfWeek weekStart = DayOfWeek.of(user.getWeekStartDay());
        Instant now = Instant.now();
        List<Habit> habits = scheduledHabits(userId);
        catchUpMissedPeriods(user, today, habits);
        // Running clocks bank whatever they passed while the user was away.
        habitService.advanceTimers(user, now);

        Map<Long, HabitLog> todayLogs = todayLogs(habits, today);
        Map<Long, PeriodCounts> counts = periodCounts(habits, today, weekStart);

        int pointsToday = 0;
        List<TodayEntry> entries = new ArrayList<>();
        boolean anyBlockingPending = false;

        for (Habit habit : habits) {
            PeriodState state = periodState(habit, todayLogs.get(habit.getId()),
                    counts.get(habit.getId()));
            String todayStatus = todayStatus(habit, state);
            int daysLeft = Periods.daysLeftInPeriod(habit.getSchedule(), today, weekStart);
            float multiplier = GameRules.multiplier(habit.getCurrentStreak() + 1);

            if (state.todayLog() != null) {
                pointsToday += state.todayLog().getPointsAwarded();
            }
            // A weekly/monthly habit only "blocks" the day once the remaining
            // completions need every remaining day (crunch time).
            int remaining = habit.getTimesPerPeriod() - state.doneThisPeriod();
            if (todayStatus.equals("PENDING")
                    && (habit.getSchedule() == HabitSchedule.DAILY || daysLeft <= remaining)) {
                anyBlockingPending = true;
            }

            entries.add(new TodayEntry(habit.getId(), habit.getName(), habit.getDescription(),
                    habit.getStatus(), habit.getSchedule(), habit.getHabitType(),
                    habit.getGauge(), habit.getCurrentStreak(), habit.getRequiredStreak(),
                    habit.getBasePoints(), multiplier, daysLeft,
                    habit.getTimesPerPeriod(), state.doneThisPeriod(), todayStatus));
        }

        boolean allChecked = !entries.isEmpty() && !anyBlockingPending;
        return new TodayResponse(today, now, allChecked, pointsToday,
                freezesLeft(userId, today), deepFreezesLeft(userId, today),
                entries, timers(userId, now));
    }

    /** Timer habits have no question to answer — only a clock and a record. */
    private List<TimerEntry> timers(Long userId, Instant now) {
        List<TimerEntry> timers = new ArrayList<>();
        for (Habit habit : habitRepository
                .findByUserIdAndTrackingModeAndStatusInOrderBySortOrderAscIdAsc(
                        userId, TrackingMode.TIMER, TRACKABLE)) {
            long goal = habit.getGoalSeconds() == null ? 0 : habit.getGoalSeconds();
            long elapsed = GameRules.elapsedSeconds(habit, now);
            timers.add(new TimerEntry(habit.getId(), habit.getName(), habit.getDescription(),
                    habit.getStatus(), habit.getHabitType(), habit.getClockStartedAt(),
                    goal, habit.getBestCleanSeconds(),
                    Milestones.next(Milestones.ladder(goal), elapsed),
                    habit.getGauge(), habit.getRequiredStreak(), habit.getBasePoints()));
        }
        return timers;
    }

    @Transactional
    public CheckinResult submit(Long userId, CheckinRequest request) {
        User user = loadUser(userId);
        LocalDate today = Periods.logicalToday(user);
        DayOfWeek weekStart = DayOfWeek.of(user.getWeekStartDay());
        List<Habit> habits = scheduledHabits(userId);
        catchUpMissedPeriods(user, today, habits);

        Map<Long, HabitLog> todayLogs = todayLogs(habits, today);
        // The engagement bonus goes to the day's FIRST done answer, so
        // answering habits one by one through the day still earns it once.
        boolean noDoneYet = todayLogs.values().stream()
                .noneMatch(l -> l.getStatus() == HabitLog.Status.DONE);
        int freezesLeft = freezesLeft(userId, today);
        int deepFreezesLeft = deepFreezesLeft(userId, today);

        int earned = 0;
        List<String> becameValid = new ArrayList<>();
        int doneCount = 0;

        for (Entry entry : request.entries()) {
            Habit habit = habits.stream()
                    .filter(h -> h.getId().equals(entry.habitId()))
                    .findFirst()
                    .orElseThrow(() -> ApiException.badRequest(
                            "Habit " + entry.habitId() + " is not trackable today"));

            PeriodState state = periodState(habit, todayLogs.get(habit.getId()),
                    periodCounts(habit, today, weekStart));
            if (state.todayLog() != null || state.targetMet() || state.periodFrozen()) {
                continue; // already answered / period complete / period frozen
            }

            GameRules.DayResult result;
            boolean excused = !entry.done()
                    && entry.reason() != null && !entry.reason().isBlank();
            boolean freeze = !entry.done() && Boolean.TRUE.equals(entry.freeze());

            if (habit.getSchedule() == HabitSchedule.DAILY) {
                if (freeze) {
                    if (freezesLeft <= 0) {
                        throw ApiException.badRequest("No streak freezes left this month");
                    }
                    freezesLeft--;
                }
                result = entry.done()
                        ? GameRules.applyDone(habit)
                        : GameRules.applyMiss(habit, excused, freeze);
            } else if (entry.done()) {
                boolean targetReached =
                        state.doneThisPeriod() + 1 >= habit.getTimesPerPeriod();
                result = GameRules.applyPeriodicDone(habit, targetReached);
            } else {
                // Weekly/monthly can only be missed by SPENDING a freeze: it
                // resolves the whole period as a protected miss. Weekly draws
                // from the normal pool; monthly needs the rare Deep Freeze.
                if (!freeze) {
                    throw ApiException.badRequest(
                            "Weekly/monthly habits auto-miss at period end; spend a freeze to skip the period");
                }
                if (habit.getSchedule() == HabitSchedule.WEEKLY) {
                    if (freezesLeft <= 0) {
                        throw ApiException.badRequest("No streak freezes left this month");
                    }
                    freezesLeft--;
                } else {
                    if (deepFreezesLeft <= 0) {
                        throw ApiException.badRequest(
                                "No Deep Freeze left (you get one every 3 months)");
                    }
                    deepFreezesLeft--;
                }
                result = GameRules.applyMiss(habit, excused, true);
                // The period is settled: the catch-up must not miss it again.
                habit.setLastEvaluatedPeriod(
                        Periods.periodStart(habit.getSchedule(), today, weekStart));
            }

            HabitLog log = new HabitLog();
            log.setHabit(habit);
            log.setLogDate(today);
            log.setStatus(entry.done() ? HabitLog.Status.DONE : HabitLog.Status.MISSED);
            log.setPointsAwarded(result.points());
            log.setReason(excused ? entry.reason().trim() : null);
            log.setFrozen(freeze);
            logRepository.save(log);
            // A request naming the same habit twice must still answer it once.
            todayLogs.put(habit.getId(), log);

            earned += result.points();
            if (entry.done()) {
                doneCount++;
            }
            if (result.becameValid()) {
                becameValid.add(habit.getName());
            }
        }

        if (noDoneYet && doneCount > 0) {
            earned += GameRules.CHECKIN_BONUS;
        }
        // Points can be lost on misses, but the total never goes negative.
        user.setTotalPoints(Math.max(0, user.getTotalPoints() + earned));

        // Validations unlock dependents; demotions can re-lock them.
        List<String> unlocked = habitService.syncLockStates(userId, today);

        return new CheckinResult(earned, user.getTotalPoints(),
                Levels.levelFor(user.getTotalPoints()), freezesLeft, deepFreezesLeft,
                becameValid, unlocked);
    }

    @Transactional
    public List<HistoryDay> history(Long userId, int days) {
        User user = loadUser(userId);
        LocalDate today = Periods.logicalToday(user);
        catchUpMissedPeriods(user, today, scheduledHabits(userId));

        Map<LocalDate, int[]> byDate = new LinkedHashMap<>();
        for (HabitLog log : logRepository.findRecentForUser(userId, today.minusDays(days - 1))) {
            int[] counts = byDate.computeIfAbsent(log.getLogDate(), d -> new int[3]);
            if (log.getStatus() == HabitLog.Status.DONE) counts[0]++;
            else counts[1]++;
            counts[2] += log.getPointsAwarded();
        }
        return byDate.entrySet().stream()
                .map(e -> new HistoryDay(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2]))
                .toList();
    }

    /**
     * Applies outcomes for every fully finished day/period that was never
     * answered, in order. Runs before any read or write, so state is always
     * caught up no matter how long the user was away — no scheduled jobs.
     */
    private void catchUpMissedPeriods(User user, LocalDate today, List<Habit> habits) {
        DayOfWeek weekStart = DayOfWeek.of(user.getWeekStartDay());
        int penalties = 0;
        Map<Long, LocalDate> lastAnswered = lastAnsweredDays(habits);

        for (Habit habit : habits) {
            if (habit.getSchedule() == HabitSchedule.DAILY) {
                penalties += catchUpDaily(habit, today, lastAnswered.get(habit.getId()));
            } else {
                penalties += catchUpPeriodic(habit, today, weekStart);
            }
        }
        if (penalties != 0) {
            user.setTotalPoints(Math.max(0, user.getTotalPoints() + penalties));
        }
    }

    /**
     * The day each habit was last answered, for the whole list in one query.
     * Asking per habit is what made opening the app cost more the longer the
     * roadmap got — this is the single biggest read on the check-in path.
     */
    private Map<Long, LocalDate> lastAnsweredDays(List<Habit> habits) {
        Map<Long, LocalDate> byHabit = new HashMap<>();
        if (habits.isEmpty()) {
            return byHabit;
        }
        for (HabitLogRepository.LastLogRow row : logRepository.findLastLogDates(
                habits.stream().map(Habit::getId).toList())) {
            byHabit.put(row.getHabitId(), row.getLastDate());
        }
        return byHabit;
    }

    /** Every unanswered past day of a daily habit becomes a MISSED log. */
    private int catchUpDaily(Habit habit, LocalDate today, LocalDate lastAnswered) {
        LocalDate cursor = lastAnswered != null
                ? lastAnswered.plusDays(1)
                : habit.getStartDate();
        int penalties = 0;
        while (cursor.isBefore(today)) {
            GameRules.DayResult result = GameRules.applyMiss(habit, false, false);
            HabitLog log = new HabitLog();
            log.setHabit(habit);
            log.setLogDate(cursor);
            log.setStatus(HabitLog.Status.MISSED);
            log.setPointsAwarded(result.points());
            logRepository.save(log);
            penalties += result.points();
            cursor = cursor.plusDays(1);
        }
        return penalties;
    }

    /**
     * A finished week/month below its completion target counts as ONE miss.
     * Completed periods already moved the gauge when the target was reached.
     */
    private int catchUpPeriodic(Habit habit, LocalDate today, DayOfWeek weekStart) {
        HabitSchedule schedule = habit.getSchedule();
        LocalDate currentPeriod = Periods.periodStart(schedule, today, weekStart);
        LocalDate cursor = habit.getLastEvaluatedPeriod() == null
                ? Periods.periodStart(schedule, habit.getStartDate(), weekStart)
                : Periods.nextPeriodStart(schedule, habit.getLastEvaluatedPeriod());

        int penalties = 0;
        while (cursor.isBefore(currentPeriod)) {
            LocalDate next = Periods.nextPeriodStart(schedule, cursor);
            int done = logRepository.countDoneInPeriod(habit.getId(), cursor, next);
            if (done < habit.getTimesPerPeriod()) {
                GameRules.DayResult result = GameRules.applyMiss(habit, false, false);
                penalties += result.points();
                // Marker on the period's last day, so history shows the miss.
                LocalDate lastDay = next.minusDays(1);
                if (logRepository.findByHabitIdAndLogDate(habit.getId(), lastDay).isEmpty()) {
                    HabitLog log = new HabitLog();
                    log.setHabit(habit);
                    log.setLogDate(lastDay);
                    log.setStatus(HabitLog.Status.MISSED);
                    log.setPointsAwarded(result.points());
                    logRepository.save(log);
                }
            }
            habit.setLastEvaluatedPeriod(cursor);
            cursor = next;
        }
        return penalties;
    }

    /**
     * Today's log for each of these habits, in one query. Every habit of every
     * check-in read needs it, and asking per habit made the cost of opening
     * the page grow with the size of the roadmap.
     */
    private Map<Long, HabitLog> todayLogs(List<Habit> habits, LocalDate today) {
        if (habits.isEmpty()) {
            return new HashMap<>();
        }
        Map<Long, HabitLog> byHabit = new HashMap<>();
        for (HabitLog log : logRepository.findByHabitIdInAndLogDate(
                habits.stream().map(Habit::getId).toList(), today)) {
            byHabit.put(log.getHabit().getId(), log);
        }
        return byHabit;
    }

    /** What a weekly/monthly habit has already logged inside its running period. */
    private record PeriodCounts(int done, int missed) {
        static final PeriodCounts NONE = new PeriodCounts(0, 0);
    }

    /**
     * The running period's tallies for every weekly and monthly habit, in one
     * query per schedule instead of two per habit. Habits on the same schedule
     * share the same period bounds, which is what makes the grouping possible.
     */
    private Map<Long, PeriodCounts> periodCounts(List<Habit> habits, LocalDate today,
                                                 DayOfWeek weekStart) {
        Map<Long, PeriodCounts> byHabit = new HashMap<>();
        Map<HabitSchedule, List<Long>> bySchedule = habits.stream()
                .filter(h -> h.getSchedule() != HabitSchedule.DAILY)
                .collect(Collectors.groupingBy(Habit::getSchedule,
                        Collectors.mapping(Habit::getId, Collectors.toList())));

        for (Map.Entry<HabitSchedule, List<Long>> group : bySchedule.entrySet()) {
            LocalDate period = Periods.periodStart(group.getKey(), today, weekStart);
            LocalDate next = Periods.nextPeriodStart(group.getKey(), period);
            for (HabitLogRepository.PeriodCountRow row
                    : logRepository.countsInPeriod(group.getValue(), period, next)) {
                byHabit.put(row.getHabitId(),
                        new PeriodCounts((int) row.getDoneCount(), (int) row.getMissedCount()));
            }
        }
        return byHabit;
    }

    /** The same tallies for a single habit — the check-in answers a handful. */
    private PeriodCounts periodCounts(Habit habit, LocalDate today, DayOfWeek weekStart) {
        if (habit.getSchedule() == HabitSchedule.DAILY) {
            return PeriodCounts.NONE;
        }
        LocalDate period = Periods.periodStart(habit.getSchedule(), today, weekStart);
        LocalDate next = Periods.nextPeriodStart(habit.getSchedule(), period);
        return new PeriodCounts(
                logRepository.countDoneInPeriod(habit.getId(), period, next),
                logRepository.countMissedInPeriod(habit.getId(), period, next));
    }

    private PeriodState periodState(Habit habit, HabitLog todayLog, PeriodCounts counts) {
        if (habit.getSchedule() == HabitSchedule.DAILY) {
            boolean done = todayLog != null && todayLog.getStatus() == HabitLog.Status.DONE;
            return new PeriodState(todayLog, done ? 1 : 0, done, false);
        }
        PeriodCounts tally = counts == null ? PeriodCounts.NONE : counts;
        // A MISSED log inside the running period can only come from a freeze.
        return new PeriodState(todayLog, tally.done(),
                tally.done() >= habit.getTimesPerPeriod(), tally.missed() > 0);
    }

    private String todayStatus(Habit habit, PeriodState state) {
        if (habit.getSchedule() == HabitSchedule.DAILY) {
            if (state.todayLog() == null) return "PENDING";
            if (state.todayLog().isFrozen()) return "FROZEN";
            return state.todayLog().getStatus().name();
        }
        if (state.periodFrozen()) return "FROZEN";
        if (state.targetMet()) return "DONE";
        if (state.todayLog() != null) return "DONE_TODAY";
        return "PENDING";
    }

    private int freezesLeft(Long userId, LocalDate today) {
        int used = logRepository.countNormalFrozenSince(
                userId, today.withDayOfMonth(1), HabitSchedule.MONTHLY);
        return Math.max(0, GameRules.FREEZES_PER_MONTH - used);
    }

    /** One Deep Freeze (monthly habits) per rolling three calendar months. */
    private int deepFreezesLeft(Long userId, LocalDate today) {
        LocalDate quarterStart = today.withDayOfMonth(1).minusMonths(2);
        int used = logRepository.countFrozenBySchedule(
                userId, quarterStart, HabitSchedule.MONTHLY);
        return Math.max(0, GameRules.DEEP_FREEZES_PER_QUARTER - used);
    }

    /**
     * Timer habits are deliberately absent from every path in here: they have
     * no daily question, so the catch-up must never mark them missed.
     */
    private List<Habit> scheduledHabits(Long userId) {
        return habitRepository.findByUserIdAndTrackingModeAndStatusInOrderBySortOrderAscIdAsc(
                userId, TrackingMode.SCHEDULED, TRACKABLE);
    }

    private User loadUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
