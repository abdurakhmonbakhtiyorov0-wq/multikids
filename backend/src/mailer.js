import nodemailer from "nodemailer";
import { ApiError } from "./errors.js";

// Haqiqiy email yuborish (SMTP). Sozlanmagan bo‘lsa, soxta "yuborildi" deb aytmaymiz — aniq xato qaytaramiz.
// MAIL_TRANSPORT=json faqat sinov uchun: xabarlar yuborilmay, xotirada saqlanadi.

let transport;
const outbox = [];
export const testOutbox = () => outbox;

export function mailerConfigured() {
  return Boolean(process.env.SMTP_URL || process.env.SMTP_HOST || process.env.MAIL_TRANSPORT === "json");
}

function getTransport() {
  if (transport) return transport;
  if (process.env.MAIL_TRANSPORT === "json") transport = nodemailer.createTransport({ jsonTransport: true });
  else if (process.env.SMTP_URL) transport = nodemailer.createTransport(process.env.SMTP_URL);
  else {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailerConfigured()) throw new ApiError(503, "Email xizmati sozlanmagan. Administrator SMTP sozlamalarini kiritishi kerak.");
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "MultiKids <no-reply@localhost>";
  const info = await getTransport().sendMail({ from, to, subject, text, html });
  if (process.env.MAIL_TRANSPORT === "json") outbox.push({ ...JSON.parse(info.message), to });
  return info;
}
