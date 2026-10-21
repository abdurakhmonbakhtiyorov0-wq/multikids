-- Ota-ona kabineti: PIN, kirish urinishlari cheklovi (bazada), parol tiklash va rozilik uchun.
BEGIN;

ALTER TABLE users ADD COLUMN parent_pin_hash TEXT;

-- Urinishlar hisoblagichi (serverless'da xotira ishonchsiz, shuning uchun bazada).
CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count        INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

INSERT INTO schema_migrations (version) VALUES ('005_parent');

COMMIT;
