package com.fnts.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        Refresh refresh,
        Push push,
        boolean secureCookies
) {
    public record Jwt(String secret, int accessTtlMinutes) {}

    public record Refresh(int ttlDays) {}

    public record Push(String vapidPublicKey, String vapidPrivateKey, String subject) {}
}
