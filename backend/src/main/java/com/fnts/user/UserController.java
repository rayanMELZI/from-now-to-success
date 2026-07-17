package com.fnts.user;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fnts.auth.AuthDtos.UserInfo;
import com.fnts.auth.AuthService;
import com.fnts.auth.CurrentUser;
import com.fnts.common.ApiException;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/api/users")
public class UserController {

    public record SettingsRequest(String timezone,
                                  @Min(0) @Max(23) Integer reminderHour,
                                  @Min(0) @Max(23) Integer dayEndHour,
                                  @Min(1) @Max(7) Integer weekStartDay) {}

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public UserInfo me(@AuthenticationPrincipal CurrentUser current) {
        return AuthService.toUserInfo(load(current));
    }

    @PatchMapping("/me/settings")
    public UserInfo updateSettings(@AuthenticationPrincipal CurrentUser current,
                                   @Valid @RequestBody SettingsRequest request) {
        User user = load(current);
        if (request.timezone() != null) {
            try {
                java.time.ZoneId.of(request.timezone());
            } catch (Exception e) {
                throw ApiException.badRequest("Unknown timezone: " + request.timezone());
            }
            user.setTimezone(request.timezone());
        }
        if (request.reminderHour() != null) {
            user.setReminderHour(request.reminderHour());
        }
        if (request.dayEndHour() != null) {
            user.setDayEndHour(request.dayEndHour());
        }
        if (request.weekStartDay() != null) {
            user.setWeekStartDay(request.weekStartDay());
        }
        return AuthService.toUserInfo(userRepository.save(user));
    }

    private User load(CurrentUser current) {
        return userRepository.findById(current.id())
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
