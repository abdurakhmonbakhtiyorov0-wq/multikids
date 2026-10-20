-- Geymifikatsiya: do‘kon assortimenti, kun savoli, haftalik topshiriqlar, yangi yutuqlar.
BEGIN;

-- 3D qahramon ko‘rsata oladigan 6 ta buyum (frontenddagi RewardId bilan bir xil ID lar).
DELETE FROM shop_items WHERE id IN ('scarf', 'cape', 'star-frame') AND NOT EXISTS (SELECT 1 FROM child_items ci WHERE ci.item_id = shop_items.id);
INSERT INTO shop_items (id, category, name, price, min_level) VALUES
  ('cap',      'hat',       '{"uz":"Kepka","ru":"Кепка"}',          50, 1),
  ('clothing', 'clothing',  '{"uz":"Sharf","ru":"Шарф"}',           80, 1),
  ('glasses',  'accessory', '{"uz":"Ko‘zoynak","ru":"Очки"}',      120, 2),
  ('ball',     'decor',     '{"uz":"To‘p","ru":"Мяч"}',            150, 2),
  ('trophy',   'decor',     '{"uz":"Kubok","ru":"Кубок"}',         250, 3),
  ('crown',    'hat',       '{"uz":"Toj","ru":"Корона"}',          400, 4)
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, price = EXCLUDED.price, min_level = EXCLUDED.min_level, active = true;

INSERT INTO achievements (id, title, description, reward_points) VALUES
  ('level5',     '{"uz":"Besinchi daraja","ru":"Пятый уровень"}',        '{"uz":"5-darajaga yetding","ru":"Ты достиг 5 уровня"}', 100),
  ('challenge3', '{"uz":"Kun savoli ustasi","ru":"Мастер вопроса дня"}', '{"uz":"Kun savoliga 3 marta to‘g‘ri javob berding","ru":"3 раза верно ответил на вопрос дня"}', 60),
  ('exam4',      '{"uz":"Imtihon a’lochisi","ru":"Отличник экзамена"}',  '{"uz":"Sinov imtihonida 4 yoki 5 baho olding","ru":"Получил 4 или 5 на пробном экзамене"}', 80),
  ('shopper',    '{"uz":"Birinchi xarid","ru":"Первая покупка"}',        '{"uz":"Do‘kondan birinchi buyumni sotib olding","ru":"Купил первый предмет в магазине"}', 20),
  ('weekly',     '{"uz":"Hafta qahramoni","ru":"Герой недели"}',         '{"uz":"Haftalik topshiriqlarning hammasini bajarding","ru":"Выполнил все задания недели"}', 100)
ON CONFLICT (id) DO NOTHING;

-- Kun savoli: bola uchun kuniga bitta savol (birinchi ko‘rilganda saqlanadi), bitta urinish.
CREATE TABLE daily_challenges (
  child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  chosen_index SMALLINT,
  is_correct   BOOLEAN,
  answered_at  TIMESTAMPTZ,
  PRIMARY KEY (child_id, day)
);
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

-- Haftalik topshiriqlar mukofoti bir marta olinadi.
CREATE TABLE weekly_claims (
  child_id   UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  task_id    TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, week_start, task_id)
);
ALTER TABLE weekly_claims ENABLE ROW LEVEL SECURITY;

INSERT INTO schema_migrations (version) VALUES ('004_gamification');

COMMIT;
