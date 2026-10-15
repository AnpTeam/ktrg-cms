import { Elysia, StatusMap } from "elysia";
import type { AuditAction, AuditWriter } from "./audit-log";

/** What the middleware can read after a handler ran. */
interface AfterHandleContext {
  user?: { id: string };
  params?: Record<string, string | undefined>;
  response?: unknown;
  set: { status?: number | string };
}

/**
 * Which row an action was done to. Plain strings, not functions, so route options keep
 * their types:
 * - "param:id"       the route's `:id` parameter (the default)
 * - "self"           the logged-in user's own id
 * - "response:a.b"   a field of the handler's JSON response, e.g. "response:passkey.id"
 * It must resolve to an id (a UUID): anything else is refused by the writer.
 */
export type AuditTarget = "param:id" | "self" | `response:${string}`;

export type AuditSpec = AuditAction | { action: AuditAction; target: AuditTarget };

function resolveTarget(target: AuditTarget, ctx: AfterHandleContext): string | null {
  if (target === "param:id") return ctx.params?.id ?? null;
  if (target === "self") return ctx.user?.id ?? null;
  let value: unknown = ctx.response;
  for (const key of target.slice("response:".length).split(".")) {
    value = value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  }
  return typeof value === "string" ? value : null;
}

/**
 * Audit middleware. Use the plugin, then name the action on a route that also has a guard:
 *
 *   new Elysia()
 *     .use(authGuards(...))
 *     .use(auditTrail({ getAudit }))
 *     .delete("/passkeys/:id", handler, { auth: "me.manage", audit: "passkey.remove" })   // target = :id
 *     .post("/passkeys", handler, {
 *       auth: "me.manage",
 *       audit: { action: "passkey.add", target: "response:passkey.id" },   // target = the new row
 *     })
 *
 * - Written only when the handler succeeded (final status below 400). Refused, rate-limited,
 *   not-found and failed requests are not changes, so they are not recorded; a request the
 *   guard rejects never reaches the handler at all.
 * - The actor is the logged-in `user` from the guard; nothing else about the request (IP,
 *   body, headers) is stored. Ids only: see AUDIT_ACTIONS.
 * - Written after the change, so a failed audit write is logged loudly but does not turn a
 *   change that already happened into an error. When the row must commit together with
 *   the change, write it inside the transaction with writeAudit(tx, ...) instead.
 */
export function auditTrail(opts: { getAudit: () => AuditWriter; log?: (message: string) => void }) {
  const log = opts.log ?? console.error;

  return new Elysia({ name: "audit-trail" }).macro({
    audit: (spec: AuditSpec) => {
      const { action, target } = typeof spec === "string" ? { action: spec, target: "param:id" as const } : spec;
      return {
        afterHandle: async (ctx) => {
          const c = ctx as unknown as AfterHandleContext;
          if (!c.user || statusOf(c) >= 400) return;
          try {
            await opts.getAudit().record({ actorUserId: c.user.id, action, targetId: resolveTarget(target, c) });
          } catch (err) {
            // The message names the action and the field at most, never a value.
            log(`[audit] could not record ${action}: ${err instanceof Error ? err.message : String(err)}`);
          }
          // Return nothing: a value returned here would replace the response.
        },
      };
    },
  });
}

/** The status the client will get: `status(409, ...)` responses carry their own code. */
function statusOf({ response, set }: AfterHandleContext): number {
  const code = (response as { code?: unknown } | null | undefined)?.code;
  if (typeof code === "number") return code;
  if (typeof set.status === "number") return set.status;
  if (typeof set.status === "string") return StatusMap[set.status as keyof typeof StatusMap] ?? 500;
  return 200;
}
