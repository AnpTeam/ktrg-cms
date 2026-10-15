import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryOtpStore } from "./otp-memory-store";
import { createOtpService } from "./otp-service";
import { authRoutes } from "./routes";

function setup() {
  const { store, users } = createMemoryOtpStore();
  const codes: string[] = [];
  const service = createOtpService({
    secret: "r".repeat(32),
    store,
    mailer: {
      async send(m) {
        codes.push(m.text.match(/\d{6}/)![0]);
      },
    },
  });
  const app = new Elysia({ prefix: "/api/v1" }).use(authRoutes(() => service));
  const post = (path: string, body: unknown) =>
    app.handle(
      new Request(`http://localhost/api/v1/auth/otp/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  return { post, codes, users };
}

describe("POST /auth/otp/request", () => {
  test("returns the identical response for a sent and a throttled request", async () => {
    const { post, codes } = setup();

    const first = await post("request", { email: "a@example.com" });
    const second = await post("request", { email: "a@example.com" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    expect(codes).toHaveLength(1);
  });

  test("rejects a missing or malformed email", async () => {
    const { post } = setup();
    expect((await post("request", {})).status).toBe(422);
    expect((await post("request", { email: "not-an-email" })).status).toBe(422);
    expect((await post("request", { email: "a".repeat(250) + "@x.com" })).status).toBe(422);
  });
});

describe("POST /auth/otp/verify", () => {
  test("the right code returns the user", async () => {
    const { post, codes } = setup();
    await post("request", { email: "a@example.com" });

    const res = await post("verify", { email: "A@example.com", code: codes[0] });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; user: { email: string; role: string } };
    expect(body.ok).toBe(true);
    expect(body.user).toMatchObject({ email: "a@example.com", role: "participant" });
  });

  test("every kind of failure gets the same 401 answer", async () => {
    const { post, codes } = setup();
    await post("request", { email: "a@example.com" });
    const wrong = codes[0] === "000000" ? "111111" : "000000";

    const wrongCode = await post("verify", { email: "a@example.com", code: wrong });
    const unknownEmail = await post("verify", { email: "nobody@example.com", code: wrong });

    expect(wrongCode.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await unknownEmail.json()).toEqual(await wrongCode.json());
  });

  test("a used code is rejected", async () => {
    const { post, codes } = setup();
    await post("request", { email: "a@example.com" });
    await post("verify", { email: "a@example.com", code: codes[0] });
    expect((await post("verify", { email: "a@example.com", code: codes[0] })).status).toBe(401);
  });

  test("rejects a malformed code before looking anything up", async () => {
    const { post } = setup();
    expect((await post("verify", { email: "a@example.com", code: "12345" })).status).toBe(422);
    expect((await post("verify", { email: "a@example.com", code: "abcdef" })).status).toBe(422);
    expect((await post("verify", { email: "a@example.com" })).status).toBe(422);
  });
});
