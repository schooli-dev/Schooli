ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

UPDATE users
SET timezone = 'Asia/Kolkata'
WHERE timezone IS NULL OR TRIM(timezone) = '';
