package com.fnts.feedback;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Re-attempts briefings that failed earlier. This is what makes an outage
 * (Gemini down, SMTP down, keys not yet configured) self-healing: as soon
 * as the cause clears, the queued feedback goes out on the next tick.
 */
@Component
public class FeedbackRetryScheduler {

    private static final Logger log = LoggerFactory.getLogger(FeedbackRetryScheduler.class);
    private static final int BATCH = 20;

    private final FeedbackRepository repository;
    private final FeedbackNotifier notifier;

    public FeedbackRetryScheduler(FeedbackRepository repository, FeedbackNotifier notifier) {
        this.repository = repository;
        this.notifier = notifier;
    }

    @Scheduled(cron = "0 */10 * * * *")
    public void retryUndelivered() {
        if (!notifier.isEnabled()) {
            return;
        }
        List<Feedback> pending =
                repository.findByNotifiedAtIsNullOrderByCreatedAtAsc(PageRequest.of(0, BATCH));
        if (pending.isEmpty()) {
            return;
        }
        log.info("Retrying {} undelivered feedback briefing(s)", pending.size());
        for (Feedback feedback : pending) {
            notifier.notifyOne(feedback.getId());
        }
    }
}
