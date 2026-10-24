import nodemailer from "nodemailer";
import type { Env } from "../parse-env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

type MailEnv = Pick<
  Env,
  "NODE_ENV" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASS" | "MAIL_FROM"
>;

/** Dev fallback: print the email instead of sending it. */
export function createConsoleMailer(
  from: string,
  log: (line: string) => void = console.log,
): Mailer {
  return {
    async send({ to, subject, text }) {
      log(`[mail:console] from=${from} to=${to} subject=${subject}\n${text}`);
    },
  };
}

export function createSmtpMailer(env: MailEnv): Mailer {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    // Other ports start plain and upgrade (STARTTLS): insist on it, so login codes never travel unencrypted.
    requireTLS: env.SMTP_PORT !== 465,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: env.MAIL_FROM, ...message });
    },
  };
}

/** SMTP when configured; console fallback in dev/test; a hard error in production. */
export function createMailer(env: MailEnv): Mailer {
  if (env.SMTP_HOST) return createSmtpMailer(env);
  if (env.NODE_ENV === "production") {
    throw new Error("SMTP_HOST is required in production: emails cannot be logged to the console.");
  }
  return createConsoleMailer(env.MAIL_FROM);
}
