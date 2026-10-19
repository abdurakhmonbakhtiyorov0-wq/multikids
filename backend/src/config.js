// Muhit sozlamalari. Maxfiy kalit hech qachon avtomatik yaratilmaydi: aks holda har bir
// qayta ishga tushirishda barcha foydalanuvchilar tizimdan chiqib ketardi.
export class ConfigError extends Error {}

export function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new ConfigError("JWT_SECRET o‘rnatilmagan yoki juda qisqa (kamida 32 belgi). .env yoki Vercel sozlamalariga qo‘shing.");
  }
  return s;
}
