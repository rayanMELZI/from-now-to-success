package com.fnts.checkin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.fnts.common.ApiException;

/**
 * Where a relapse is allowed to sit on the clock. Reporting a slip hours
 * after it happened must not cost the user the clean hours since — but it
 * also must not let them invent time they never had.
 */
class SlipMomentTest {

    private static final Instant STARTED = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant NOW = STARTED.plus(Duration.ofDays(2));

    @Test
    void noMomentGivenMeansRightNow() {
        assertEquals(NOW, TimerService.resolveMoment(null, STARTED, NOW));
    }

    @Test
    void aMomentInsideTheRunIsTakenAsGiven() {
        Instant lastNight = NOW.minus(Duration.ofHours(14));
        assertEquals(lastNight, TimerService.resolveMoment(lastNight, STARTED, NOW));
    }

    @Test
    void theInstantTheClockStartedIsStillInsideTheRun() {
        assertEquals(STARTED, TimerService.resolveMoment(STARTED, STARTED, NOW));
    }

    @Test
    void aSlipBeforeTheRunBeganIsRefused() {
        Instant tooEarly = STARTED.minus(Duration.ofSeconds(1));
        assertThrows(ApiException.class,
                () -> TimerService.resolveMoment(tooEarly, STARTED, NOW));
    }

    @Test
    void aDeviceClockRunningSlightlyFastIsPulledBackToNow() {
        Instant skewed = NOW.plus(Duration.ofMinutes(2));
        assertEquals(NOW, TimerService.resolveMoment(skewed, STARTED, NOW));
    }

    @Test
    void aSlipGenuinelyInTheFutureIsRefused() {
        Instant tomorrow = NOW.plus(Duration.ofDays(1));
        assertThrows(ApiException.class,
                () -> TimerService.resolveMoment(tomorrow, STARTED, NOW));
    }
}
