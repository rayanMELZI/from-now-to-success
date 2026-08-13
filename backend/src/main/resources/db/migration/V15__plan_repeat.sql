-- The daily plan as a routine: a new day opens with a copy of the last one
-- instead of an empty page, so a routine is written once and lived daily.
ALTER TABLE users
    ADD COLUMN plan_repeat_daily BOOLEAN NOT NULL DEFAULT FALSE,
    -- The last day seeded from the routine. Without it, a day the user
    -- deliberately emptied would fill itself back up on the next page load.
    ADD COLUMN plan_seeded_date  DATE;
