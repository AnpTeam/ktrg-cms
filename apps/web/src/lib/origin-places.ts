import type { Origin } from "./auth-flow";

// Where a visitor comes from, in detail: a prefecture (its ISO code, JP-27) or a country (its ISO code, TH). Prefecture names are
// here in both languages; country names come from the browser (Intl.DisplayNames), so nothing has to be kept up to date.

type Named = { ja: string; en: string };
type Prefecture = Named & { code: string };

/** The Kinki region first (the trails are there), with the trails' own three prefectures at its top; then north to south. */
export const PREFECTURE_REGIONS: readonly (Named & { prefectures: readonly Prefecture[] })[] = [
  {
    ja: "近畿地方",
    en: "Kinki",
    prefectures: [
      { code: "JP-27", ja: "大阪府", en: "Osaka" },
      { code: "JP-30", ja: "和歌山県", en: "Wakayama" },
      { code: "JP-29", ja: "奈良県", en: "Nara" },
      { code: "JP-26", ja: "京都府", en: "Kyoto" },
      { code: "JP-28", ja: "兵庫県", en: "Hyogo" },
      { code: "JP-25", ja: "滋賀県", en: "Shiga" },
      { code: "JP-24", ja: "三重県", en: "Mie" },
    ],
  },
  { ja: "北海道地方", en: "Hokkaido", prefectures: [{ code: "JP-01", ja: "北海道", en: "Hokkaido" }] },
  {
    ja: "東北地方",
    en: "Tohoku",
    prefectures: [
      { code: "JP-02", ja: "青森県", en: "Aomori" },
      { code: "JP-03", ja: "岩手県", en: "Iwate" },
      { code: "JP-04", ja: "宮城県", en: "Miyagi" },
      { code: "JP-05", ja: "秋田県", en: "Akita" },
      { code: "JP-06", ja: "山形県", en: "Yamagata" },
      { code: "JP-07", ja: "福島県", en: "Fukushima" },
    ],
  },
  {
    ja: "関東地方",
    en: "Kanto",
    prefectures: [
      { code: "JP-08", ja: "茨城県", en: "Ibaraki" },
      { code: "JP-09", ja: "栃木県", en: "Tochigi" },
      { code: "JP-10", ja: "群馬県", en: "Gunma" },
      { code: "JP-11", ja: "埼玉県", en: "Saitama" },
      { code: "JP-12", ja: "千葉県", en: "Chiba" },
      { code: "JP-13", ja: "東京都", en: "Tokyo" },
      { code: "JP-14", ja: "神奈川県", en: "Kanagawa" },
    ],
  },
  {
    ja: "中部地方",
    en: "Chubu",
    prefectures: [
      { code: "JP-15", ja: "新潟県", en: "Niigata" },
      { code: "JP-16", ja: "富山県", en: "Toyama" },
      { code: "JP-17", ja: "石川県", en: "Ishikawa" },
      { code: "JP-18", ja: "福井県", en: "Fukui" },
      { code: "JP-19", ja: "山梨県", en: "Yamanashi" },
      { code: "JP-20", ja: "長野県", en: "Nagano" },
      { code: "JP-21", ja: "岐阜県", en: "Gifu" },
      { code: "JP-22", ja: "静岡県", en: "Shizuoka" },
      { code: "JP-23", ja: "愛知県", en: "Aichi" },
    ],
  },
  {
    ja: "中国地方",
    en: "Chugoku",
    prefectures: [
      { code: "JP-31", ja: "鳥取県", en: "Tottori" },
      { code: "JP-32", ja: "島根県", en: "Shimane" },
      { code: "JP-33", ja: "岡山県", en: "Okayama" },
      { code: "JP-34", ja: "広島県", en: "Hiroshima" },
      { code: "JP-35", ja: "山口県", en: "Yamaguchi" },
    ],
  },
  {
    ja: "四国地方",
    en: "Shikoku",
    prefectures: [
      { code: "JP-36", ja: "徳島県", en: "Tokushima" },
      { code: "JP-37", ja: "香川県", en: "Kagawa" },
      { code: "JP-38", ja: "愛媛県", en: "Ehime" },
      { code: "JP-39", ja: "高知県", en: "Kochi" },
    ],
  },
  {
    ja: "九州・沖縄地方",
    en: "Kyushu and Okinawa",
    prefectures: [
      { code: "JP-40", ja: "福岡県", en: "Fukuoka" },
      { code: "JP-41", ja: "佐賀県", en: "Saga" },
      { code: "JP-42", ja: "長崎県", en: "Nagasaki" },
      { code: "JP-43", ja: "熊本県", en: "Kumamoto" },
      { code: "JP-44", ja: "大分県", en: "Oita" },
      { code: "JP-45", ja: "宮崎県", en: "Miyazaki" },
      { code: "JP-46", ja: "鹿児島県", en: "Kagoshima" },
      { code: "JP-47", ja: "沖縄県", en: "Okinawa" },
    ],
  },
];

const codes = (list: string) => list.split(" ");

/** Countries by part of the world, nearest first. Japan is left out: it has its own question. */
export const COUNTRY_REGIONS: readonly (Named & { countries: readonly string[] })[] = [
  { ja: "アジア", en: "Asia", countries: codes("AF BD BN BT CN HK ID IN KG KH KP KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL TM TW UZ VN") },
  { ja: "オセアニア", en: "Oceania", countries: codes("AU FJ FM KI MH NR NZ PG PW SB TO TV VU WS") },
  { ja: "北アメリカ", en: "North America", countries: codes("AG BB BS BZ CA CR CU DM DO GD GT HN HT JM KN LC MX NI PA SV TT US VC") },
  { ja: "南アメリカ", en: "South America", countries: codes("AR BO BR CL CO EC GY PE PY SR UY VE") },
  { ja: "ヨーロッパ", en: "Europe", countries: codes("AD AL AM AT AZ BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GE GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA") },
  { ja: "中東", en: "Middle East", countries: codes("AE BH IL IQ IR JO KW LB OM PS QA SA SY TR YE") },
  { ja: "アフリカ", en: "Africa", countries: codes("AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW") },
];

const inLanguage = (named: Named, locale: string) => (locale === "ja" ? named.ja : named.en);

export const regionName = inLanguage;

/** The countries of a part of the world by name, in the visitor's language. */
export function countryOptions(countries: readonly string[], locale: string): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return countries.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** The name of a saved place; null when it is not one this app knows. */
export function placeName(place: string, locale: string): string | null {
  const prefecture = PREFECTURE_REGIONS.flatMap((r) => r.prefectures).find((p) => p.code === place);
  if (prefecture) return inLanguage(prefecture, locale);
  return COUNTRY_REGIONS.some((r) => r.countries.includes(place)) ? (new Intl.DisplayNames([locale], { type: "region" }).of(place) ?? null) : null;
}

/** The plain answer a place belongs to (the API works out the same when it saves). */
export function originOfPlace(place: string): Origin {
  if (!place.startsWith("JP-")) return "overseas";
  return place === "JP-27" ? "osaka" : place === "JP-30" ? "wakayama" : place === "JP-29" ? "nara" : "other_japan";
}

/** An answer given before places existed, as the place the picker should show. */
export const placeOfOrigin = (origin: Origin | null): string | null => (origin === "osaka" ? "JP-27" : origin === "wakayama" ? "JP-30" : origin === "nara" ? "JP-29" : null);
