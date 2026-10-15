import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const EnvSchema = Type.Object({
  NODE_ENV: Type.Union(
    [Type.Literal("development"), Type.Literal("test"), Type.Literal("production")],
    { default: "development" },
  ),
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3001 }),
  // Optional until the database is wired up (WBS 1.2.x).
  DATABASE_URL: Type.Optional(Type.String({ pattern: "^postgres(ql)?://.+" })),
  APP_ORIGIN: Type.String({ pattern: "^https?://[^/]+$", default: "http://localhost:3000" }),
  // Mail (WBS 2.1.1). Without SMTP_HOST, non-production logs emails to the console.
  SMTP_HOST: Type.Optional(Type.String()),
  SMTP_PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 587 }),
  SMTP_USER: Type.Optional(Type.String()),
  SMTP_PASS: Type.Optional(Type.String()),
  MAIL_FROM: Type.String({ minLength: 3, default: "KTRG <no-reply@localhost>" }),
});

export type Env = Static<typeof EnvSchema>;

/** Validate a raw environment; throws one error listing every problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const candidate = Value.Default(EnvSchema, Value.Convert(EnvSchema, { ...source }));
  const first = new Map<string, string>();
  for (const e of Value.Errors(EnvSchema, candidate)) {
    if (!first.has(e.path)) first.set(e.path, e.message);
  }
  if (first.size > 0) {
    const lines = [...first].map(([path, msg]) => `  - ${path.slice(1) || "(root)"}: ${msg}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  return Value.Clean(EnvSchema, candidate) as Env;
}
