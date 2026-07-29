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
 * Files one GitHub issue via the REST API.
 *
 * Disabled (isEnabled() == false) unless both a token and a repo are set, so
 * the feedback pipeline runs exactly as before when GitHub is not configured.
 * Throws on any failure so the caller can record it and retry on the next tick,
 * mirroring {@link GeminiClient}.
 */
@Component
public class GithubIssueClient {

    private final AppProperties props;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public GithubIssueClient(AppProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(props.github().baseUrl())
                .requestFactory(clientRequestFactory())
                .build();
    }

    private static org.springframework.http.client.ClientHttpRequestFactory clientRequestFactory() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(20));
        return factory;
    }

    public boolean isEnabled() {
        String token = props.github().token();
        String repo = props.github().repo();
        return token != null && !token.isBlank() && repo != null && !repo.isBlank();
    }

    /**
     * Creates an issue and returns its html_url. {@code repo} is "owner/name".
     * Labels are created automatically by GitHub if they don't exist yet.
     */
    public String createIssue(String title, String body, List<String> labels) {
        Map<String, Object> payload = Map.of(
                "title", title,
                "body", body,
                "labels", labels);

        String response = restClient.post()
                .uri("/repos/{repo}/issues", props.github().repo())
                .header("Authorization", "Bearer " + props.github().token())
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .header("Content-Type", "application/json")
                .body(payload)
                .retrieve()
                .body(String.class);

        JsonNode root = objectMapper.readTree(response);
        String url = root.path("html_url").stringValue("");
        if (url.isBlank()) {
            throw new IllegalStateException("GitHub returned no issue url: " + response);
        }
        return url;
    }
}
