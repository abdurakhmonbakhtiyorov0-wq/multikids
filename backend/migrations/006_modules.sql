-- Modullar: 1–11-sinflar va maxsus modul (SAT) uchun sinf oralig‘i 1..12 (12 = maxsus modul).
BEGIN;

-- Eski "grade BETWEEN 1 AND 4" cheklovlarini topib olib tashlaymiz (nomi avtomatik berilgan bo‘lishi mumkin).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname, rel.relname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
     WHERE con.contype = 'c' AND rel.relname IN ('children', 'questions') AND pg_get_constraintdef(con.oid) ILIKE '%grade%'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', c.relname, c.conname);
  END LOOP;
END $$;

ALTER TABLE children ADD CONSTRAINT children_grade_check CHECK (grade BETWEEN 1 AND 12);
ALTER TABLE questions ADD CONSTRAINT questions_grade_check CHECK (grade BETWEEN 1 AND 12);

INSERT INTO schema_migrations (version) VALUES ('006_modules');

COMMIT;
