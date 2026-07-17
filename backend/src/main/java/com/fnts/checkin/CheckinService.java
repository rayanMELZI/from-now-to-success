package com.fnts.checkin;

import java.time.LocalDate;
import java.time.ZoneId;
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
import com.fnts.habit.HabitService;
import com.fnts.habit.HabitStatus;
import com.fnts.user.Levels;
import com.fnts.user.User;
import com.fnts.user.UserRepository;
import com.fnts.habit.HabitRepository;

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

    @Transactional
    public TodayResponse getToday(Long userId) {
        User user = loadUser(userId);
        LocalDate today = today(user);
        catchUpMissedDays(userId, today);

        List<Habit> habits = habitRepository.findByUserIdAndStatusInOrderByIdAsc(userId, TRACKABLE);
        Map<Long, HabitLog> todayLogs = logsFor(habits, today);

        List<TodayEntry> entries = habits.stream().map(habit -> {
            HabitLog log = todayLogs.get(habit.getId());
            String todayStatus = log == null ? "PENDING" : log.getStatus().name();
            // Show the multiplier the user WOULD get by doing it today.
            float multiplier = GameRules.multiplier(habit.getCurrentStreak() + 1);
            return new TodayEntry(habit.getId(), habit.getName(), habit.getDescription(),
                    habit.getStatus(), habit.getGauge(), habit.getCurrentStreak(),
                    habit.getRequiredStreak(), habit.getBasePoints(), multiplier, todayStatus);
        }).toList();

        boolean allChecked = !entries.isEmpty()
                && entries.stream().noneMatch(e -> e.todayStatus().equals("PENDING"));
        int pointsToday = todayLogs.values().stream().mapToInt(HabitLog::getPointsAwarded).sum();

        return new TodayResponse(today, allChecked, pointsToday, freezesLeft(userId, today), entries);
    }

    @Transactional
    public CheckinResult submit(Long userId, CheckinRequest request) {
        User user = loadUser(userId);
        LocalDate today = today(user);
        catchUpMissedDays(userId, today);

        List<Habit> habits = habitRepository.findByUserIdAndStatusInOrderByIdAsc(userId, TRACKABLE);
        Map<Long, HabitLog> todayLogs = logsFor(habits, today);
        // The engagement bonus goes to the day's FIRST done answer, so
        // answering habits one by one through the day still earns it once.
        boolean noDoneYet = todayLogs.values().stream()
                .noneMatch(l -> l.getStatus() == HabitLog.Status.DONE);
        int freezesLeft = freezesLeft(userId, today);

        int earned = 0;
        List<String> becameValid = new ArrayList<>();
        int doneCount = 0;

        for (Entry entry : request.entries()) {
            Habit habit = habits.stream()
                    .filter(h -> h.getId().equals(entry.habitId()))
                    .findFirst()
                    .orElseThrow(() -> ApiException.badRequest(
                            "Habit " + entry.habitId() + " is not trackable today"));
            if (todayLogs.containsKey(habit.getId())) {
                continue; // already answered today; first answer wins
            }

            boolean excused = !entry.done()
                    && entry.reason() != null && !entry.reason().isBlank();
            boolean freeze = !entry.done() && Boolean.TRUE.equals(entry.freeze());
            if (freeze) {
                if (freezesLeft <= 0) {
                    throw ApiException.badRequest("No streak freezes left this month");
                }
                freezesLeft--;
            }

            GameRules.DayResult result = entry.done()
                    ? GameRules.applyDone(habit)
                    : GameRules.applyMiss(habit, excused, freeze);

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
                Levels.levelFor(user.getTotalPoints()), freezesLeft, becameValid, unlocked);
    }

    @Transactional
    public List<HistoryDay> history(Long userId, int days) {
        User user = loadUser(userId);
        LocalDate today = today(user);
        catchUpMissedDays(userId, today);

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
     * Backfills MISSED logs for every tracked day that was never answered,
     * applying miss consequences in date order. Runs before any read or write,
     * so the state is always caught up to "today" no matter how long the user
     * was away — without needing a scheduled midnight job.
     */
    private void catchUpMissedDays(Long userId, LocalDate today) {
        int penalties = 0;
        for (Habit habit : habitRepository.findByUserIdAndStatusInOrderByIdAsc(userId, TRACKABLE)) {
            Optional<HabitLog> last = logRepository.findTopByHabitIdOrderByLogDateDesc(habit.getId());
            LocalDate cursor = last.map(l -> l.getLogDate().plusDays(1))
                    .orElse(habit.getStartDate());
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
        }
        if (penalties != 0) {
            User user = loadUser(userId);
            user.setTotalPoints(Math.max(0, user.getTotalPoints() + penalties));
        }
    }

    private Map<Long, HabitLog> logsFor(List<Habit> habits, LocalDate date) {
        List<Long> ids = habits.stream().map(Habit::getId).toList();
        Map<Long, HabitLog> map = new LinkedHashMap<>();
        if (!ids.isEmpty()) {
            for (HabitLog log : logRepository.findByHabitIdInAndLogDate(ids, date)) {
                map.put(log.getHabit().getId(), log);
            }
        }
        return map;
    }

    private int freezesLeft(Long userId, LocalDate today) {
        int used = logRepository.countFrozenSince(userId, today.withDayOfMonth(1));
        return Math.max(0, GameRules.FREEZES_PER_MONTH - used);
    }

    private User loadUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private LocalDate today(User user) {
        return LocalDate.now(ZoneId.of(user.getTimezone()));
    }
}
