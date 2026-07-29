package com.fnts.feedback;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.fnts.auth.CurrentUser;
import com.fnts.config.AppProperties;
import com.fnts.feedback.FeedbackDtos.FeedbackRequest;
import com.fnts.feedback.FeedbackDtos.FeedbackResponse;
import com.fnts.feedback.FeedbackDtos.SubmitResult;

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
    private final AppProperties props;

    public FeedbackController(FeedbackService feedbackService, AppProperties props) {
        this.feedbackService = feedbackService;
        this.props = props;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SubmitResult submit(@AuthenticationPrincipal CurrentUser user,
                               @Valid @RequestBody FeedbackRequest request) {
        return feedbackService.submit(user.id(), request);
    }

    @GetMapping
    public List<FeedbackResponse> list(@RequestParam(defaultValue = "200") int limit) {
        return feedbackService.list(Math.min(Math.max(limit, 1), 500));
    }

    /**
     * One-click "create issue" link from a briefing email. It carries a signed
     * token instead of a login, so it's permitAll in SecurityConfig; the token
     * is what authorises it. Returns a tiny HTML page since it opens in a
     * browser. Idempotent: clicking an already-filed row just shows its link.
     */
    @GetMapping(value = "/{id}/promote", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> promote(@PathVariable Long id,
                                          @RequestParam(required = false) String token) {
        if (!PromoteToken.verify(props.jwt().secret(), id, token)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(page("Invalid or expired link.", null));
        }
        String url = feedbackService.promoteToIssue(id);
        if (url == null) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(page("Couldn't create the issue — check the server logs and try again.", null));
        }
        return ResponseEntity.ok(page("Issue created for feedback #" + id + ".", url));
    }

    private static String page(String message, String issueUrl) {
        String link = issueUrl == null ? ""
                : "<p><a href=\"" + issueUrl + "\">" + issueUrl + "</a></p>";
        return """
                <!doctype html><meta charset="utf-8">
                <title>fromNowToSuccess</title>
                <body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">
                <h1 style="font-size:1.1rem">%s</h1>%s</body>
                """.formatted(message, link);
    }
}
