import { describe, expect, test } from "bun:test";
import { createConsoleMailer, createMailer } from "./mailer";

const base = {
  NODE_ENV: "development" as const,
  SMTP_PORT: 587,
  MAIL_FROM: "KTRG <no-reply@localhost>",
};

describe("createMailer", () => {
  test("falls back to the console when SMTP_HOST is unset in development", async () => {
    const mailer = createMailer(base);
    await expect(
      mailer.send({ to: "a@example.com", subject: "Hi", text: "code 123456" }),
    ).resolves.toBeUndefined();
  });

  test("refuses to start in production without SMTP_HOST", () => {
    expect(() => createMailer({ ...base, NODE_ENV: "production" })).toThrow(/SMTP_HOST/);
  });

  test("builds an SMTP mailer when SMTP_HOST is set", () => {
    const mailer = createMailer({ ...base, SMTP_HOST: "smtp.gmail.com" });
    expect(typeof mailer.send).toBe("function");
  });
});

describe("createConsoleMailer", () => {
  test("logs recipient, subject and body", async () => {
    const lines: string[] = [];
    const mailer = createConsoleMailer("from@x", (l) => lines.push(l));
    await mailer.send({ to: "a@example.com", subject: "Your code", text: "123456" });
    expect(lines[0]).toContain("to=a@example.com");
    expect(lines[0]).toContain("Your code");
    expect(lines[0]).toContain("123456");
  });
});
