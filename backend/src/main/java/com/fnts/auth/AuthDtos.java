package com.fnts.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 50) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 100) String password) {}

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password) {}

    public record UserInfo(Long id, String username, String email,
                           int totalPoints, int level, String timezone, int reminderHour) {}

    public record AuthResponse(String accessToken, UserInfo user) {}

    /** Internal pair: the access JWT plus the raw refresh token that goes in the cookie. */
    public record TokenPair(String accessToken, String refreshToken, UserInfo user) {}

    private AuthDtos() {}
}
