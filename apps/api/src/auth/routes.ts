import { Elysia, t } from "elysia";
import type { OtpService } from "./otp-service";

const email = t.String({ format: "email", maxLength: 254 });

/** Auth endpoints. The service is resolved per request so importing this stays side-effect free. */
export function authRoutes(getOtpService: () => OtpService) {
  return new Elysia({ prefix: "/auth" })
    .post(
      "/otp/request",
      async ({ body }) => {
        await getOtpService().request(body.email);
        // Same answer whether a code was sent, throttled or the mail failed.
        return { ok: true as const };
      },
      { body: t.Object({ email }) },
    )
    .post(
      "/otp/verify",
      async ({ body, set }) => {
        const result = await getOtpService().verify(body.email, body.code);
        if (!result.ok) {
          // One answer for wrong, expired, used, locked or unknown.
          set.status = 401;
          return { ok: false as const, error: "invalid_code" as const };
        }
        // The session cookie is added by the session module (WBS 2.1.5).
        return { ok: true as const, user: result.user };
      },
      { body: t.Object({ email, code: t.String({ pattern: "^[0-9]{6}$" }) }) },
    );
}
