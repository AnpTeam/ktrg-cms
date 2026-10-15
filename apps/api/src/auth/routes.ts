import { Elysia, t } from "elysia";
import type { OtpService } from "./otp-service";
import {
  clearSessionCookie,
  readCookie,
  serializeSessionCookie,
  sessionCookieName,
} from "./session";
import type { SessionService } from "./session-service";

const email = t.String({ format: "email", maxLength: 254 });

export interface AuthServices {
  otp: OtpService;
  session: SessionService;
}

/**
 * Auth endpoints. Services are resolved per request so importing this stays
 * side-effect free. `secureCookies` is true in production (HTTPS).
 */
export function authRoutes(getServices: () => AuthServices, opts: { secureCookies: boolean }) {
  const { secureCookies } = opts;
  const cookieName = sessionCookieName(secureCookies);
  const cookieFor = (token: string, expiresAt: Date) =>
    serializeSessionCookie({
      name: cookieName,
      value: token,
      maxAgeSec: (expiresAt.getTime() - Date.now()) / 1000,
      secure: secureCookies,
    });

  return new Elysia({ prefix: "/auth" })
    .post(
      "/otp/request",
      async ({ body }) => {
        await getServices().otp.request(body.email);
        // Same answer whether a code was sent, throttled or the mail failed.
        return { ok: true as const };
      },
      { body: t.Object({ email }) },
    )
    .post(
      "/otp/verify",
      async ({ body, set }) => {
        const { otp, session } = getServices();
        const result = await otp.verify(body.email, body.code);
        if (!result.ok) {
          // One answer for wrong, expired, used, locked or unknown.
          set.status = 401;
          return { ok: false as const, error: "invalid_code" as const };
        }
        const { token, expiresAt } = await session.create(result.user);
        set.headers["set-cookie"] = cookieFor(token, expiresAt);
        return { ok: true as const, user: result.user };
      },
      { body: t.Object({ email, code: t.String({ pattern: "^[0-9]{6}$" }) }) },
    )
    // Minimal "who am I": the full /me API is WBS 2.1.14.
    .get("/session", async ({ headers, set }) => {
      const token = readCookie(headers.cookie, cookieName);
      const auth = token ? await getServices().session.authenticate(token) : null;
      if (!auth || !token) {
        set.status = 401;
        return { ok: false as const, error: "unauthenticated" as const };
      }
      // Keep the cookie's lifetime in step with the slid expiry.
      if (auth.refreshed) set.headers["set-cookie"] = cookieFor(token, auth.expiresAt);
      return { ok: true as const, user: auth.user };
    })
    .post("/logout", async ({ headers, set }) => {
      const token = readCookie(headers.cookie, cookieName);
      if (token) await getServices().session.destroy(token);
      set.headers["set-cookie"] = clearSessionCookie(cookieName, secureCookies);
      return { ok: true as const };
    });
}
