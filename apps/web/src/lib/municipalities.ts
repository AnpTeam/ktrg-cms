// The cities a course can be in, per prefecture: the admin picks one from a list (the Japanese name is what is
// stored), and the English page shows its English name. A town or village that is not a city (for example 岬町) is
// typed in by hand and shown as typed. Pure.

export type MunicipalityPrefecture = "osaka" | "wakayama" | "nara";

export interface Municipality {
  /** What is stored, and what Japanese pages show. */
  ja: string;
  /** What English pages show. */
  en: string;
}

const m = (ja: string, en: string): Municipality => ({ ja, en });

export const municipalities: Record<MunicipalityPrefecture, readonly Municipality[]> = {
  wakayama: [
    m("和歌山市", "Wakayama City"),
    m("海南市", "Kainan City"),
    m("橋本市", "Hashimoto City"),
    m("有田市", "Arida City"),
    m("御坊市", "Gobo City"),
    m("田辺市", "Tanabe City"),
    m("新宮市", "Shingu City"),
    m("紀の川市", "Kinokawa City"),
    m("岩出市", "Iwade City"),
  ],
  // In the order of the Japanese syllabary (あいうえお順) of the readings.
  osaka: [
    m("池田市", "Ikeda City"),
    m("泉大津市", "Izumiotsu City"),
    m("泉佐野市", "Izumisano City"),
    m("和泉市", "Izumi City"),
    m("茨木市", "Ibaraki City"),
    m("大阪狭山市", "Osakasayama City"),
    m("大阪市", "Osaka City"),
    m("貝塚市", "Kaizuka City"),
    m("柏原市", "Kashiwara City"),
    m("交野市", "Katano City"),
    m("門真市", "Kadoma City"),
    m("河内長野市", "Kawachinagano City"),
    m("岸和田市", "Kishiwada City"),
    m("堺市", "Sakai City"),
    m("四條畷市", "Shijonawate City"),
    m("吹田市", "Suita City"),
    m("摂津市", "Settsu City"),
    m("泉南市", "Sennan City"),
    m("大東市", "Daito City"),
    m("高石市", "Takaishi City"),
    m("高槻市", "Takatsuki City"),
    m("富田林市", "Tondabayashi City"),
    m("豊中市", "Toyonaka City"),
    m("寝屋川市", "Neyagawa City"),
    m("羽曳野市", "Habikino City"),
    m("阪南市", "Hannan City"),
    m("東大阪市", "Higashiosaka City"),
    m("枚方市", "Hirakata City"),
    m("藤井寺市", "Fujiidera City"),
    m("松原市", "Matsubara City"),
    m("箕面市", "Minoh City"),
    m("守口市", "Moriguchi City"),
    m("八尾市", "Yao City"),
  ],
  nara: [
    m("奈良市", "Nara City"),
    m("大和高田市", "Yamatotakada City"),
    m("大和郡山市", "Yamatokoriyama City"),
    m("天理市", "Tenri City"),
    m("橿原市", "Kashihara City"),
    m("桜井市", "Sakurai City"),
    m("五條市", "Gojo City"),
    m("御所市", "Gose City"),
    m("生駒市", "Ikoma City"),
    m("香芝市", "Kashiba City"),
    m("葛城市", "Katsuragi City"),
    m("宇陀市", "Uda City"),
  ],
};

/**
 * The towns (町) and villages (村) of the same three prefectures, in the order of the prefecture's own list (by district,
 * then by the Japanese syllabary of the readings). A course can run through one (岬町, 千早赤阪村), so it is picked like a city.
 */
export const towns: Record<MunicipalityPrefecture, readonly Municipality[]> = {
  wakayama: [
    m("紀美野町", "Kimino Town"),
    m("かつらぎ町", "Katsuragi Town"),
    m("九度山町", "Kudoyama Town"),
    m("高野町", "Koya Town"),
    m("湯浅町", "Yuasa Town"),
    m("広川町", "Hirogawa Town"),
    m("有田川町", "Aridagawa Town"),
    m("美浜町", "Mihama Town"),
    m("日高町", "Hidaka Town"),
    m("由良町", "Yura Town"),
    m("印南町", "Inami Town"),
    m("みなべ町", "Minabe Town"),
    m("日高川町", "Hidakagawa Town"),
    m("白浜町", "Shirahama Town"),
    m("上富田町", "Kamitonda Town"),
    m("すさみ町", "Susami Town"),
    m("那智勝浦町", "Nachikatsuura Town"),
    m("太地町", "Taiji Town"),
    m("古座川町", "Kozagawa Town"),
    m("北山村", "Kitayama Village"),
    m("串本町", "Kushimoto Town"),
  ],
  osaka: [
    m("島本町", "Shimamoto Town"),
    m("豊能町", "Toyono Town"),
    m("能勢町", "Nose Town"),
    m("忠岡町", "Tadaoka Town"),
    m("熊取町", "Kumatori Town"),
    m("田尻町", "Tajiri Town"),
    m("岬町", "Misaki Town"),
    m("太子町", "Taishi Town"),
    m("河南町", "Kanan Town"),
    m("千早赤阪村", "Chihayaakasaka Village"),
  ],
  nara: [
    m("山添村", "Yamazoe Village"),
    m("平群町", "Heguri Town"),
    m("三郷町", "Sango Town"),
    m("斑鳩町", "Ikaruga Town"),
    m("安堵町", "Ando Town"),
    m("川西町", "Kawanishi Town"),
    m("三宅町", "Miyake Town"),
    m("田原本町", "Tawaramoto Town"),
    m("曽爾村", "Soni Village"),
    m("御杖村", "Mitsue Village"),
    m("高取町", "Takatori Town"),
    m("明日香村", "Asuka Village"),
    m("上牧町", "Kanmaki Town"),
    m("王寺町", "Oji Town"),
    m("広陵町", "Koryo Town"),
    m("河合町", "Kawai Town"),
    m("吉野町", "Yoshino Town"),
    m("大淀町", "Oyodo Town"),
    m("下市町", "Shimoichi Town"),
    m("黒滝村", "Kurotaki Village"),
    m("天川村", "Tenkawa Village"),
    m("野迫川村", "Nosegawa Village"),
    m("十津川村", "Totsukawa Village"),
    m("下北山村", "Shimokitayama Village"),
    m("上北山村", "Kamikitayama Village"),
    m("川上村", "Kawakami Village"),
    m("東吉野村", "Higashiyoshino Village"),
  ],
};

const allCities = new Map([...Object.values(municipalities), ...Object.values(towns)].flatMap((list) => list.map((c) => [c.ja, c.en] as const)));

/** The prefecture of a listed city, town or village; null for a name that was typed in. */
export function prefectureOfCity(ja: string): MunicipalityPrefecture | null {
  for (const [p, list] of Object.entries(municipalities)) if (list.some((c) => c.ja === ja)) return p as MunicipalityPrefecture;
  for (const [p, list] of Object.entries(towns)) if (list.some((c) => c.ja === ja)) return p as MunicipalityPrefecture;
  return null;
}

/** English names of every listed city, by its Japanese name. */
export function englishCityName(ja: string): string | null {
  return allCities.get(ja) ?? null;
}

/**
 * A course can run from one city into another: it lists the cities in walking order (`route.municipalities`), and every
 * page shows them as "和歌山市 → 岬町". English pages get the English name of each listed city, town or village; a name
 * that is not in the lists is shown as it was entered. null when there is nothing to show.
 */
export function municipalityName(locale: string, cities: readonly string[]): string | null {
  const parts = cities.map((p) => p.trim()).filter((p) => p !== "");
  if (parts.length === 0) return null;
  return parts.map((p) => (locale === "en" ? (allCities.get(p) ?? p) : p)).join(" → ");
}

/** A cell with several cities (a spreadsheet's 市町村 column), in walking order, separated by 、 , or ，. */
export function splitCities(cell: string): string[] {
  return cell.split(/[、,，]/).map((p) => p.trim()).filter((p) => p !== "");
}
