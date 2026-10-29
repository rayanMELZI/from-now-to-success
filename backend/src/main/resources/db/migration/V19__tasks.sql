-- Tasks: an opt-in list of one-off things to get done ("call the bank",
-- "buy a charger"). Unlike habits they carry no game rules — no points, no
-- gauge, no streak. Hidden until the user turns it on, like the daily plan.
ALTER TABLE users
    ADD COLUMN tasks_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE tasks (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Encrypted free text (AES-256-GCM + base64 overflows VARCHAR).
    title      TEXT        NOT NULL,
    -- Optional day it should be done by; no time, a task is not an appointment.
    due_date   DATE,
    done       BOOLEAN     NOT NULL DEFAULT FALSE,
    done_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user ON tasks (user_id, done);

-- A plan line can stand for a task, the way it can stand for a habit:
-- ticking the line ticks the task. Deleting the task only unlinks the line.
ALTER TABLE plan_blocks
    ADD COLUMN task_id BIGINT REFERENCES tasks (id) ON DELETE SET NULL;

CREATE INDEX idx_plan_blocks_task ON plan_blocks (task_id);
