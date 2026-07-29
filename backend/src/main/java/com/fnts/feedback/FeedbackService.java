package com.fnts.feedback;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.common.ApiException;
import com.fnts.feedback.FeedbackDtos.FeedbackRequest;
import com.fnts.feedback.FeedbackDtos.FeedbackResponse;
import com.fnts.feedback.FeedbackDtos.SubmitResult;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

@Service
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final UserRepository userRepository;
    private final FeedbackNotifier notifier;

    public FeedbackService(FeedbackRepository feedbackRepository,
                           UserRepository userRepository,
                           FeedbackNotifier notifier) {
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
        this.notifier = notifier;
    }

    /**
     * Saves the feedback, then tries to brief-and-email it.
     *
     * Deliberately NOT @Transactional: the save must commit on its own (via
     * the repository's own transaction) before the notification runs, so a
     * Gemini/SMTP failure can never roll the feedback away. It just stays
     * queued for FeedbackRetryScheduler, and the caller is told honestly
     * that delivery is still pending.
     */
    public SubmitResult submit(Long userId, FeedbackRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        Feedback feedback = new Feedback();
        feedback.setUser(user);
        feedback.setMessage(request.message().trim());
        feedback.setPage(request.page());
        Feedback saved = feedbackRepository.save(feedback);

        boolean delivered = notifier.notifyOne(saved.getId());
        return new SubmitResult(saved.getId(), delivered, notifier.isEnabled());
    }

    /**
     * Files a GitHub issue for one feedback regardless of the AI verdict —
     * the manual "create issue" link from a briefing email. Returns the issue
     * url, or null if it couldn't be filed (already filed returns the url).
     */
    public String promoteToIssue(Long feedbackId) {
        return notifier.fileIssue(feedbackId, true);
    }

    @Transactional(readOnly = true)
    public List<FeedbackResponse> list(int limit) {
        return feedbackRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, limit))
                .stream()
                .map(FeedbackDtos::toResponse)
                .toList();
    }
}
