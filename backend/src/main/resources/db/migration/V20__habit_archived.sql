-- A habit (and the branch hanging off it) put away for now: off the map and
-- the check-in, progress kept as it was, ready to come back later.
-- Habits archived together share the same instant, so restoring the branch
-- root brings back exactly that branch.
ALTER TABLE habits
    ADD COLUMN archived_at TIMESTAMPTZ;
