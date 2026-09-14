-- A habit the user set aside in the plan composer's picker: still pickable,
-- but drawn back and listed after the ones they actually reach for.
ALTER TABLE habits
    ADD COLUMN planner_muted BOOLEAN NOT NULL DEFAULT FALSE;
