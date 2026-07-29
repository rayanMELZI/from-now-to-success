package com.fnts.feedback;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fnts.config.AppProperties;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Asks Gemini to triage one piece of feedback.
 *
 * The model is pinned to JSON output with a response schema, so the reply
 * parses deterministically instead of needing prose scraping.
 */
@Component
public class GeminiClient {

    public record Briefing(String summary, String category, String effort, String verdict,
                           boolean worthDoing, String issueTitle) {}

    private static final String PROMPT = """
            You are triaging a user feature request / bug report for a habit-tracking
            web app called fromNowToSuccess. The app has: a roadmap of habits shown as
            a node graph, habits that validate via a "gauge" that fills when you do
            them and drains when you miss, daily/weekly/monthly schedules, build-vs-quit
            habit types, streak freezes, points and levels, push notification reminders,
            dark mode, and a PWA install.

            Judge this feedback for the solo developer who maintains the app.
            Be direct and concise. If the idea is vague, say so. If it already exists,
            say so. Do not flatter.

            The feedback (from user "%s", sent from the %s page):
            ---
            %s
            ---
            """;

    private final AppProperties props;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public GeminiClient(AppProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(props.feedback().geminiBaseUrl())
                .requestFactory(clientRequestFactory())
                .build();
    }

    private static org.springframework.http.client.ClientHttpRequestFactory clientRequestFactory() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(45));
        return factory;
    }

    public boolean isEnabled() {
        String key = props.feedback().geminiApiKey();
        return key != null && !key.isBlank();
    }

    /** Throws on any transport/parse failure so the caller can retry later. */
    public Briefing summarise(String username, String page, String message) {
        Map<String, Object> schema = Map.of(
                "type", "object",
                "properties", Map.of(
                        "summary", Map.of("type", "string",
                                "description", "One sentence: what the user is asking for."),
                        "category", Map.of("type", "string",
                                "enum", List.of("BUG", "FEATURE", "UX", "PERFORMANCE", "OTHER")),
                        "effort", Map.of("type", "string",
                                "enum", List.of("TRIVIAL", "SMALL", "MEDIUM", "LARGE", "UNCLEAR")),
                        "verdict", Map.of("type", "string",
                                "description", "2-3 sentences: is this worth building, and why or why not?"),
                        "worthDoing", Map.of("type", "boolean",
                                "description", "true only if this is a concrete, worthwhile change the "
                                        + "developer should actually put on the backlog. false for vague "
                                        + "ideas, things that already exist, or not worth the effort."),
                        "issueTitle", Map.of("type", "string",
                                "description", "A short imperative GitHub-issue title, e.g. "
                                        + "\"Group the check-in list by schedule\". Always fill it in.")),
                "required", List.of("summary", "category", "effort", "verdict", "worthDoing", "issueTitle"));

        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(Map.of("text",
                                PROMPT.formatted(username, page == null ? "unknown" : page, message))))),
                "generationConfig", Map.of(
                        "temperature", 0.2,
                        "responseMimeType", "application/json",
                        "responseSchema", schema));

        String response = restClient.post()
                .uri("/models/{model}:generateContent", props.feedback().geminiModel())
                .header("x-goog-api-key", props.feedback().geminiApiKey())
                .header("Content-Type", "application/json")
                .body(body)
                .retrieve()
                .body(String.class);

        // Jackson 3 throws unchecked JacksonException; let it propagate to
        // the notifier, which records the failure and schedules a retry.
        JsonNode root = objectMapper.readTree(response);
        String json = root.path("candidates").path(0)
                .path("content").path("parts").path(0).path("text").stringValue("");
        if (json.isBlank()) {
            throw new IllegalStateException("Gemini returned no usable text: " + response);
        }
        JsonNode parsed = objectMapper.readTree(json);
        return new Briefing(
                parsed.path("summary").stringValue(""),
                parsed.path("category").stringValue(""),
                parsed.path("effort").stringValue(""),
                parsed.path("verdict").stringValue(""),
                parsed.path("worthDoing").booleanValue(false),
                parsed.path("issueTitle").stringValue(""));
    }
}
