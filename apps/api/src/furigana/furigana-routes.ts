import { Elysia, t } from "elysia";
import type { FuriganaService } from "./furigana";

/** Most texts and characters one call may carry: a page's worth, never a document. */
export const MAX_TEXTS = 60;
export const MAX_CHARS = 400;

/**
 * Readings for the page's Japanese text (the visitor's "furigana" choice). No login: the page's own words are public.
 * The work is bounded by the size limits here, and answers are kept, so a repeated text costs nothing.
 */
export function furiganaRoutes(service: FuriganaService) {
  return new Elysia({ detail: { tags: ["Content"] } }).post(
    "/furigana",
    async ({ body, set }) => {
      if (body.texts.reduce((n, s) => n + s.length, 0) > MAX_TEXTS * MAX_CHARS) {
        set.status = 413;
        return { ok: false as const, error: "too_long" as const };
      }
      try {
        return { ok: true as const, readings: await service.readings(body.texts) };
      } catch {
        set.status = 503;
        return { ok: false as const, error: "unavailable" as const };
      }
    },
    {
      body: t.Object({ texts: t.Array(t.String({ maxLength: MAX_CHARS }), { maxItems: MAX_TEXTS }) }),
      detail: { summary: "Readings (furigana) for Japanese texts" },
    },
  );
}
