ALTER TABLE habits
    ADD COLUMN gauge INT NOT NULL DEFAULT 0;

-- Backfill: existing habits start with their streak as progress (capped),
-- and already-valid habits start with a full gauge.
UPDATE habits SET gauge = LEAST(current_streak, required_streak);
UPDATE habits SET gauge = required_streak WHERE status = 'VALID';
