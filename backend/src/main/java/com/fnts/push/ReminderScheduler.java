package com.fnts.push;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.CheckinService;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

@Component
public class ReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReminderScheduler.class);

    private final PushSubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final CheckinService checkinService;
    private final WebPushSender pushSender;

    public ReminderScheduler(PushSubscriptionRepository subscriptionRepository,
                             UserRepository userRepository,
                             CheckinService checkinService,
                             WebPushSender pushSender) {
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
        this.checkinService = checkinService;
        this.pushSender = pushSender;
    }

    /**
     * Every 5 minutes: remind each subscribed user once per (their) day, at or
     * after their chosen reminder hour, and only while habits are still unchecked.
     */
    @Scheduled(cron = "0 */5 * * * *")
    @Transactional
    public void sendDailyReminders() {
        if (!pushSender.isEnabled()) {
            return;
        }
        for (User user : subscriptionRepository.findUsersWithSubscriptions()) {
            try {
                ZonedDateTime now = ZonedDateTime.now(ZoneId.of(user.getTimezone()));
                LocalDate today = com.fnts.checkin.Periods.logicalToday(user);

                boolean itsTime = now.getHour() >= user.getReminderHour();
                boolean alreadyReminded = today.equals(user.getLastReminderDate());
                if (!itsTime || alreadyReminded) {
                    continue;
                }
                var todayState = checkinService.getToday(user.getId());
                if (todayState.allChecked() || todayState.entries().isEmpty()) {
                    continue; // nothing to nag about
                }

                pushSender.sendToUser(user.getId(), """
                        {"title":"fromNowToSuccess","body":"Time for your daily check-in. What did you do today?","url":"/checkin"}""");
                user.setLastReminderDate(today);
                userRepository.save(user);
            } catch (Exception e) {
                log.warn("Reminder for user {} failed: {}", user.getId(), e.getMessage());
            }
        }
    }
}
