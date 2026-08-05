ALTER TABLE habits
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

-- Seed the manual order with the creation order each user already sees.
UPDATE habits h
SET sort_order = ranked.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY id) AS rn FROM habits) ranked
WHERE h.id = ranked.id;
