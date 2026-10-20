import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import type { ErrorCode } from "../lib/api-errors";
import { translationsSchema } from "../lib/schemas";
import type { RallyAdminService } from "./rally-admin-service";
import type { RallyRow } from "./rally-admin-types";

export interface RallyAdminServices extends KitServices {
  rallyAdmin: RallyAdminService;
}

/** Times as ISO text, so the editor can send `updatedAt` back exactly as it got it. */
const rallyOut = (r: RallyRow) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });

function statusOf(reason: ErrorCode): 400 | 404 | 409 | 422 {
  switch (reason) {
    case "not_found":
      return 404;
    case "validation_failed":
      return 422;
    case "invalid_rally_members":
      return 400;
    default:
      return 409; // conflict, rally_empty
  }
}

const uuid = t.String({ format: "uuid" });
const idParams = t.Object({ id: uuid });
const updatedAt = t.String({ format: "date-time" });
const nameJa = t.String({ minLength: 1, maxLength: 200 });
const nameEn = t.Union([t.String({ maxLength: 200 }), t.Null()]);
const translations = translationsSchema({ name: 200 });
const kindSchema = t.Union([t.Literal("places"), t.Literal("course")]);

/**
 * The admin side of rallies (`rally.manage`, admin only). A rally is made of PLACES (a list of stamp places, such as
 * the sutra-mound rally) or of COURSES (a list of courses), chosen when it is created and fixed afterwards. Create,
 * rename, publish, reorder, set what is in it, delete. Writes are rate limited and audited by the store; an edit
 * carries the `updatedAt` it loaded (409 `conflict` when someone saved first). Visitors' stamps are never touched;
 * deleting a rally removes visitors' finishes of that rally only.
 */
export function rallyAdminRoutes(getServices: () => RallyAdminServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  const svc = () => getServices().rallyAdmin;

  return new Elysia({ prefix: "/admin/rallies", detail: { tags: ["Admin rallies"] } })
    .use(plugins)
    .get("/", async () => ({ ok: true as const, rallies: (await svc().listRallies()).map(rallyOut) }), { auth: "rally.manage" })
    // For the new-rally form: everything a rally of this type may hold, to tick and send with POST in one go.
    .get(
      "/candidates",
      async ({ query }) => {
        const kind = query.kind ?? "places";
        return { ok: true as const, kind, candidates: await svc().candidates(kind) };
      },
      { auth: "rally.manage", query: t.Object({ kind: t.Optional(kindSchema) }) },
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        const found = await svc().getRally(params.id);
        if (!found) return fail(set, 404, "not_found");
        return "places" in found
          ? { ok: true as const, rally: rallyOut(found.rally), places: found.places, courses: null, candidates: found.candidates }
          : { ok: true as const, rally: rallyOut(found.rally), places: null, courses: found.courses, candidates: found.candidates };
      },
      { auth: "rally.manage", params: idParams },
    )
    .post(
      "/",
      async ({ user, body, set }) => {
        const r = await svc().createRally(user.id, body);
        if (!r.ok) return fail(set, statusOf(r.reason), r.reason);
        set.status = 201;
        return { ok: true as const, rally: rallyOut(r.value) };
      },
      {
        auth: "rally.manage",
        rateLimit: { adminWriteUser: "user.id" },
        // The members ticked in the form come with it: spotIds for a rally of places, routeIds for a rally of courses.
        body: t.Object({
          kind: kindSchema,
          nameJa,
          nameEn: t.Optional(nameEn),
          translations: t.Optional(translations),
          spotIds: t.Optional(t.Array(uuid, { maxItems: 2000 })),
          routeIds: t.Optional(t.Array(uuid, { maxItems: 1000 })),
        }),
      },
    )
    // A fixed path, so it never reads "order" as an id.
    .put(
      "/order",
      async ({ user, body, set }) => {
        const r = await svc().reorderRallies(user.id, body.ids);
        return r.ok ? { ok: true as const } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "rally.manage", rateLimit: { adminWriteUser: "user.id" }, body: t.Object({ ids: t.Array(uuid, { maxItems: 1000 }) }) },
    )
    .patch(
      "/:id",
      async ({ user, params, body, set }) => {
        const { updatedAt: expected, ...changes } = body;
        const r = await svc().updateRally(user.id, params.id, expected, changes);
        return r.ok ? { ok: true as const, rally: rallyOut(r.value) } : fail(set, statusOf(r.reason), r.reason);
      },
      {
        auth: "rally.manage",
        rateLimit: { adminWriteUser: "user.id" },
        params: idParams,
        body: t.Composite([t.Object({ updatedAt }), t.Partial(t.Object({ nameJa, nameEn, translations, published: t.Boolean() }))]),
      },
    )
    .put(
      "/:id/places",
      async ({ user, params, body, set }) => {
        const r = await svc().setPlaces(user.id, params.id, body.updatedAt, body.spotIds);
        return r.ok ? { ok: true as const, rally: rallyOut(r.value) } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "rally.manage", rateLimit: { adminWriteUser: "user.id" }, params: idParams, body: t.Object({ updatedAt, spotIds: t.Array(uuid, { maxItems: 2000 }) }) },
    )
    .put(
      "/:id/courses",
      async ({ user, params, body, set }) => {
        const r = await svc().setCourses(user.id, params.id, body.updatedAt, body.routeIds);
        return r.ok ? { ok: true as const, rally: rallyOut(r.value) } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "rally.manage", rateLimit: { adminWriteUser: "user.id" }, params: idParams, body: t.Object({ updatedAt, routeIds: t.Array(uuid, { maxItems: 1000 }) }) },
    )
    .delete(
      "/:id",
      async ({ user, params, set }) => {
        const r = await svc().deleteRally(user.id, params.id);
        return r.ok ? { ok: true as const } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "rally.manage", rateLimit: { adminWriteUser: "user.id" }, params: idParams },
    );
}
