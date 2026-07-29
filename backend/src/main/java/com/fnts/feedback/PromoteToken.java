package com.fnts.feedback;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Signs the one-click "create issue" link that goes into a briefing email.
 *
 * The link is clicked from the developer's inbox, so it can't carry a JWT; a
 * short HMAC over the feedback id (keyed by the app's JWT secret) makes it
 * unforgeable without an extra secret or a login. It authorises exactly one
 * action — promoting one feedback row to an issue — and creation is
 * idempotent, so a replayed link does nothing new.
 */
final class PromoteToken {

    private PromoteToken() {}

    static String sign(String secret, long feedbackId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] sig = mac.doFinal(("promote:" + feedbackId).getBytes(StandardCharsets.UTF_8));
            // 16 bytes (32 hex chars) is plenty to resist forgery here.
            return HexFormat.of().formatHex(sig, 0, 16);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot sign promote token", e);
        }
    }

    static boolean verify(String secret, long feedbackId, String token) {
        if (token == null) {
            return false;
        }
        String expected = sign(secret, feedbackId);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                token.getBytes(StandardCharsets.UTF_8));
    }
}
