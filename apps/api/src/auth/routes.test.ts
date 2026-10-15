import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createOtpService, type OtpService } from "./otp-service";
import { authRoutes } from "./routes";

function build(service: OtpService) {
  return new Elysia({ prefix: "/api/v1" }).use(authRoutes(() => service));
}
const post = (app: ReturnType<typeof build>, body: unknown) =>
  app.handle(
    new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

function fakeService() {
  const store = new Map<string, Date>();
  let sends = 0;
  const service = createOtpService({
    secret: "r".repeat(32),
    store: {
      async latestExpiry(e) {
        return store.get(e) ?? null;
      },
      async insert(r) {
        store.set(r.email, r.expiresAt);
      },
    },
    mailer: {
      async send() {
        sends++;
      },
    },
  });
  return { service, sends: () => sends };
}

describe("POST /auth/otp/request", () => {
  test("returns the identical response for a sent and a throttled request", async () => {
    const { service, sends } = fakeService();
    const app = build(service);

    const first = await post(app, { email: "a@example.com" });
    const second = await post(app, { email: "a@example.com" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    expect(sends()).toBe(1);
  });

  test("rejects a missing or malformed email", async () => {
    const { service } = fakeService();
    const app = build(service);
    expect((await post(app, {})).status).toBe(422);
    expect((await post(app, { email: "not-an-email" })).status).toBe(422);
    expect((await post(app, { email: "a".repeat(250) + "@x.com" })).status).toBe(422);
  });
});
