package com.fnts.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Service;

import com.fnts.config.AppProperties;
import com.fnts.user.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration accessTtl;

    public JwtService(AppProperties props) {
        if (props.jwt().secret() == null || props.jwt().secret().isBlank()) {
            throw new IllegalStateException(
                    "JWT_SECRET is not set. Generate one with: openssl rand -base64 48");
        }
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(props.jwt().secret()));
        this.accessTtl = Duration.ofMinutes(props.jwt().accessTtlMinutes());
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("role", user.getRole())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(key)
                .compact();
    }

    /** Returns the token's claims, or throws JwtException if invalid/expired. */
    public Claims parse(String token) throws JwtException {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
