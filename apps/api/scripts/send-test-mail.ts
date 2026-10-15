// Manual check for WBS 2.1.1: bun run mail:test you@example.com
import { env } from "../src/env";
import { createMailer } from "../src/lib/mailer";

const to = process.argv[2];
if (!to) {
  console.error("Usage: bun run mail:test <recipient-email>");
  process.exit(1);
}

console.log(env.SMTP_HOST ? `Sending via ${env.SMTP_HOST}:${env.SMTP_PORT}...` : "No SMTP_HOST: console fallback.");
await createMailer(env).send({
  to,
  subject: "KTRG mailer test",
  text: "If you can read this, the mailer works.",
});
console.log("Done.");
