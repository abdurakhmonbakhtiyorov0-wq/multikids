export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Bazaga ulanish xatolari -> 503 (foydalanuvchiga tushunarli xabar), qolganlari -> 500.
const DB_DOWN = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "57P01", "57P03", "53300"]);
export function isDbUnavailable(err) {
  return DB_DOWN.has(err?.code) || /^08/.test(err?.code ?? "") || /Connection terminated|timeout exceeded when trying to connect/i.test(err?.message ?? "");
}
