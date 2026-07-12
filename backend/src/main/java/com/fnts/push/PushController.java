package com.fnts.push;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.fnts.auth.CurrentUser;
import com.fnts.common.ApiException;
import com.fnts.config.AppProperties;
import com.fnts.user.UserRepository;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

@RestController
@RequestMapping("/api/push")
public class PushController {

    public record SubscribeRequest(@NotBlank String endpoint,
                                   @NotBlank String p256dh,
                                   @NotBlank String auth) {}

    private final PushSubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final AppProperties props;

    public PushController(PushSubscriptionRepository subscriptionRepository,
                          UserRepository userRepository,
                          AppProperties props) {
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
        this.props = props;
    }

    /** The frontend needs this key to ask the browser for a push subscription. */
    @GetMapping("/public-key")
    public Map<String, String> publicKey() {
        return Map.of("publicKey", props.push().vapidPublicKey() == null
                ? "" : props.push().vapidPublicKey());
    }

    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public void subscribe(@AuthenticationPrincipal CurrentUser user,
                          @Valid @RequestBody SubscribeRequest request) {
        PushSubscription sub = subscriptionRepository
                .findByEndpoint(request.endpoint())
                .orElseGet(PushSubscription::new);
        sub.setUser(userRepository.findById(user.id())
                .orElseThrow(() -> ApiException.notFound("User not found")));
        sub.setEndpoint(request.endpoint());
        sub.setP256dh(request.p256dh());
        sub.setAuth(request.auth());
        subscriptionRepository.save(sub);
    }

    @DeleteMapping("/subscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void unsubscribe(@AuthenticationPrincipal CurrentUser user,
                            @Valid @RequestBody SubscribeRequest request) {
        subscriptionRepository.deleteByEndpointAndUserId(request.endpoint(), user.id());
    }
}
