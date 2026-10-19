-- MultiKids: boshlang‘ich PostgreSQL sxemasi.
-- pgAdmin: bo‘sh "multikids" bazasini tanlang -> Query Tool -> shu faylni ochib Execute (F5).
-- Hammasi bitta tranzaksiyada: xato bo‘lsa hech narsa yaratilmaydi.
-- DIQQAT: bu sxema eski (users/results) jadvallarni almashtiradi — bo‘sh bazada ishga tushiring.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ============================================================
-- 1. Akkauntlar (ota-onalar) va bolalar profillari
-- ============================================================

-- Ota-ona akkaunti. Bola alohida profil (children), shuning uchun bolaning email/paroli yo‘q.
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'uz' CHECK (locale IN ('uz', 'ru')),
  token_version INTEGER NOT NULL DEFAULT 0,           -- oshirilsa barcha eski JWT bekor bo‘ladi
  deleted_at    TIMESTAMPTZ,                          -- o‘chirish so‘rovi (soft delete)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email)) WHERE deleted_at IS NULL;

-- Ota-ona roziligi (bolalar ma‘lumotlari uchun), versiyalangan.
CREATE TABLE parental_consents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version     TEXT NOT NULL,                          -- masalan '2026-10'
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);

-- Parolni tiklash: faqat token HESHI saqlanadi, bir martalik, muddatli.
CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_user_idx ON password_reset_tokens (user_id);

-- Bola profili: bitta ota-onada bir nechta. Balans, daraja, streak va sozlamalar shu yerda.
CREATE TABLE children (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 30),
  grade             SMALLINT CHECK (grade BETWEEN 1 AND 4),
  mascot            TEXT,
  subject           TEXT,                              -- oxirgi tanlangan fan
  -- Sozlamalar
  locale            TEXT NOT NULL DEFAULT 'uz' CHECK (locale IN ('uz', 'ru')),
  sound_enabled     BOOLEAN NOT NULL DEFAULT true,
  voice_autoplay    BOOLEAN NOT NULL DEFAULT false,
  timezone          TEXT NOT NULL DEFAULT 'Asia/Tashkent',
  -- O‘yin holati (server hisoblaydi; o‘zgarishlar faqat point_ledger orqali)
  points_balance    INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  xp                INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level             SMALLINT NOT NULL DEFAULT 1 CHECK (level >= 1),
  -- Kunlik seriya
  current_streak    INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak       INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  last_active_day   DATE,
  daily_goal        SMALLINT NOT NULL DEFAULT 1 CHECK (daily_goal BETWEEN 1 AND 10),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, parent_id)                               -- ota-ona <-> bola bog‘lanishini tekshirish uchun
);
CREATE INDEX children_parent_idx ON children (parent_id);

-- ============================================================
-- 2. Savollar banki
-- ============================================================

CREATE TABLE questions (
  id            TEXT PRIMARY KEY,                      -- masalan 'english-g3-04' (hozirgi ID lar saqlanadi)
  subject       TEXT NOT NULL,
  grade         SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 4),
  topic         TEXT NOT NULL DEFAULT 'general',
  difficulty    SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 3), -- 1 oson, 2 o‘rta, 3 qiyin
  kind          TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image')),
  prompt        JSONB NOT NULL,                        -- {"uz": "...", "ru": "..."}
  options       JSONB NOT NULL,                        -- {"uz": ["..",..], "ru": [..]}
  correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 5),
  explanation   JSONB,                                 -- {"uz": "...", "ru": "..."}
  image_path    TEXT,                                  -- lokal asset yo‘li
  image_alt     JSONB,                                 -- {"uz": "...", "ru": "..."}
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX questions_pick_idx ON questions (grade, subject, difficulty) WHERE active;

-- ============================================================
-- 3. Test sessiyalari (holat bazada — "sessiya topilmadi" xatosi yo‘qoladi)
-- ============================================================

CREATE TABLE quiz_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  mode             TEXT NOT NULL DEFAULT 'quiz' CHECK (mode IN ('quiz', 'mistakes')),
  grade            SMALLINT NOT NULL,
  subject          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'expired', 'abandoned')),
  total            SMALLINT NOT NULL DEFAULT 20,
  current_index    SMALLINT NOT NULL DEFAULT 0,
  current_difficulty SMALLINT NOT NULL DEFAULT 1 CHECK (current_difficulty BETWEEN 1 AND 3),
  correct_streak   SMALLINT NOT NULL DEFAULT 0,        -- adaptiv qiyinlik uchun ketma-ket to‘g‘ri
  wrong_streak     SMALLINT NOT NULL DEFAULT 0,        -- ketma-ket noto‘g‘ri
  question_ids     TEXT[] NOT NULL DEFAULT '{}',       -- hozircha tanlangan (tartib bilan)
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  finished_at      TIMESTAMPTZ
);
CREATE INDEX quiz_sessions_child_idx ON quiz_sessions (child_id, status);
-- Bolada bir vaqtda bitta faol sessiya (shu fan/rejim bo‘yicha) — davom ettirish oson.
CREATE UNIQUE INDEX quiz_sessions_one_active_uq ON quiz_sessions (child_id, subject, grade, mode) WHERE status = 'active';

-- Har bir javob: tarix, xatolar tahlili va qayta yuborishdan himoya.
CREATE TABLE quiz_answers (
  session_id   UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  position     SMALLINT NOT NULL,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  chosen_index SMALLINT,
  is_correct   BOOLEAN NOT NULL,
  answered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, position),
  UNIQUE (session_id, question_id)
);
CREATE INDEX quiz_answers_child_idx ON quiz_answers (child_id, question_id);

-- Yakuniy natija. session_id UNIQUE: bitta sessiya uchun mukofot faqat bir marta.
CREATE TABLE results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL UNIQUE REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  child_id       UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  mode           TEXT NOT NULL,
  grade          SMALLINT NOT NULL,
  subject        TEXT NOT NULL,
  total          SMALLINT NOT NULL,
  correct        SMALLINT NOT NULL,
  incorrect      SMALLINT NOT NULL,
  accuracy       SMALLINT NOT NULL,
  best_streak    SMALLINT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  xp_awarded     INTEGER NOT NULL DEFAULT 0,
  duration_sec   INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX results_child_idx ON results (child_id, created_at DESC);

-- "Xatolar ustida ishlash": bola va savol bo‘yicha holat. Bitta to‘g‘ri javob uchun o‘chirilmaydi.
CREATE TABLE question_stats (
  child_id       UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  question_id    TEXT NOT NULL REFERENCES questions(id),
  attempts       INTEGER NOT NULL DEFAULT 0,
  wrong_count    INTEGER NOT NULL DEFAULT 0,
  correct_streak SMALLINT NOT NULL DEFAULT 0,          -- ketma-ket to‘g‘ri (masalan 3 ta -> o‘zlashtirildi)
  mastered       BOOLEAN NOT NULL DEFAULT false,
  last_answered_at TIMESTAMPTZ,
  PRIMARY KEY (child_id, question_id)
);
CREATE INDEX question_stats_review_idx ON question_stats (child_id) WHERE wrong_count > 0 AND NOT mastered;

-- ============================================================
-- 4. O‘yin tizimi: ball daftari, do‘kon, yutuqlar, kunlik faollik
-- ============================================================

-- Ball/XP daftari: barcha o‘zgarishlar shu yerdan. (reason, ref_id) UNIQUE — ikki marta hisoblashdan himoya.
CREATE TABLE point_ledger (
  id         BIGSERIAL PRIMARY KEY,
  child_id   UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  points     INTEGER NOT NULL DEFAULT 0,               -- + topildi, - sarflandi
  xp         INTEGER NOT NULL DEFAULT 0,
  reason     TEXT NOT NULL CHECK (reason IN ('quiz', 'purchase', 'achievement', 'daily_goal', 'adjustment')),
  ref_id     TEXT NOT NULL,                            -- result id / item id / achievement id / sana
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, reason, ref_id)
);
CREATE INDEX point_ledger_child_idx ON point_ledger (child_id, created_at DESC);

CREATE TABLE shop_items (
  id         TEXT PRIMARY KEY,                         -- masalan 'cap', 'glasses'
  category   TEXT NOT NULL CHECK (category IN ('clothing', 'hat', 'accessory', 'decor')),
  name       JSONB NOT NULL,                           -- {"uz": "...", "ru": "..."}
  price      INTEGER NOT NULL CHECK (price >= 0),
  image_path TEXT,
  unique_item BOOLEAN NOT NULL DEFAULT true,
  min_level  SMALLINT NOT NULL DEFAULT 1,
  active     BOOLEAN NOT NULL DEFAULT true
);

-- Bolaga tegishli sotib olingan narsalar.
CREATE TABLE child_items (
  child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  item_id      TEXT NOT NULL REFERENCES shop_items(id),
  equipped     BOOLEAN NOT NULL DEFAULT false,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, item_id)
);

CREATE TABLE achievements (
  id          TEXT PRIMARY KEY,                        -- 'first', 'five', 'perfect', ...
  title       JSONB NOT NULL,
  description JSONB NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE child_achievements (
  child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, achievement_id)
);

-- Kunlik faollik: streak va maqsad shu yerdan hisoblanadi (bola vaqt mintaqasi bo‘yicha kun).
CREATE TABLE daily_activity (
  child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  quizzes      SMALLINT NOT NULL DEFAULT 0,
  correct      INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  goal_met     BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (child_id, day)
);

-- ============================================================
-- 5. Boshlang‘ich ma‘lumotlar (do‘kon va yutuqlar)
-- ============================================================

INSERT INTO achievements (id, title, description, reward_points) VALUES
 ('first',    '{"uz":"Birinchi qadam","ru":"Первый шаг"}',            '{"uz":"Birinchi testni yakunlading","ru":"Ты завершил первый тест"}', 20),
 ('five',     '{"uz":"Tirishqoq","ru":"Старательный"}',               '{"uz":"5 ta testni yakunlading","ru":"Ты завершил 5 тестов"}', 50),
 ('perfect',  '{"uz":"Mukammal!","ru":"Идеально!"}',                  '{"uz":"Barcha savolga to‘g‘ri javob berding","ru":"Все ответы верные"}', 100),
 ('streak10', '{"uz":"To‘xtatib bo‘lmas","ru":"Неудержимый"}',        '{"uz":"Ketma-ket 10 ta to‘g‘ri javob","ru":"10 верных ответов подряд"}', 50),
 ('explorer', '{"uz":"Kashfiyotchi","ru":"Исследователь"}',           '{"uz":"Barcha fanlardan test topshirding","ru":"Тесты по всем предметам"}', 100),
 ('thousand', '{"uz":"Ming ball","ru":"Тысяча баллов"}',              '{"uz":"Jami 1000 ball to‘plading","ru":"Набрано 1000 баллов"}', 100),
 ('week',     '{"uz":"Haftalik seriya","ru":"Недельная серия"}',      '{"uz":"7 kun ketma-ket shug‘ullandin","ru":"7 дней занятий подряд"}', 150);

INSERT INTO shop_items (id, category, name, price, min_level) VALUES
 ('cap',        'hat',       '{"uz":"Kepka","ru":"Кепка"}',               50, 1),
 ('clothing',   'clothing',  '{"uz":"Kurtka","ru":"Куртка"}',            100, 1),
 ('glasses',    'accessory', '{"uz":"Ko‘zoynak","ru":"Очки"}',            80, 1),
 ('crown',      'hat',       '{"uz":"Toj","ru":"Корона"}',               300, 3),
 ('scarf',      'accessory', '{"uz":"Sharf","ru":"Шарф"}',                70, 1),
 ('cape',       'clothing',  '{"uz":"Plash","ru":"Плащ"}',               200, 2),
 ('star-frame', 'decor',     '{"uz":"Yulduzli ramka","ru":"Звёздная рамка"}', 150, 2);

-- ============================================================
-- 6. Migratsiyalar jurnali
-- ============================================================

CREATE TABLE schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (version) VALUES ('001_init');

COMMIT;
