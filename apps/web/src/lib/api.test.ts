import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { app } from "@ktrg/api";
import { createApi, type Api } from "./api";

describe("typed API client", () => {
  let api: Api;

  beforeAll(() => {
    app.listen(0); // random free port
    api = createApi(`http://localhost:${app.server?.port}`);
  });

  afterAll(() => app.stop());

  test("GET /api/v1/health is typed end to end", async () => {
    const { data, error } = await api.health.get();
    expect(error).toBeNull();
    // `data` is inferred from the Elysia route; this line fails to compile if
    // the server response type changes.
    const status: "ok" | undefined = data?.status;
    expect(status).toBe("ok");
  });

  test("error answers are typed under `error`, never as data", () => {
    // Compile-time only (never called): fails to compile if an error body, such as the 429
    // from a rate limit or the API's shared error answers, joins a route's success type.
    const check = async () => {
      const { data } = await api.auth.otp.request.post({ email: "a@example.com" });
      const ok: { ok: true } | null = data;
      return ok;
    };
    void check;
  });

  test("unknown routes are a compile-time error", () => {
    // @ts-expect-error there is no /api/v1/nope route
    void api.nope;
  });
});
