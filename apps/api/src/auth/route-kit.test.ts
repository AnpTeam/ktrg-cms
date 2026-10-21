import { describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";
import { routeKit, type KitServices } from "./route-kit";

/** Records what each request asked the limiter to count. */
function setup(trustProxy: boolean) {
  const counted: string[][] = [];
  const services = {
    session: {},
    audit: {},
    rateLimit: {
      checkAll: async (hits: { identifier: string }[]) => {
        counted.push(hits.map((h) => h.identifier));
        return { allowed: true as const };
      },
    },
  } as unknown as KitServices;
  const { plugins } = routeKit(() => services, { secureCookies: false, trustProxy });
  const app = new Elysia().use(plugins).post("/x", () => ({ ok: true }), {
    body: t.Object({ email: t.Optional(t.String()) }),
    rateLimit: { otpVerifyEmail: "body.email", otpVerifyIp: "ip" },
  });
  const post = (body: object, headers: Record<string, string> = {}) =>
    app.handle(new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
  return { post, counted };
}

describe("routeKit rate limits", () => {
  test("a missing identifier skips only its own rule", async () => {
    const s = setup(true);
    await s.post({}, { "x-forwarded-for": "9.9.9.9" });
    expect(s.counted).toEqual([["9.9.9.9"]]); // no email: the IP rule still counts
  });

  test("with the proxy trusted, two addresses are two buckets; without it the header is ignored", async () => {
    const trusted = setup(true);
    await trusted.post({ email: "a@example.com" }, { "x-forwarded-for": "1.1.1.1" });
    await trusted.post({ email: "a@example.com" }, { "x-forwarded-for": "2.2.2.2" });
    expect(trusted.counted.map((c) => c[1])).toEqual(["1.1.1.1", "2.2.2.2"]);

    const direct = setup(false);
    await direct.post({ email: "a@example.com" }, { "x-forwarded-for": "1.1.1.1" });
    expect(direct.counted[0]![1]).not.toBe("1.1.1.1");
  });
});
