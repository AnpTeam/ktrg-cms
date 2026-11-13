// The admin's "where do visitors come from" screen: how the places the host reports are written out. Pure, so it is
// unit-tested (visits.test.ts). The API sends the ISO 3166-1 country and the part of the ISO 3166-2 code after the dash.

export interface VisitSummary {
  from: string;
  to: string;
  minCityViews: number;
  total: number;
  byCountry: { country: string; views: number }[];
  byRegion: { country: string; region: string; views: number }[];
  byCity: { country: string; region: string; city: string; views: number }[];
  hiddenCityViews: number;
  topPages: { path: string; views: number }[];
  /** Views per day (days with none are left out; see fillDays). */
  daily: { day: string; views: number }[];
}

// ISO 3166-2:JP, 01 to 47.
const JP_PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県",
  "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県",
  "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

/** A country by name in the reader's language ("" is unknown: the caller words it). */
export function countryName(code: string, locale: string): string {
  if (code === "") return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** A region by name where we know it (a Japanese prefecture); otherwise the code as the host sent it. */
export function regionName(country: string, region: string): string {
  if (region === "") return "";
  if (country === "JP" && /^\d{2}$/.test(region)) return JP_PREFECTURES[Number(region) - 1] ?? region;
  return region;
}

/** The width of a bar, in percent of the biggest row (never 0 for a row with views, so it can still be seen). */
export const barPercent = (views: number, max: number) => (max <= 0 ? 0 : Math.max(2, Math.round((views / max) * 100)));

/** Every day from `from` to `to` (inclusive, "YYYY-MM-DD"), with 0 for a day the server left out. */
export function fillDays(daily: { day: string; views: number }[], from: string, to: string): { day: string; views: number }[] {
  const known = new Map(daily.map((d) => [d.day, d.views]));
  const out: { day: string; views: number }[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ day, views: known.get(day) ?? 0 });
  }
  return out;
}

/** The top of a chart's scale: the next 1, 2, 5 or 10 times a power of ten at or above the biggest value (at least 1). */
export function niceMax(max: number): number {
  if (!(max > 1)) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 5, 10].map((m) => m * power).find((v) => v >= max) ?? 10 * power);
}

/** A path for a table: an id (uuid) inside it is cut to its first four characters, so the page's own name stays readable. */
export function shortPath(path: string): string {
  return path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, (m) => `${m.slice(0, 5)}…`);
}

/** A row's share of the total as a whole percent; a row with views is at least 1. */
export function sharePercent(views: number, total: number): number {
  return total <= 0 || views <= 0 ? 0 : Math.max(1, Math.round((views / total) * 100));
}

/** The line and the closed area of a daily chart inside a width x height box (y grows down; the top is the scale's top). */
export function areaGeometry(values: number[], width: number, height: number): { line: string; area: string; max: number } {
  const max = niceMax(Math.max(0, ...values));
  if (values.length === 0) return { line: "", area: "", max };
  const point = (v: number, i: number) => `${values.length === 1 ? width / 2 : Math.round((i / (values.length - 1)) * width * 100) / 100},${Math.round((height - (v / max) * height) * 100) / 100}`;
  const points = values.map(point);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ");
  return { line, area: `${line} L${width},${height} L0,${height} Z`, max };
}
