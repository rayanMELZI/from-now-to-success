-- A plan line's time is when that thing is FINISHED, not when it begins:
-- "(21:00) work" means work is done at 21:00. The stored minute never changed
-- meaning for the user — the column was simply named after the wrong end of
-- the block, so a task ran from its own time instead of the previous one's.
ALTER TABLE plan_blocks RENAME COLUMN start_minute TO end_minute;

ALTER INDEX idx_plan_blocks_day RENAME TO idx_plan_blocks_day_end;
