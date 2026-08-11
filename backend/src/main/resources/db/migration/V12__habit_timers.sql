-- Timer habits: instead of answering a daily question, the habit runs a clock
-- that the user resets on every relapse. Milestones along the way pay points.
ALTER TABLE habits
    ADD COLUMN tracking_mode      VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    -- Clean duration that validates the habit (timer habits only).
    ADD COLUMN goal_seconds       BIGINT,
    -- When the current run started: creation, unlock, or the last relapse.
    ADD COLUMN clock_started_at   TIMESTAMPTZ,
    -- The longest run ever: the record the user is trying to beat.
    ADD COLUMN best_clean_seconds BIGINT      NOT NULL DEFAULT 0,
    -- The "you beat your record" bonus is paid once per run.
    ADD COLUMN record_bonus_paid  BOOLEAN     NOT NULL DEFAULT FALSE;

-- One row per finished run. habit_logs cannot hold these: it is UNIQUE on
-- (habit_id, log_date) and a user can relapse several times in one day.
CREATE TABLE habit_timer_runs (
    id               BIGSERIAL   PRIMARY KEY,
    habit_id         BIGINT      NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    started_at       TIMESTAMPTZ NOT NULL,
    ended_at         TIMESTAMPTZ NOT NULL,
    duration_seconds BIGINT      NOT NULL,
    milestones_hit   INT         NOT NULL DEFAULT 0,
    -- Encrypted free text (AES-256-GCM + base64 overflows VARCHAR).
    reason           TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_habit_timer_runs_habit ON habit_timer_runs (habit_id, ended_at DESC);
