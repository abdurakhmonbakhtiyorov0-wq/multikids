-- Adaptiv qiyinlik: sessiyadagi siljish (-1 osonroq, 0 odatiy, +1 qiyinroq).
BEGIN;

ALTER TABLE quiz_sessions
  ADD COLUMN difficulty_offset SMALLINT NOT NULL DEFAULT 0 CHECK (difficulty_offset BETWEEN -1 AND 1);

INSERT INTO schema_migrations (version) VALUES ('002_adaptive');

COMMIT;
