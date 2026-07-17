package com.fnts.push;

import java.security.Security;
import java.util.List;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.config.AppProperties;

import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;

@Service
public class WebPushSender {

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);

    private final PushSubscriptionRepository subscriptionRepository;
    private final PushService pushService; // null when VAPID keys are not configured

    public WebPushSender(PushSubscriptionRepository subscriptionRepository, AppProperties props)
            throws Exception {
        this.subscriptionRepository = subscriptionRepository;

        if (props.push().vapidPublicKey() == null || props.push().vapidPublicKey().isBlank()) {
            log.warn("VAPID keys not configured; push notifications are disabled");
            this.pushService = null;
            return;
        }
        Security.addProvider(new BouncyCastleProvider());
        this.pushService = new PushService(
                props.push().vapidPublicKey(),
                props.push().vapidPrivateKey(),
                props.push().subject());
    }

    public boolean isEnabled() {
        return pushService != null;
    }

    /** Sends a payload to every device of the user; prunes dead subscriptions. */
    @Transactional
    public void sendToUser(Long userId, String jsonPayload) {
        if (!isEnabled()) {
            return;
        }
        List<PushSubscription> subscriptions = subscriptionRepository.findByUserId(userId);
        for (PushSubscription sub : subscriptions) {
            try {
                // TTL keeps the message queued while the phone dozes; HIGH
                // urgency asks the push service to deliver without delay.
                var notification = Notification.builder()
                        .endpoint(sub.getEndpoint())
                        .userPublicKey(sub.getP256dh())
                        .userAuth(sub.getAuth())
                        .payload(jsonPayload.getBytes(java.nio.charset.StandardCharsets.UTF_8))
                        .ttl(6 * 60 * 60)
                        .urgency(nl.martijndwars.webpush.Urgency.HIGH)
                        .build();
                var response = pushService.send(notification);
                int status = response.getStatusLine().getStatusCode();
                if (status == 404 || status == 410) {
                    // The browser unsubscribed or the endpoint expired.
                    subscriptionRepository.delete(sub);
                } else if (status >= 400) {
                    log.warn("Push to user {} failed with status {}", userId, status);
                }
            } catch (Exception e) {
                log.warn("Push to user {} failed: {}", userId, e.getMessage());
            }
        }
    }
}
