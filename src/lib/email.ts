import nodemailer from "nodemailer";
import { env, smtpConfigured } from "./env";

export type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Sends email through SMTP when configured. Returns false when SMTP is not
 * configured so callers can fall back to showing the information in the UI.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!smtpConfigured()) return false;
  const e = env();
  const transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD ?? "" } : undefined,
  });
  await transport.sendMail({ from: e.SMTP_FROM, ...mail });
  return true;
}

export function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
