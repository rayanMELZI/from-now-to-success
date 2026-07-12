package com.fnts.auth;

import java.time.Duration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fnts.auth.AuthDtos.AuthResponse;
import com.fnts.auth.AuthDtos.LoginRequest;
import com.fnts.auth.AuthDtos.RegisterRequest;
import com.fnts.auth.AuthDtos.TokenPair;
import com.fnts.common.ApiException;
import com.fnts.config.AppProperties;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "fnts_refresh";

    private final AuthService authService;
    private final AppProperties props;

    public AuthController(AuthService authService, AppProperties props) {
        this.authService = authService;
        this.props = props;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return respondWithTokens(authService.register(request), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return respondWithTokens(authService.login(request), HttpStatus.OK);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        if (refreshToken == null) {
            throw ApiException.unauthorized("No refresh token");
        }
        return respondWithTokens(authService.refresh(refreshToken), HttpStatus.OK);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        if (refreshToken != null) {
            authService.logout(refreshToken);
        }
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .build();
    }

    private ResponseEntity<AuthResponse> respondWithTokens(TokenPair tokens, HttpStatus status) {
        ResponseCookie cookie = refreshCookie(
                tokens.refreshToken(), Duration.ofDays(props.refresh().ttlDays()));
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new AuthResponse(tokens.accessToken(), tokens.user()));
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(props.secureCookies())
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(maxAge)
                .build();
    }
}
