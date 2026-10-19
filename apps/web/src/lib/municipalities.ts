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

/** The cities to choose from for a prefecture (none when no prefecture is chosen). */
export function municipalitiesOf(prefecture: MunicipalityPrefecture | null): readonly Municipality[] {
  return prefecture ? municipalities[prefecture] : [];
}

/** Is this stored name one of the listed cities of the prefecture? (If not, it was typed by hand.) */
export function isListedMunicipality(prefecture: MunicipalityPrefecture | null, value: string): boolean {
  return municipalitiesOf(prefecture).some((c) => c.ja === value);
}

const allCities = new Map(Object.values(municipalities).flatMap((list) => list.map((c) => [c.ja, c.en] as const)));

/** The name to show: English pages get the English name of a listed city; anything else is shown as it was stored. */
export function municipalityName(locale: string, stored: string | null): string | null {
  if (stored === null || stored.trim() === "") return null;
  return locale === "en" ? (allCities.get(stored.trim()) ?? stored) : stored;
}
