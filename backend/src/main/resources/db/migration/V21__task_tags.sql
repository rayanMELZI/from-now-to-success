-- Tags on tasks: a small per-user set of coloured labels ("work", "errands")
-- that a task can carry several of. Renaming or recolouring a tag changes it
-- on every task at once; deleting it only takes it off them.
CREATE TABLE task_tags (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Encrypted free text, like task titles.
    name       TEXT        NOT NULL,
    -- One of the app's palette names ("red", "sky"…), not a raw hex value.
    color      VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_tags_user ON task_tags (user_id);

CREATE TABLE task_tag_links (
    task_id BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES task_tags (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX idx_task_tag_links_tag ON task_tag_links (tag_id);
