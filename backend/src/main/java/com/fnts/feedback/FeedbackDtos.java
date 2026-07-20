package com.fnts.feedback;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class FeedbackDtos {

    public record FeedbackRequest(
            @NotBlank @Size(max = 2000) String message,
            @Size(max = 100) String page) {}

    public record FeedbackResponse(
            Long id,
            String message,
            String page,
            FeedbackStatus status,
            String username,
            Instant createdAt) {}

    /**
     * What the submitter gets back. `delivered` is honest: false means the
     * feedback is safely stored but the briefing email hasn't gone out yet
     * (it will retry automatically).
     */
    public record SubmitResult(Long id, boolean delivered, boolean notificationsConfigured) {}

    static FeedbackResponse toResponse(Feedback feedback) {
        return new FeedbackResponse(
                feedback.getId(),
                feedback.getMessage(),
                feedback.getPage(),
                feedback.getStatus(),
                feedback.getUser().getUsername(),
                feedback.getCreatedAt());
    }

    private FeedbackDtos() {}
}
