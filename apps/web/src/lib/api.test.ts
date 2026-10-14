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

  test("unknown routes are a compile-time error", () => {
    // @ts-expect-error there is no /api/v1/nope route
    void api.nope;
  });
});
