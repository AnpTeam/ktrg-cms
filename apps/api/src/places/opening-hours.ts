import { t, type Static } from "elysia";

/**
 * A place's opening hours as data: seven days (Monday first), each with zero or more periods ("closed" is no period,
 * a lunch break is two). The Japanese and English text visitors read is built from this, so the two never drift apart.
 */
const time = t.String({ pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" });
const period = t.Object({ open: time, close: time });
export const OPENING_HOURS = t.Object({
  days: t.Array(t.Array(period, { maxItems: 3 }), { minItems: 7, maxItems: 7 }),
  // Anything the table cannot say (public holidays, "last order 30 minutes before closing").
  noteJa: t.Union([t.String({ maxLength: 300 }), t.Null()]),
  noteEn: t.Union([t.String({ maxLength: 300 }), t.Null()]),
});
export type OpeningHours = Static<typeof OPENING_HOURS>;

/** A period must end after it starts (closing past midnight is entered as two days' periods). */
export function cleanHours(h: OpeningHours): OpeningHours | null {
  const days = h.days.map((d) => d.filter((p) => p.open < p.close).sort((a, b) => a.open.localeCompare(b.open)));
  const noteJa = h.noteJa?.trim() || null;
  const noteEn = h.noteEn?.trim() || null;
  // Nothing entered at all is "not filled in", not "closed every day".
  if (days.every((d) => d.length === 0) && !noteJa && !noteEn) return null;
  return { days, noteJa, noteEn };
}

/** True when a period was dropped by cleanHours (its end is not after its start): the editor is told, not silently fixed. */
export const hasBackwardPeriod = (h: OpeningHours) => h.days.some((d) => d.some((p) => p.open >= p.close));

const DAYS = {
  ja: ["月", "火", "水", "木", "金", "土", "日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const clock = (s: string, locale: "ja" | "en") => {
  const [h, m] = s.split(":") as [string, string];
  return locale === "ja" ? (m === "00" ? `${Number(h)}時` : `${Number(h)}時${m}分`) : `${Number(h)}:${m}`;
};
const periods = (d: OpeningHours["days"][number], locale: "ja" | "en") =>
  d.map((p) => (locale === "ja" ? `${clock(p.open, locale)}〜${clock(p.close, locale)}` : `${clock(p.open, locale)}–${clock(p.close, locale)}`)).join(locale === "ja" ? "、" : ", ");

/** Runs of neighbouring days with the same hours: Mon–Fri 10:30–17:30, Sun 9:00–17:00. Closed days are left out. */
function runs(h: OpeningHours, locale: "ja" | "en") {
  const out: string[] = [];
  let i = 0;
  while (i < 7) {
    const text = periods(h.days[i]!, locale);
    let j = i;
    while (j + 1 < 7 && periods(h.days[j + 1]!, locale) === text) j++;
    if (h.days[i]!.length > 0) {
      const names = DAYS[locale];
      const span = j === i ? names[i]! : locale === "ja" ? `${names[i]}〜${names[j]}` : `${names[i]}–${names[j]}`;
      out.push(`${span} ${text}`);
    }
    i = j + 1;
  }
  return out;
}

/** The opening hours as one line of text; the note follows. Empty when the place has no hours entered. */
export function hoursText(h: OpeningHours | null, locale: "ja" | "en"): string | null {
  if (!h) return null;
  const note = locale === "en" ? (h.noteEn ?? h.noteJa) : h.noteJa;
  const parts = [...runs(h, locale), ...(note ? [note] : [])];
  return parts.length ? parts.join(locale === "ja" ? "｜" : " | ") : null;
}

/** The weekly closed days as text ("土・日" / "Sat, Sun"); null when open every day or no hours entered. */
export function closedDaysText(h: OpeningHours | null, locale: "ja" | "en"): string | null {
  if (!h) return null;
  const closed = h.days.flatMap((d, i) => (d.length === 0 ? [DAYS[locale][i]!] : []));
  if (closed.length === 0 || closed.length === 7) return null;
  return closed.join(locale === "ja" ? "・" : ", ");
}
