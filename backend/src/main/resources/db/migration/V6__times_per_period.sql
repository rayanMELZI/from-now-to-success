ALTER TABLE habits
    ADD COLUMN times_per_period INT NOT NULL DEFAULT 1,
    -- period-start of the last week/month whose outcome was applied
    ADD COLUMN last_evaluated_period DATE;

-- Existing weekly/monthly logs were keyed by period start and evaluated
-- immediately, so the newest log marks the last handled period.
UPDATE habits h
SET last_evaluated_period = (SELECT MAX(l.log_date) FROM habit_logs l WHERE l.habit_id = h.id)
WHERE h.schedule <> 'DAILY';
