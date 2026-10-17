import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import { ageRangeSchema, genderSchema, localeSchema, originSchema, preferencesSchema } from "../lib/schemas";
import type { MeService } from "./me-service";

export interface MeServices extends KitServices {
  me: MeService;
}

/**
 * The logged-in account's own profile. Every route needs a login (`me.manage`), and only
 * ever reads or changes the caller's own row: there is no id in the path to swap.
 * A profile that is gone (the account was deleted while the session lived) answers 401.
 */
export function meRoutes(getServices: () => MeServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);

  return (
    new Elysia({ prefix: "/me", detail: { tags: ["Me"] } })
      .use(plugins)
      .get(
        "/",
        async ({ user, set }) => {
          const me = await getServices().me.get(user);
          return me ? { ok: true as const, me } : fail(set, 401, "unauthenticated");
        },
        { auth: "me.manage" },
      )
      // Change your language, display name, where you come from and/or preferences. Email and role cannot be changed here.
      .patch(
        "/",
        async ({ user, body, set }) => {
          const result = await getServices().me.update(user, body);
          if (result.ok) return { ok: true as const, me: result.profile };
          return result.reason === "gone" ? fail(set, 401, "unauthenticated") : fail(set, 400, "invalid_display_name");
        },
        {
          auth: "me.manage",
          body: t.Object(
            {
              locale: t.Optional(localeSchema),
              // null clears it. Checked further in the service (length, hidden characters).
              displayName: t.Optional(t.Union([t.String({ maxLength: 200 }), t.Null()])),
              // Where you come from; null clears it.
              origin: t.Optional(t.Union([originSchema, t.Null()])),
              // Age band and gender (answered after registering); null clears them.
              ageRange: t.Optional(t.Union([ageRangeSchema, t.Null()])),
              gender: t.Optional(t.Union([genderSchema, t.Null()])),
              // The whole set of choices, replaced at once.
              preferences: t.Optional(preferencesSchema),
            },
            { additionalProperties: false, minProperties: 1 },
          ),
        },
      )
      // Ask for the account to be deleted. Nothing is deleted yet: the request is recorded,
      // audited and emailed to the owner, and can be cancelled until it is carried out.
      // (The audit row is written by the store, in the same transaction as the change.)
      .delete(
        "/",
        async ({ user, set }) => {
          const profile = await getServices().me.requestDeletion(user);
          if (!profile) return fail(set, 401, "unauthenticated");
          set.status = 202; // accepted: carried out later
          return { ok: true as const, me: profile };
        },
        { auth: "me.manage", rateLimit: { meDeletionUser: "user.id" } },
      )
      .post(
        "/deletion/cancel",
        async ({ user, set }) => {
          const profile = await getServices().me.cancelDeletion(user);
          return profile ? { ok: true as const, me: profile } : fail(set, 401, "unauthenticated");
        },
        { auth: "me.manage", rateLimit: { meDeletionUser: "user.id" } },
      )
  );
}
