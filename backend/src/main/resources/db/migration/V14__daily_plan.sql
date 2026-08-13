-- Daily plan: an opt-in timeline of the day ("(12:00) Planning", "(12:10) prayer").
-- Hidden until the user turns it on, so a new account never meets an empty page
-- it did not ask for.
ALTER TABLE users
    ADD COLUMN planner_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE plan_blocks (
    id           BIGSERIAL   PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    plan_date    DATE        NOT NULL,
    -- Minutes since midnight (0..1439): sortable, timezone-free, and the only
    -- thing a block needs — the next block's start is this one's end.
    start_minute INT         NOT NULL,
    -- Encrypted free text (AES-256-GCM + base64 overflows VARCHAR).
    title        TEXT        NOT NULL,
    -- The habit this block stands for, if it was picked from the roadmap.
    -- Deleting the habit only unlinks the block; the plan itself survives.
    habit_id     BIGINT      REFERENCES habits (id) ON DELETE SET NULL,
    done         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_blocks_day ON plan_blocks (user_id, plan_date, start_minute);
CREATE INDEX idx_plan_blocks_habit ON plan_blocks (habit_id);
