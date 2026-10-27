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
