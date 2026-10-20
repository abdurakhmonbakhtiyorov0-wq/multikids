-- Sinf profillari: bitta o‘quvchi (person_id) har bir sinf uchun alohida o‘yin profiliga ega.
-- Sinf almashtirilganda eski sinfdagi ball, daraja, yutuq va natijalar o‘sha profilda qoladi, yangi sinf noldan boshlanadi;
-- avvalgi sinfga qaytilsa, eski profil qaytadi. Mavjud qatorlar o‘z-o‘zining person_id siga ega bo‘ladi.
BEGIN;

ALTER TABLE children ADD COLUMN person_id UUID;
UPDATE children SET person_id = id;

-- Yangi qator yaratilganda person_id ko‘rsatilmasa — o‘z id siga teng (trigger NOT NULL tekshiruvidan oldin ishlaydi)
CREATE FUNCTION children_set_person() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.person_id IS NULL THEN NEW.person_id := NEW.id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER children_person_trg BEFORE INSERT ON children FOR EACH ROW EXECUTE FUNCTION children_set_person();

ALTER TABLE children ALTER COLUMN person_id SET NOT NULL;
CREATE INDEX children_person_idx ON children (person_id);
-- Bir o‘quvchining bitta sinfi uchun faqat bitta profil
CREATE UNIQUE INDEX children_person_grade_uq ON children (person_id, grade) WHERE grade IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('007_grade_profiles');

COMMIT;
