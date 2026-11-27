-- Plan presets: a named day template ("Workday", "Gym day", "Sunday") that an
-- empty day can start from, instead of from nothing or from another day's
-- plan that happened to be close enough.
CREATE TABLE plan_presets (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Encrypted free text, like plan lines.
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_presets_user ON plan_presets (user_id);

-- The lines of a preset: the same shape as a plan block, minus the date, the
-- tick and the task — a task is a one-off, it has no place in a template.
CREATE TABLE plan_preset_lines (
    id         BIGSERIAL PRIMARY KEY,
    preset_id  BIGINT    NOT NULL REFERENCES plan_presets (id) ON DELETE CASCADE,
    end_minute INT       NOT NULL,
    title      TEXT      NOT NULL,
    -- Deleting the habit only unlinks the line; the preset keeps its title.
    habit_id   BIGINT    REFERENCES habits (id) ON DELETE SET NULL
);

CREATE INDEX idx_plan_preset_lines_preset ON plan_preset_lines (preset_id);
CREATE INDEX idx_plan_preset_lines_habit ON plan_preset_lines (habit_id);
