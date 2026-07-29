package com.fnts.feedback;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.config.AppProperties;
import com.fnts.feedback.GeminiClient.Briefing;

/**
 * Turns one feedback row into a briefing email.
 *
 * Delivery is never allowed to lose feedback: the row is always committed
 * first, and a failure here just leaves notifiedAt null so the retry job
 * picks it up again once the outage clears.
 *
 * After GIVE_UP_ON_AI_AFTER failed attempts the email is sent WITHOUT the
 * AI briefing — seeing the raw feedback late beats never seeing it because
 * one API stayed down.
 */
@Service
public class FeedbackNotifier {

    private static final Logger log = LoggerFactory.getLogger(FeedbackNotifier.class);
    private static final int GIVE_UP_ON_AI_AFTER = 3;
    private static final DateTimeFormatter STAMP =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final FeedbackRepository repository;
    private final GeminiClient gemini;
    private final GithubIssueClient github;
    private final JavaMailSender mailSender;
    private final AppProperties props;

    public FeedbackNotifier(FeedbackRepository repository,
                            GeminiClient gemini,
                            GithubIssueClient github,
                            JavaMailSender mailSender,
                            AppProperties props) {
        this.repository = repository;
        this.gemini = gemini;
        this.github = github;
        this.mailSender = mailSender;
        this.props = props;
    }

    public boolean isEnabled() {
        String to = props.feedback().notifyTo();
        return to != null && !to.isBlank();
    }

    public boolean isGithubEnabled() {
        return github.isEnabled();
    }

    /**
     * Attempts the briefing + email for one row. Returns true when the mail
     * is away. Never throws: failures are recorded for the retry job.
     */
    @Transactional
    public boolean notifyOne(Long feedbackId) {
        Feedback feedback = repository.findById(feedbackId).orElse(null);
        if (feedback == null || feedback.getNotifiedAt() != null) {
            return true; // already handled
        }
        if (!isEnabled()) {
            return false; // not configured; stays queued
        }

        feedback.setAttempts(feedback.getAttempts() + 1);
        try {
            // Only call Gemini when we don't already have a briefing (a prior
            // attempt may have succeeded before the email failed) and we
            // haven't run out of AI attempts. Otherwise a stuck email retry
            // would re-summarise every 10 minutes and burn the daily quota.
            boolean needsBriefing = feedback.getAiSummary() == null;
            if (needsBriefing && gemini.isEnabled()
                    && feedback.getAttempts() <= GIVE_UP_ON_AI_AFTER) {
                try {
                    Briefing briefing = gemini.summarise(
                            feedback.getUser().getUsername(),
                            feedback.getPage(),
                            feedback.getMessage());
                    feedback.setAiSummary(briefing.summary());
                    feedback.setAiCategory(briefing.category());
                    feedback.setAiEffort(briefing.effort());
                    feedback.setAiVerdict(briefing.verdict());
                    feedback.setAiWorthDoing(briefing.worthDoing());
                    feedback.setAiIssueTitle(briefing.issueTitle());
                } catch (RuntimeException e) {
                    if (feedback.getAttempts() < GIVE_UP_ON_AI_AFTER) {
                        throw e; // retry the whole thing later, briefing included
                    }
                    log.warn("Gemini failed {} times; sending feedback {} without a briefing",
                            feedback.getAttempts(), feedback.getId(), e);
                }
            }

            // File the issue before the email so worthy feedback's mail can
            // carry the issue link. Best-effort: never throws, so a GitHub
            // outage can't block (or duplicate) the email — the scheduler
            // re-files any worthy row still missing its issue url.
            doFileIssue(feedback, false);

            mailSender.send(buildEmail(feedback, briefingFrom(feedback)));

            feedback.setNotifiedAt(Instant.now());
            feedback.setLastError(null);
            return true;
        } catch (RuntimeException e) {
            String reason = e.getClass().getSimpleName() + ": " + e.getMessage();
            feedback.setLastError(reason.length() > 500 ? reason.substring(0, 500) : reason);
            log.warn("Feedback {} briefing failed (attempt {}): {}",
                    feedback.getId(), feedback.getAttempts(), reason);
            return false;
        }
    }

    /** Rebuilds a Briefing from the persisted columns, or null if none. */
    private static Briefing briefingFrom(Feedback feedback) {
        if (feedback.getAiSummary() == null) {
            return null;
        }
        return new Briefing(feedback.getAiSummary(), feedback.getAiCategory(),
                feedback.getAiEffort(), feedback.getAiVerdict(),
                Boolean.TRUE.equals(feedback.getAiWorthDoing()),
                feedback.getAiIssueTitle() == null ? "" : feedback.getAiIssueTitle());
    }

    /**
     * Files a GitHub issue for one feedback row and returns its url (or null).
     * Used by the manual "create issue" link (force = true, files regardless
     * of the AI verdict) and by the scheduler that sweeps worthy rows.
     */
    @Transactional
    public String fileIssue(Long feedbackId, boolean force) {
        Feedback feedback = repository.findById(feedbackId).orElse(null);
        if (feedback == null) {
            return null;
        }
        doFileIssue(feedback, force);
        return feedback.getGithubIssueUrl();
    }

    /**
     * Creates the issue on the already-loaded row if it qualifies and none
     * exists yet. Never throws: a GitHub failure is logged and left for a
     * later retry. The stored url is the dedup guard, so this is idempotent.
     */
    private void doFileIssue(Feedback feedback, boolean force) {
        if (feedback.getGithubIssueUrl() != null      // already filed
                || feedback.getAiSummary() == null     // not briefed yet
                || !github.isEnabled()) {
            return;
        }
        if (!force && !Boolean.TRUE.equals(feedback.getAiWorthDoing())) {
            return; // AI said skip and nobody overrode it
        }
        try {
            String url = github.createIssue(
                    issueTitle(feedback), issueBody(feedback), issueLabels(feedback));
            feedback.setGithubIssueUrl(url);
            log.info("Filed GitHub issue for feedback {}: {}", feedback.getId(), url);
        } catch (RuntimeException e) {
            log.warn("Could not file GitHub issue for feedback {}: {}",
                    feedback.getId(), e.toString());
        }
    }

    private static String issueTitle(Feedback feedback) {
        String title = feedback.getAiIssueTitle();
        if (title == null || title.isBlank()) {
            title = feedback.getAiSummary();
        }
        if (title == null || title.isBlank()) {
            title = "Feedback #" + feedback.getId();
        }
        return title.length() > 120 ? title.substring(0, 117) + "..." : title;
    }

    /** Category + effort as lowercase labels; GitHub creates missing ones. */
    private static List<String> issueLabels(Feedback feedback) {
        List<String> labels = new ArrayList<>();
        if (feedback.getAiCategory() != null && !feedback.getAiCategory().isBlank()) {
            labels.add(feedback.getAiCategory().toLowerCase());
        }
        if (feedback.getAiEffort() != null && !feedback.getAiEffort().isBlank()) {
            labels.add("effort: " + feedback.getAiEffort().toLowerCase());
        }
        return labels;
    }

    private static String issueBody(Feedback feedback) {
        StringBuilder body = new StringBuilder();
        if (feedback.getAiVerdict() != null && !feedback.getAiVerdict().isBlank()) {
            body.append("**AI verdict** — ").append(feedback.getAiVerdict()).append("\n\n");
        }
        body.append("**Category:** ").append(nz(feedback.getAiCategory()))
                .append(" · **Effort:** ").append(nz(feedback.getAiEffort())).append("\n\n")
                .append("### Original feedback\n\n")
                .append("> ").append(feedback.getMessage().replace("\n", "\n> ")).append("\n\n")
                .append("_From page ").append(feedback.getPage() == null ? "unknown" : feedback.getPage())
                .append(" · feedback #").append(feedback.getId())
                .append(" · ").append(STAMP.format(feedback.getCreatedAt())).append("_\n");
        return body.toString();
    }

    private static String nz(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    /**
     * Adds either the filed issue's link (worthy, already created) or a signed
     * one-click "create issue" link (so you can promote a feedback the AI
     * skipped). The promote link needs a configured public base URL.
     */
    private void appendIssueLine(StringBuilder body, Feedback feedback) {
        if (feedback.getGithubIssueUrl() != null) {
            body.append("Issue: ").append(feedback.getGithubIssueUrl()).append('\n');
            return;
        }
        if (!github.isEnabled()) {
            return;
        }
        String base = props.publicBaseUrl();
        if (base == null || base.isBlank()) {
            return;
        }
        String token = PromoteToken.sign(props.jwt().secret(), feedback.getId());
        String url = base.replaceAll("/+$", "")
                + "/api/feedback/" + feedback.getId() + "/promote?token=" + token;
        String why = Boolean.TRUE.equals(feedback.getAiWorthDoing())
                ? "No issue filed yet (GitHub may be unconfigured). File one:"
                : "AI verdict: skip. File it as an issue anyway:";
        body.append('\n').append(why).append('\n').append(url).append('\n');
    }

    private SimpleMailMessage buildEmail(Feedback feedback, Briefing briefing) {
        String subject = briefing != null
                ? "[FNTS %s] %s".formatted(briefing.category(), briefing.summary())
                : "[FNTS feedback] from %s".formatted(feedback.getUser().getUsername());

        StringBuilder body = new StringBuilder();
        if (briefing != null) {
            body.append(briefing.summary()).append("\n\n")
                    .append("Category: ").append(briefing.category()).append('\n')
                    .append("Effort:   ").append(briefing.effort()).append("\n\n")
                    .append("Verdict\n")
                    .append("-------\n")
                    .append(briefing.verdict()).append("\n\n");
        } else {
            body.append("(AI briefing unavailable — raw feedback below.)\n\n");
        }

        body.append("Original feedback\n")
                .append("-----------------\n")
                .append(feedback.getMessage()).append("\n\n")
                .append("From:  ").append(feedback.getUser().getUsername())
                .append(" <").append(feedback.getUser().getEmail()).append(">\n")
                .append("Page:  ").append(feedback.getPage() == null ? "unknown" : feedback.getPage())
                .append('\n')
                .append("Sent:  ").append(STAMP.format(feedback.getCreatedAt())).append('\n')
                .append("Ref:   feedback #").append(feedback.getId()).append('\n');

        appendIssueLine(body, feedback);

        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setTo(props.feedback().notifyTo());
        String from = props.feedback().notifyFrom();
        if (from != null && !from.isBlank()) {
            mail.setFrom(from);
        }
        mail.setSubject(subject.length() > 180 ? subject.substring(0, 177) + "..." : subject);
        mail.setText(body.toString());
        return mail;
    }
}
