# Tayyor 3D modellar (.glb)

Qahramon uchun tayyor model qo‘yish: faylni shu papkaga `<id>.glb` nomi bilan joylang — masalan, panda uchun `pandacha.glb`.
Fayl topilsa, sayt avtomatik shu modelni ishlatadi; topilmasa yoki buzuq bo‘lsa, kod bilan yasalgan qahramon ko‘rsatiladi.

Qaysi qahramonlar uchun fayl qidiriladi: `GLB_HEROES` ro‘yxati, `components/three/GlbMascot.tsx` (hozir faqat `pandacha`).
Boshqa qahramon uchun model qo‘shsangiz, uning `id` sini shu ro‘yxatga qo‘shing.

## Model talablari

- Format: `.glb` (glTF 2.0), teksturalar fayl ichiga joylangan.
- Hajm: 3 MB gacha (telefonlar uchun). Poligonlar: 20–60 ming uchburchak yetarli.
- Yo‘nalish: Y yuqoriga, qahramon yuzi +Z tomonga qaragan. Masshtab va markaz muhim emas: sayt modelni o‘zi balandligi 2.14 ga
  keltiradi, oyoqlarini polga va markazga qo‘yadi.
- Siqish: Draco **ishlatmang** (dekoder tashqi serverdan yuklanadi va oflayn ishlamaydi). Kerak bo‘lsa, Meshopt yoki umuman siqmang.
- Animatsiya (ixtiyoriy): ichida `Idle`, `Happy`, `Think`, `Sad`, `Celebrate` nomli klip bo‘lsa, kayfiyatga qarab o‘ynaladi.
  Klip bo‘lmasa ham model sakraydi, aylanadi va egiladi — buni kod qiladi.
- Mukofotlar (kepka, kubok, ko‘zoynak, toj, sharf, to‘p) kod bilan standart joylarga qo‘yiladi; model boshqacha o‘lchamda bo‘lsa,
  joylarni `GlbMascot.tsx` oxirida sozlash mumkin.

## Modelni qayerdan olish

- Blender'da yasash yoki rassomga buyurtma berish.
- 3D yaratuvchi xizmatlar (Meshy, Tripo va boshqalar): **o‘zingizning original rasmingiz**dan model yasang. Mashhur personajlar
  (Disney, Nintendo va boshqalar) rasmidan foydalanmang: saytda ularni ishlatish mumkin emas.
- Tayyor modelni yuklashdan oldin litsenziyasini tekshiring (tijorat va bolalar saytida ishlatishga ruxsat bormi).
