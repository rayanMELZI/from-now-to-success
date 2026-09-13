-- Marks a log the catch-up wrote on the user's behalf (an unanswered day that
-- rolled past), as opposed to one the user actually answered.
--
-- Only an auto-generated log may be superseded by a late (offline-queued)
-- check-in: an answer you really gave can never be overwritten by a replay.
ALTER TABLE habit_logs
    ADD COLUMN auto_generated BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing rows predate the offline queue, so nothing may supersede them:
-- leaving them FALSE is the safe reading, not a guess about their origin.
