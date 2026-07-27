package com.fnts.common;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * One-time (but idempotent) encryption of rows that predate encryption. Reads
 * raw column values with plain SQL — bypassing the converter — so it can tell
 * ciphertext (has the "fnts1:" prefix) from legacy plaintext, and only touches
 * the latter. After one run every value is prefixed, so subsequent runs match
 * nothing; it is safe to leave in place permanently.
 */
@Component
public class EncryptionBackfillRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EncryptionBackfillRunner.class);

    private record Target(String table, String column) {}

    private static final List<Target> TARGETS = List.of(
            new Target("habits", "name"),
            new Target("habits", "description"),
            new Target("habit_logs", "reason"),
            new Target("feedback", "message"),
            new Target("feedback", "ai_summary"),
            new Target("feedback", "ai_verdict"));

    private final JdbcTemplate jdbc;
    private final EncryptionService encryption;

    public EncryptionBackfillRunner(JdbcTemplate jdbc, EncryptionService encryption) {
        this.jdbc = jdbc;
        this.encryption = encryption;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int total = 0;
        for (Target t : TARGETS) {
            total += backfill(t);
        }
        if (total > 0) {
            log.info("Encryption backfill: encrypted {} legacy plaintext value(s)", total);
        }
    }

    private int backfill(Target t) {
        // Non-null values that are not already encrypted (raw read, no converter).
        String select = "SELECT id, %s AS val FROM %s WHERE %s IS NOT NULL AND %s NOT LIKE ?"
                .formatted(t.column(), t.table(), t.column(), t.column());
        List<Object[]> updates = jdbc.query(select,
                (rs, i) -> new Object[]{encryption.encrypt(rs.getString("val")), rs.getLong("id")},
                EncryptionService.PREFIX + "%");

        if (updates.isEmpty()) {
            return 0;
        }
        String update = "UPDATE %s SET %s = ? WHERE id = ?".formatted(t.table(), t.column());
        jdbc.batchUpdate(update, updates);
        return updates.size();
    }
}
