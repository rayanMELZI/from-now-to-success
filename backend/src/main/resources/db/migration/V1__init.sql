CREATE TABLE users (
    id                 BIGSERIAL PRIMARY KEY,
    username           VARCHAR(50)  NOT NULL,
    email              VARCHAR(255) NOT NULL UNIQUE,
    password_hash      VARCHAR(100) NOT NULL,
    role               VARCHAR(20)  NOT NULL DEFAULT 'USER',
    total_points       INT          NOT NULL DEFAULT 0,
    timezone           VARCHAR(60)  NOT NULL DEFAULT 'UTC',
    reminder_hour      INT          NOT NULL DEFAULT 21,
    last_reminder_date DATE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64)  NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ  NOT NULL,
    revoked    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE habits (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name               VARCHAR(100) NOT NULL,
    description        VARCHAR(500),
    base_points        INT          NOT NULL DEFAULT 10,
    required_streak    INT          NOT NULL DEFAULT 7,
    status             VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    current_streak     INT          NOT NULL DEFAULT 0,
    best_streak        INT          NOT NULL DEFAULT 0,
    consecutive_misses INT          NOT NULL DEFAULT 0,
    start_date         DATE         NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_habits_user ON habits (user_id);

CREATE TABLE habit_prerequisites (
    habit_id        BIGINT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    prerequisite_id BIGINT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    PRIMARY KEY (habit_id, prerequisite_id)
);

CREATE TABLE habit_logs (
    id             BIGSERIAL PRIMARY KEY,
    habit_id       BIGINT      NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    log_date       DATE        NOT NULL,
    status         VARCHAR(20) NOT NULL,
    points_awarded INT         NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (habit_id, log_date)
);

CREATE INDEX idx_habit_logs_habit_date ON habit_logs (habit_id, log_date);

CREATE TABLE push_subscriptions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    endpoint   TEXT        NOT NULL UNIQUE,
    p256dh     TEXT        NOT NULL,
    auth       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);
