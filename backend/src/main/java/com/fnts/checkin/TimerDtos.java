package com.fnts.checkin;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.Size;

public class TimerDtos {

    /**
     * Owning up to a relapse. A reason halves the point penalty, as with a
     * miss. {@code slippedAt} is when it actually happened — leave it out and
     * the relapse is stamped now, which is only right if you are reporting it
     * as it happens. Anything earlier keeps the record honest: the run that
     * ended is measured to that moment, and the fresh clock starts there too,
     * so a slip owned up to a day late does not cost you that clean day.
     */
    public record FallRequest(@Size(max = 500) String reason, Instant slippedAt) {}

    public record FallResult(
            int earnedPoints,
            int totalPoints,
            int level,
            /** How long the run that just ended lasted. */
            long lastRunSeconds,
            long bestCleanSeconds,
            boolean newRecord,
            /** Habits that lost their unlock because this one left VALID. */
            List<String> relocked,
            /**
             * What the fresh clock already reads: 0 for a slip reported as it
             * happens, the head start earned since for a backdated one.
             */
            long newRunSeconds) {}

    /** One past attempt, newest first — the progression the user is chasing. */
    public record RunEntry(
            Instant startedAt,
            Instant endedAt,
            long durationSeconds,
            int milestonesHit,
            String reason) {}

    private TimerDtos() {}
}
