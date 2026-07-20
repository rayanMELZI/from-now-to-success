ALTER TABLE feedback
    -- Gemini's briefing, filled in when the notification succeeds.
    ADD COLUMN ai_summary  TEXT,
    ADD COLUMN ai_category VARCHAR(30),
    ADD COLUMN ai_effort   VARCHAR(20),
    ADD COLUMN ai_verdict  TEXT,
    -- Delivery tracking: notified_at IS NULL means "still owed an email".
    ADD COLUMN notified_at TIMESTAMPTZ,
    ADD COLUMN attempts    INT NOT NULL DEFAULT 0,
    ADD COLUMN last_error  VARCHAR(500);

-- The retry job scans for undelivered rows; keep that lookup cheap.
CREATE INDEX idx_feedback_undelivered ON feedback (notified_at) WHERE notified_at IS NULL;
