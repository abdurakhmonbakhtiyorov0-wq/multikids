# MultiKids backend

Express 5 + PostgreSQL. Barcha doimiy ma‘lumotlar (akkauntlar, bolalar, testlar, ballar, xatolar) PostgreSQL'da saqlanadi;
server xotirasida holat yo‘q, shuning uchun qayta ishga tushirish yoki serverless "sovuq start" hech narsani yo‘qotmaydi.

## Mahalliy ishga tushirish (pgAdmin bilan)

1. pgAdmin'da **UTF8** kodlashli bo‘sh baza yarating (`multikids`). Windows'da standart WIN1251 bo‘lishi mumkin — Create → Database → Definition → Encoding: UTF8.
2. `cp .env.example .env`, so‘ng `JWT_SECRET` va baza parolini to‘ldiring.
3. `npm install`
4. `npm run db:migrate` — jadvallarni yaratadi (`migrations/*.sql`; bajarilganlari `schema_migrations` jadvalida).
5. `npm run db:seed` — savollar bankini yuklaydi (qayta ishga tushirish xavfsiz).
6. (ixtiyoriy) `npm run db:import` — eski `data/db.json` ni ko‘chiradi.
7. `npm run dev` → http://localhost:4000/api/health

## Muhit o‘zgaruvchilari

| O‘zgaruvchi | Izoh |
|---|---|
| `JWT_SECRET` | **Majburiy**, ≥ 32 belgi. Yo‘q bo‘lsa server ishga tushmaydi (Vercel'da API 500 va aniq xabar qaytaradi). |
| `DATABASE_URL` yoki `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` | PostgreSQL ulanishi |
| `DATABASE_SSL` | Bulutdagi bazalar uchun `true` |
| `CLIENT_ORIGIN` | Ruxsat etilgan frontend manzillari (vergul bilan) |

## Vercel

1. Neon yoki Supabase'da PostgreSQL yarating, ulanish satrini oling.
2. Vercel → Project → Settings → Environment Variables: `JWT_SECRET`, `DATABASE_URL`, `DATABASE_SSL=true`, `PG_POOL_MAX=3`.
3. Lokal kompyuterdan, `DATABASE_URL` ni shu bazaga yo‘naltirib: `npm run db:migrate && npm run db:seed`.
4. Deploy. `JWT_SECRET` ni o‘zgartirsangiz hamma foydalanuvchi qayta kirishi kerak bo‘ladi — shuning uchun uni bir marta o‘rnating.

## Testlar

`npm test` haqiqiy PostgreSQL ustida ishlaydi: `TEST_DATABASE_URL` berilmasa, `embedded-postgres` vaqtinchalik baza ko‘taradi.

## Sxema

`migrations/001_init.sql` (jadvallar), `002_adaptive.sql` (adaptiv qiyinlik). Yangi o‘zgarish — yangi raqamli `.sql` fayl; mavjudlarini tahrirlamang.
