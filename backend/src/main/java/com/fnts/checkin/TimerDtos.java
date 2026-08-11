package com.fnts.checkin;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.Size;

public class TimerDtos {

    /** Owning up to a relapse. A reason halves the point penalty, as with a miss. */
    public record FallRequest(@Size(max = 500) String reason) {}

    public record FallResult(
            int earnedPoints,
            int totalPoints,
            int level,
            /** How long the run that just ended lasted. */
            long lastRunSeconds,
            long bestCleanSeconds,
            boolean newRecord,
            /** Habits that lost their unlock because this one left VALID. */
            List<String> relocked) {}

    /** One past attempt, newest first — the progression the user is chasing. */
    public record RunEntry(
            Instant startedAt,
            Instant endedAt,
            long durationSeconds,
            int milestonesHit,
            String reason) {}

    private TimerDtos() {}
}
