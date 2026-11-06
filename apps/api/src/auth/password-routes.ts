import { Elysia, t } from "elysia";
import { emailSchema } from "../lib/schemas";
import { fail } from "./http";
import { PASSWORD_MAX } from "./password";
import type { PasswordService } from "./password-service";
import { can } from "./permissions";
import { routeKit, type KitServices, type RouteOptions } from "./route-kit";

export interface PasswordServices extends KitServices {
  passwords: PasswordService;
}

const passwordField = t.String({ minLength: 1, maxLength: PASSWORD_MAX });

/** The optional password: log in with it, set, change or remove your own, and the "this was not me" link in the email. */
export function passwordRoutes(getServices: () => PasswordServices, opts: RouteOptions) {
  const { http, plugins } = routeKit(getServices, opts);

  return (
    new Elysia({ prefix: "/auth/password", detail: { tags: ["Auth"] } })
      .use(plugins)
      // For the settings screen: whether this account has a password, and whether it may have one at all.
      .get(
        "/",
        async ({ user }) => ({
          ok: true as const,
          hasPassword: await getServices().passwords.hasPassword(user),
          allowed: can(user.role, "me.password"),
        }),
        { auth: "me.manage" },
      )
      // The per-address limit is not tied to the IP: guesses from many machines must not add up. Reaching it locks only the
      // password; the emailed number and passkeys still work, so a stranger cannot lock the owner out.
      .post(
        "/login",
        async ({ body, set }) => {
          const user = await getServices().passwords.login(body.email, body.password);
          // One answer for a wrong password, an unknown address, no password set and a staff account.
          if (!user) return fail(set, 401, "invalid_login");
          // Not fresh: a stolen password alone must not reach the steps that need a fresh login (changing the password,
          // adding a passkey, deleting the account). Those still ask for the mailbox or a passkey.
          await http.startSession(set, user, { fresh: false });
          return { ok: true as const, user };
        },
        {
          body: t.Object({ email: emailSchema, password: passwordField }),
          rateLimit: { passwordLoginEmailIp: "body.email+ip", passwordLoginEmail: "body.email", passwordLoginIp: "ip" },
        },
      )
      .put(
        "/",
        async ({ user, authSession, body, set }) => {
          const result = await getServices().passwords.set(user, body.password);
          if (result === "no_email") return fail(set, 409, "no_email");
          if (result === "too_short") return fail(set, 400, "password_too_short");
          if (result === "too_common") return fail(set, 400, "password_too_common");
          // The account's way in changed: every other device is signed out, this one stays.
          await getServices().session.endOthers(user.id, authSession.id);
          return { ok: true as const };
        },
        { auth: "me.password", body: t.Object({ password: passwordField }), rateLimit: { passwordSetUser: "user.id" } },
      )
      .delete(
        "/",
        async ({ user, authSession, set }) => {
          if (!(await getServices().passwords.remove(user))) return fail(set, 404, "not_found");
          await getServices().session.endOthers(user.id, authSession.id);
          return { ok: true as const };
        },
        { auth: "me.password", rateLimit: { passwordSetUser: "user.id" } },
      )
      // No login: whoever is locked out is who needs this. The token proves the mailbox. A POST from a page with a button,
      // never a GET on the link itself, because mail scanners open links.
      .post(
        "/undo",
        async ({ body, set }) => {
          const userId = await getServices().passwords.undo(body.token);
          if (!userId) return fail(set, 400, "invalid_undo_link");
          await getServices().session.endAll(userId);
          return { ok: true as const };
        },
        { body: t.Object({ token: t.String({ pattern: "^[A-Za-z0-9_-]{43}$" }) }), rateLimit: { passwordUndoIp: "ip" } },
      )
  );
}
