-- Testlar katalogi (bosqichlar, imtihon) va xavfsizlik (RLS).
BEGIN;

-- Sessiya: qaysi test, imtihon uchun vaqt chegarasi.
ALTER TABLE quiz_sessions
  ADD COLUMN test_id TEXT NOT NULL DEFAULT 'mixed',
  ADD COLUMN deadline_at TIMESTAMPTZ;

ALTER TABLE quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_mode_check;
ALTER TABLE quiz_sessions ADD CONSTRAINT quiz_sessions_mode_check CHECK (mode IN ('quiz', 'mistakes', 'exam'));

-- Bir vaqtda bitta faol sessiya — endi test bo‘yicha.
DROP INDEX IF EXISTS quiz_sessions_one_active_uq;
CREATE UNIQUE INDEX quiz_sessions_one_active_uq ON quiz_sessions (child_id, subject, grade, mode, test_id) WHERE status = 'active';

-- Natija: test va imtihon bahosi.
ALTER TABLE results
  ADD COLUMN test_id TEXT NOT NULL DEFAULT 'mixed',
  ADD COLUMN mark SMALLINT CHECK (mark BETWEEN 2 AND 5);
CREATE INDEX results_test_idx ON results (child_id, subject, grade, test_id);

-- RLS: barcha jadvallarda yoqiladi, siyosat yo‘q => Supabase ochiq API orqali kirish yopiq.
-- Backend egasi (postgres) sifatida ulanadi va RLS ni chetlab o‘tadi.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Supabase rollari bo‘lsa (lokal bazada yo‘q), ularning huquqlarini olib tashlaymiz.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
  END IF;
END $$;

INSERT INTO schema_migrations (version) VALUES ('003_tests_and_security');

COMMIT;
