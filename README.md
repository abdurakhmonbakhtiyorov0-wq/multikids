# MultiKids

1–4-sinf o‘quvchilari uchun o‘yin shaklidagi o‘quv platformasi: 3D qahramon, 6 ta fan, bosqichli testlar, magazin, ota-ona kabineti.

| Papka | Nima |
|---|---|
| `frontend/` | Next.js 16 (App Router), Tailwind 4, three.js. PWA (o‘rnatiladigan). |
| `backend/` | Express 5 + PostgreSQL (Supabase/Neon/lokal). Barcha qoidalar (baholash, ball, xarid) serverda. |
| `e2e/` | Playwright: haqiqiy brauzerda to‘liq yo‘l sinovlari. |

## Tez boshlash (lokal)

1. PostgreSQL (pgAdmin) da **UTF8** kodlashli bo‘sh baza yarating.
2. `backend/.env.example` → `backend/.env`, qiymatlarni to‘ldiring (`JWT_SECRET` majburiy, ≥ 32 belgi).
3. ```
   cd backend && npm install
   npm run db:migrate      # jadvallar (migrations/*.sql)
   npm run db:seed         # savollar banki (1000+ savol, rasmli savollar)
   npm run dev             # http://localhost:4000
   ```
4. ```
   cd frontend && npm install && npm run dev   # http://localhost:3000
   ```
   Lokalda frontend avtomatik `http://localhost:4000` ga ulanadi.

## Muhit o‘zgaruvchilari

**Backend** (`backend/.env`, Vercel → Settings → Environment Variables):

| Nom | Majburiy | Izoh |
|---|---|---|
| `JWT_SECRET` | ha | ≥ 32 belgi. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Bir marta o‘rnating — o‘zgarsa hamma qayta kiradi. |
| `DATABASE_URL` **yoki** `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` | ha | Supabase uchun *Transaction pooler* (port 6543) manzilidan foydalaning. |
| `DATABASE_SSL` | bulutda | `true` |
| `PG_POOL_MAX` | yo‘q | Vercel’da `3` |
| `CLIENT_ORIGIN` | ha | Frontend manzili(lari), vergul bilan |
| `APP_URL` | parol tiklash uchun | Frontendning ochiq manzili (xatdagi havola shu manzilga) |
| `SMTP_URL` **yoki** `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`, `MAIL_FROM` | parol tiklash uchun | Sozlanmasa, parolni tiklash aniq xato qaytaradi (soxta muvaffaqiyat yo‘q). |

**Frontend** (Vercel, `frontend` loyihasi):

| Nom | Izoh |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend manzili, masalan `https://multikids-delta.vercel.app` (oxirida `/` siz). Production’da majburiy. |

## Vercel’ga joylash

Ikkita Vercel loyihasi, bitta repozitoriy:

1. **Backend**: Root Directory = `backend`, preset Express. Yuqoridagi backend o‘zgaruvchilarini kiriting.
2. **Frontend**: Root Directory = `frontend`. `NEXT_PUBLIC_API_URL` ni backend manziliga qo‘ying.
3. Bazani tayyorlash (bir marta, lokal kompyuterdan, `.env` yoki muhit o‘zgaruvchilari Supabase’ga qaragan holda):
   `cd backend && npm run db:migrate && npm run db:seed`
4. Tekshirish: `https://<backend>/api/health` → `{"ok":true,...}`.

Yangi migratsiya qo‘shsangiz, uni ham shu tarzda bajaring. **Har bir yangi jadvalda `ENABLE ROW LEVEL SECURITY` bo‘lishi shart** (Supabase ochiq API orqali o‘qishni yopish uchun).

## Migratsiyalar

`001_init` jadvallar · `002_adaptive` adaptiv qiyinlik · `003_tests_and_security` test katalogi, imtihon, RLS · `004_gamification` do‘kon, kun savoli, haftalik topshiriqlar · `005_parent` PIN va urinishlar cheklovi.
Eski `data/db.json` dan ko‘chirish: `npm run db:import`.

## Testlar

```
cd backend && npm test                    # 40+ test, haqiqiy PostgreSQL (embedded) ustida
cd frontend && npm run lint && npx tsc --noEmit && npm run build
cd frontend && npm run i18n:check          # barcha matnlar ruscha lug‘atda bormi
cd e2e && npm install && npm run build && npx playwright test   # haqiqiy Chrome’da (o‘rnatilgan Chrome ishlatiladi; E2E_BROWSER=bundled bo‘lsa Playwright Chromium)
```

## Xavfsizlik va maxfiylik

- Baholash, ball, daraja, xarid, mukofot — faqat serverda; mijoz faqat javob indeksini yuboradi, to‘g‘ri javob test tugamaguncha yuborilmaydi.
- Test holati bazada (sahifa yangilansa/sovuq startdan keyin ham davom etadi); takroriy so‘rovlar ikki marta hisoblanmaydi.
- Ota-ona bo‘limi PIN bilan himoyalangan (15 daqiqalik token); bola profillari faqat o‘z ota-onasiga ochiq.
- Kirish, PIN va parol tiklash urinishlari bazada cheklanadi. Parol tiklash tokeni heshlanadi, bir martalik, 30 daqiqa.
- Ro‘yxatdan o‘tishda ota-ona roziligi saqlanadi; akkauntni o‘chirish barcha ma’lumotni o‘chiradi.
- PWA: faqat statik fayllar keshlanadi; `/api/*` va shaxsiy ma’lumot hech qachon.

## Ma’lum cheklovlar

- Interfeys uch tilda (o‘zbek lotin/kirill, rus). Savollar bazasi faqat o‘zbek tilida: kirill rejimida o‘zbek tilidagi fanlar avtomatik o‘giriladi, rus rejimida savollar o‘zbekcha qoladi.
- Offlayn rejimda test yechib bo‘lmaydi (javoblar serverda tekshiriladi); internet uzilsa, javob aloqa tiklangach qayta yuboriladi.
- Oddiy 3D qahramonlar mavjud modellar asosida; yangi modellar qo‘shilmagan.
