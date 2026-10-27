// The opening-hours editor's data and the changes it makes (the API checks and renders it: api/src/places/opening-hours.ts).
// The form keeps the value as JSON text like every other field; "" means nothing entered. Pure, so it is unit-tested.

export type Period = { open: string; close: string };
export type Hours = { days: Period[][]; noteJa: string; noteEn: string };

export const MAX_PERIODS = 3;
export const DEFAULT_PERIOD: Period = { open: "09:00", close: "17:00" };

export const emptyHours = (): Hours => ({ days: Array.from({ length: 7 }, () => []), noteJa: "", noteEn: "" });

/** The form's text as hours (a row with no hours yet, or damaged text, starts empty). */
export function parseHours(text: string): Hours {
  try {
    const v = JSON.parse(text) as { days?: Period[][]; noteJa?: string | null; noteEn?: string | null };
    if (!Array.isArray(v.days) || v.days.length !== 7) return emptyHours();
    return { days: v.days, noteJa: v.noteJa ?? "", noteEn: v.noteEn ?? "" };
  } catch {
    return emptyHours();
  }
}

export const hoursText = (h: Hours) => JSON.stringify(h);

/** What the API takes: null when nothing is entered, empty notes as null. */
export function hoursPayload(text: string): Hours | { days: Period[][]; noteJa: string | null; noteEn: string | null } | null {
  if (text.trim() === "") return null;
  const h = parseHours(text);
  const noteJa = h.noteJa.trim() || null;
  const noteEn = h.noteEn.trim() || null;
  if (h.days.every((d) => d.length === 0) && !noteJa && !noteEn) return null;
  return { days: h.days, noteJa, noteEn };
}

const withDay = (h: Hours, day: number, periods: Period[]): Hours => ({ ...h, days: h.days.map((d, i) => (i === day ? periods : d)) });

/** Open or closed: opening a closed day gives it the usual 9:00–17:00 to change. */
export const setClosed = (h: Hours, day: number, closed: boolean): Hours => withDay(h, day, closed ? [] : [{ ...DEFAULT_PERIOD }]);

export const addPeriod = (h: Hours, day: number): Hours => {
  const now = h.days[day]!;
  if (now.length === 0 || now.length >= MAX_PERIODS) return h;
  // The next period starts where the last one ended, an hour long, so it is valid before it is edited.
  const last = now[now.length - 1]!;
  const start = last.close < "23:00" ? last.close : "22:00";
  const end = start < "23:00" ? `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:${start.slice(3)}` : "23:59";
  return withDay(h, day, [...now, { open: start, close: end }]);
};

export const removePeriod = (h: Hours, day: number, index: number): Hours => withDay(h, day, h.days[day]!.filter((_, i) => i !== index));

export const setTime = (h: Hours, day: number, index: number, which: "open" | "close", value: string): Hours =>
  withDay(h, day, h.days[day]!.map((p, i) => (i === index ? { ...p, [which]: value } : p)));

/** Copies one day's hours onto others (Monday onto Tuesday to Friday). */
export const copyDay = (h: Hours, from: number, to: number[]): Hours => ({ ...h, days: h.days.map((d, i) => (to.includes(i) ? h.days[from]!.map((p) => ({ ...p })) : d)) });

/** A period that ends at or before its start (the API refuses it); the editor marks it. */
export const isBackward = (p: Period) => p.open === "" || p.close === "" || p.open >= p.close;
export const hasBackward = (h: Hours) => h.days.some((d) => d.some(isBackward));
