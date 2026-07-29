package com.fnts.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        Refresh refresh,
        Push push,
        Feedback feedback,
        Github github,
        Crypto crypto,
        String publicBaseUrl,
        boolean secureCookies
) {
    public record Jwt(String secret, int accessTtlMinutes) {}

    /** Base64 32-byte AES key for encrypting sensitive free-text at rest. */
    public record Crypto(String key) {}

    public record Refresh(int ttlDays) {}

    public record Push(String vapidPublicKey, String vapidPrivateKey, String subject) {}

    /**
     * Feedback briefings. Blank geminiApiKey or notifyTo disables the
     * pipeline entirely — feedback is still stored, just not summarised.
     */
    public record Feedback(String geminiApiKey, String geminiModel, String geminiBaseUrl,
                           String notifyTo, String notifyFrom) {}

    /**
     * Auto-filed GitHub issues for feedback the AI judges worth building.
     * Blank token or repo disables it — feedback is still briefed and emailed.
     */
    public record Github(String token, String repo, String baseUrl) {}
}
