-- Encrypted values (IV + ciphertext + GCM tag, base64, with a version prefix)
-- are much longer than the plaintext, so the columns that now hold ciphertext
-- must become TEXT. (feedback.message / ai_summary / ai_verdict are already TEXT.)
ALTER TABLE habits ALTER COLUMN name TYPE TEXT;
ALTER TABLE habits ALTER COLUMN description TYPE TEXT;
ALTER TABLE habit_logs ALTER COLUMN reason TYPE TEXT;
