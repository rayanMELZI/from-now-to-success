package com.fnts.feedback;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.fnts.auth.CurrentUser;
import com.fnts.feedback.FeedbackDtos.FeedbackRequest;
import com.fnts.feedback.FeedbackDtos.FeedbackResponse;

import jakarta.validation.Valid;

/**
 * Any signed-in user can leave feedback. Listing it back is ADMIN-only
 * (gated in SecurityConfig) — there's no UI for it yet; read it with psql
 * or promote your account and call this endpoint directly.
 */
@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FeedbackResponse submit(@AuthenticationPrincipal CurrentUser user,
                                   @Valid @RequestBody FeedbackRequest request) {
        return feedbackService.submit(user.id(), request);
    }

    @GetMapping
    public List<FeedbackResponse> list(@RequestParam(defaultValue = "200") int limit) {
        return feedbackService.list(Math.min(Math.max(limit, 1), 500));
    }
}
