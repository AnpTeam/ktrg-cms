// The dashboard's numbers as the page draws them. Pure, so it is unit-tested (dashboard.test.ts).

export interface Goals {
  visits: number | null;
  stamps: number | null;
  signups: number | null;
  completions: number | null;
}

export interface Tile {
  total: number;
  inRange: number;
  daily: { day: string; n: number }[];
}

export interface Overview {
  range: { from: string; to: string; days: number };
  goals: Goals;
  visits: Tile & { topRegion: { country: string; region: string; views: number } | null };
  stamps: Tile & { stampers: number; flagged: number };
  signups: Tile & { byOrigin: { origin: string | null; users: number }[] };
  completions: { total: number; inRange: number };
  stampsByRoute: { routeId: string; name: string | null; stamps: number }[];
}

export const RANGES = [7, 30, 90] as const;

/** How far a number is toward its goal, in whole percent (it may pass 100); null when there is no goal. */
export function progressPercent(total: number, goal: number | null): number | null {
  return goal === null || goal <= 0 ? null : Math.round((total / goal) * 100);
}

/** The points of a small line chart (an SVG `points` value): days left to right, the highest value near the top. */
export function sparkPoints(values: number[], width: number, height: number, pad = 3): string {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  return values.map((v, i) => `${Math.round((pad + i * step) * 10) / 10},${Math.round((height - pad - (v / max) * (height - 2 * pad)) * 10) / 10}`).join(" ");
}

/** The goals form's text as the API takes it: a whole number from 1 up, or null when empty. NaN marks text that is not one. */
export function goalFromText(text: string): number | null {
  const v = text.trim();
  if (v === "") return null;
  return /^\d{1,9}$/.test(v) && Number(v) >= 1 ? Number(v) : Number.NaN;
}
