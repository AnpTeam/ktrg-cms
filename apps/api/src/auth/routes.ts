import { Elysia, t } from "elysia";
import type { OtpService } from "./otp-service";

/** Auth endpoints. The service is resolved per request so importing this stays side-effect free. */
export function authRoutes(getOtpService: () => OtpService) {
  return new Elysia({ prefix: "/auth" }).post(
    "/otp/request",
    async ({ body }) => {
      await getOtpService().request(body.email);
      // Same answer whether a code was sent, throttled or the mail failed.
      return { ok: true as const };
    },
    { body: t.Object({ email: t.String({ format: "email", maxLength: 254 }) }) },
  );
}
