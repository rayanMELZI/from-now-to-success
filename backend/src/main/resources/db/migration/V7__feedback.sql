CREATE TABLE feedback (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message    TEXT        NOT NULL,
    page       VARCHAR(100),
    -- Lifecycle for whoever (or whatever) triages this later: NEW -> PLANNED
    -- / REJECTED -> DONE. Nothing sets anything but NEW yet.
    status     VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_created ON feedback (created_at DESC);
