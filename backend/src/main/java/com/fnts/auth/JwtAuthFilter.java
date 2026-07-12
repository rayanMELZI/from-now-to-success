package com.fnts.auth;

import java.io.IOException;
import java.util.List;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = jwtService.parse(header.substring(7));
                CurrentUser principal = new CurrentUser(
                        Long.valueOf(claims.getSubject()),
                        claims.get("email", String.class),
                        claims.get("role", String.class));

                var auth = new UsernamePasswordAuthenticationToken(
                        principal, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + principal.role())));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (JwtException | IllegalArgumentException e) {
                // Invalid or expired token: proceed unauthenticated; protected
                // endpoints will answer 401 via the AuthenticationEntryPoint.
                SecurityContextHolder.clearContext();
            }
        }

        chain.doFilter(request, response);
    }
}
