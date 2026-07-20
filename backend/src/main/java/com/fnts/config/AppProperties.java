package com.fnts.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        Refresh refresh,
        Push push,
        Feedback feedback,
        boolean secureCookies
) {
    public record Jwt(String secret, int accessTtlMinutes) {}

    public record Refresh(int ttlDays) {}

    public record Push(String vapidPublicKey, String vapidPrivateKey, String subject) {}

    /**
     * Feedback briefings. Blank geminiApiKey or notifyTo disables the
     * pipeline entirely — feedback is still stored, just not summarised.
     */
    public record Feedback(String geminiApiKey, String geminiModel, String geminiBaseUrl,
                           String notifyTo, String notifyFrom) {}
}
