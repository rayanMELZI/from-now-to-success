-- Habit replacement: a habit you are quitting can name the good habit you do
-- in its place. Quitting sticks better when something takes the empty slot.
-- Deleting the good habit only breaks the pairing, never the bad habit.
ALTER TABLE habits
    ADD COLUMN replacement_habit_id BIGINT REFERENCES habits (id) ON DELETE SET NULL;

CREATE INDEX idx_habits_replacement ON habits (replacement_habit_id);
