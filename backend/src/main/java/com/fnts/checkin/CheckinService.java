package com.fnts.checkin;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.CheckinDtos.CheckinRequest;
import com.fnts.checkin.CheckinDtos.CheckinResult;
import com.fnts.checkin.CheckinDtos.Entry;
import com.fnts.checkin.CheckinDtos.HistoryDay;
import com.fnts.checkin.CheckinDtos.TodayEntry;
import com.fnts.checkin.CheckinDtos.TodayResponse;
import com.fnts.common.ApiException;
import com.fnts.habit.Habit;
import com.fnts.habit.HabitRepository;
import com.fnts.habit.HabitSchedule;
import com.fnts.habit.HabitService;
import com.fnts.habit.HabitStatus;
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
        catchUpMissedPeriods(user, today);

        List<Habit> habits = habitRepository.findByUserIdAndStatusInOrderByIdAsc(userId, TRACKABLE);

        int pointsToday = 0;
        List<TodayEntry> entries = new ArrayList<>();
        boolean anyBlockingPending = false;

        for (Habit habit : habits) {
            PeriodState state = periodState(habit, today, weekStart);
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
        return new TodayResponse(today, allChecked, pointsToday,
                freezesLeft(userId, today), deepFreezesLeft(userId, today), entries);
    }

    @Transactional
    public CheckinResult submit(Long userId, CheckinRequest request) {
        User user = loadUser(userId);
        LocalDate today = Periods.logicalToday(user);
        DayOfWeek weekStart = DayOfWeek.of(user.getWeekStartDay());
        catchUpMissedPeriods(user, today);

        List<Habit> habits = habitRepository.findByUserIdAndStatusInOrderByIdAsc(userId, TRACKABLE);
        // The engagement bonus goes to the day's FIRST done answer, so
        // answering habits one by one through the day still earns it once.
        boolean noDoneYet = habits.stream()
                .map(h -> logRepository.findByHabitIdAndLogDate(h.getId(), today))
                .flatMap(Optional::stream)
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

            PeriodState state = periodState(habit, today, weekStart);
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
        catchUpMissedPeriods(user, today);

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
    private void catchUpMissedPeriods(User user, LocalDate today) {
        DayOfWeek weekStart = DayOfWeek.of(user.getWeekStartDay());
        int penalties = 0;

        for (Habit habit : habitRepository.findByUserIdAndStatusInOrderByIdAsc(
                user.getId(), TRACKABLE)) {
            if (habit.getSchedule() == HabitSchedule.DAILY) {
                penalties += catchUpDaily(habit, today);
            } else {
                penalties += catchUpPeriodic(habit, today, weekStart);
            }
        }
        if (penalties != 0) {
            user.setTotalPoints(Math.max(0, user.getTotalPoints() + penalties));
        }
    }

    /** Every unanswered past day of a daily habit becomes a MISSED log. */
    private int catchUpDaily(Habit habit, LocalDate today) {
        Optional<HabitLog> last = logRepository.findTopByHabitIdOrderByLogDateDesc(habit.getId());
        LocalDate cursor = last.map(l -> l.getLogDate().plusDays(1))
                .orElse(habit.getStartDate());
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

    private PeriodState periodState(Habit habit, LocalDate today, DayOfWeek weekStart) {
        HabitLog todayLog = logRepository
                .findByHabitIdAndLogDate(habit.getId(), today).orElse(null);
        if (habit.getSchedule() == HabitSchedule.DAILY) {
            boolean done = todayLog != null && todayLog.getStatus() == HabitLog.Status.DONE;
            return new PeriodState(todayLog, done ? 1 : 0, done, false);
        }
        LocalDate period = Periods.periodStart(habit.getSchedule(), today, weekStart);
        LocalDate next = Periods.nextPeriodStart(habit.getSchedule(), period);
        int done = logRepository.countDoneInPeriod(habit.getId(), period, next);
        // A MISSED log inside the running period can only come from a freeze.
        boolean frozen = logRepository.countMissedInPeriod(habit.getId(), period, next) > 0;
        return new PeriodState(todayLog, done, done >= habit.getTimesPerPeriod(), frozen);
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

    private User loadUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
