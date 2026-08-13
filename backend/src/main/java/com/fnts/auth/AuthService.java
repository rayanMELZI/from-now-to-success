package com.fnts.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.auth.AuthDtos.LoginRequest;
import com.fnts.auth.AuthDtos.RegisterRequest;
import com.fnts.auth.AuthDtos.TokenPair;
import com.fnts.auth.AuthDtos.UserInfo;
import com.fnts.common.ApiException;
import com.fnts.config.AppProperties;
import com.fnts.user.Levels;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final Duration refreshTtl;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder,
                       AppProperties props) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.refreshTtl = Duration.ofDays(props.refresh().ttlDays());
    }

    @Transactional
    public TokenPair register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw ApiException.conflict("An account with this email already exists");
        }
        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(user);
        return issueTokens(user);
    }

    @Transactional
    public TokenPair login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BadCredentialsException("bad credentials"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("bad credentials");
        }
        return issueTokens(user);
    }

    /**
     * Refresh-token rotation: the presented token is revoked and a fresh one is
     * issued. If a token that was ALREADY revoked is presented, someone is
     * replaying a stolen token — revoke everything for that user.
     */
    @Transactional
    public TokenPair refresh(String rawRefreshToken) {
        RefreshToken stored = refreshTokenRepository.findByTokenHash(sha256(rawRefreshToken))
                .orElseThrow(() -> ApiException.unauthorized("Unknown refresh token"));

        if (stored.isRevoked()) {
            refreshTokenRepository.revokeAllForUser(stored.getUser().getId());
            throw ApiException.unauthorized("Refresh token reuse detected; all sessions revoked");
        }
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("Refresh token expired");
        }

        stored.setRevoked(true);
        return issueTokens(stored.getUser());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenRepository.findByTokenHash(sha256(rawRefreshToken))
                .ifPresent(t -> t.setRevoked(true));
    }

    private TokenPair issueTokens(User user) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(sha256(raw));
        token.setExpiresAt(Instant.now().plus(refreshTtl));
        refreshTokenRepository.save(token);

        return new TokenPair(jwtService.generateAccessToken(user), raw, toUserInfo(user));
    }

    public static UserInfo toUserInfo(User user) {
        return new UserInfo(user.getId(), user.getUsername(), user.getEmail(),
                user.getTotalPoints(), Levels.levelFor(user.getTotalPoints()),
                user.getTimezone(), user.getReminderHour(),
                user.getDayEndHour(), user.getWeekStartDay(), user.isPlannerEnabled(),
                user.isPlanRepeatDaily());
    }

    /** Refresh tokens are stored hashed so a DB leak doesn't leak usable tokens. */
    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
