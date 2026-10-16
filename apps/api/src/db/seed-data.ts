/**
 * Starting content for a fresh database (WBS 1.2.3). Skeletons only: everything else
 * (distance, video, descriptions, coordinates) is filled in through the CMS.
 */

/**
 * The 19 routes, in order. Names are from the project workbook, which takes them from
 * the official site (katsuragisyugen-nihonisan.com).
 */
export const SEED_ROUTES: readonly { nameJa: string; nameEn: string }[] = [
  { nameJa: "友ヶ島と加太周辺", nameEn: "Tomogashima and Kada Surroundings" },
  { nameJa: "甲山から孝子越え", nameEn: "From Mt. Kabuto across Kyōshi-tōge" },
  { nameJa: "飯盛山から札立山", nameEn: "From Mt. Iimori to Mt. Fudatate" },
  { nameJa: "大福山から雲山峰", nameEn: "From Mt. Daifuku to the peak of Mt. Unzan" },
  { nameJa: "山中渓から雄ノ山峠越え", nameEn: "From Yamanakadani and over Onoyama-tōge Pass" },
  { nameJa: "神通から根来寺", nameEn: "From Jintsuu to Negoro-ji Temple" },
  { nameJa: "志野峠から中津川・粉河寺へ", nameEn: "From Shino-tōge Pass to Nakatsugawa and Kokawa-dera Temple" },
  { nameJa: "犬鳴山", nameEn: "Inunakisan" },
  { nameJa: "和泉葛城山", nameEn: "Mount Izumi-Katsuragi" },
  { nameJa: "七越峠から桧原越え", nameEn: "From Nanakoshi-tōge Pass and over Hibara" },
  { nameJa: "四郷、堀越から光滝寺へ", nameEn: "From Shigo and Horikoshi to Kotaki-ji Temple" },
  { nameJa: "南葛城山", nameEn: "Mount Minami-Katsuragi" },
  { nameJa: "流谷から岩湧寺・天見不動", nameEn: "From Nagaredani to Iwawaki-ji Temple and Amami-fudo" },
  { nameJa: "岩瀬経塚山から神福山", nameEn: "From Mount Kyōzuka in Iwase to Mount Jinpuku" },
  { nameJa: "金剛山", nameEn: "Mount Kongō" },
  { nameJa: "葛城の道", nameEn: "Katsuragi no Michi Route" },
  { nameJa: "岩橋山", nameEn: "Mount Iwahashi" },
  { nameJa: "二上山", nameEn: "Mount Nijō" },
  { nameJa: "明神山から亀の瀬", nameEn: "From Mount Myōjin to Kamenose" },
];

export const SEED_SPOT_COUNT = 31;

/**
 * The 31 sutra mounds (経塚), one stamp spot each, copied from the manager's sheet
 * 「経塚スタンプラリー・コースで遥拝できる経塚」 (261005a). The sheet numbers the mounds 1 to 28 (the 28
 * chapters of the sutra, 葛城二十八宿); numbers 3, 14 and 28 have two places each, which makes 31.
 *  - mound: that number. routeNumber: the course (1 to 19) the sheet puts it on. Course 3 has none.
 *  - sortOrder: the place within its course, in the sheet's order.
 *  - nameEn: the sheet's romanised reading, as written (a reading, not a translation: a draft).
 *  - municipality: as written in the sheet (not stored in the database; 泉南群岬町 looks like a
 *    typo for 泉南郡岬町: confirm with the manager).
 * No coordinates: the sheet has none ("check-in place" is empty) and they are never guessed. Every
 * spot is seeded as an unpublished draft.
 */
export const SEED_SPOTS: readonly {
  mound: number;
  routeNumber: number;
  sortOrder: number;
  nameJa: string;
  nameEn: string;
  municipality: string;
}[] = [
  { mound: 1, routeNumber: 1, sortOrder: 1, nameJa: "友ヶ島・序品", nameEn: "Tomogashima Johon", municipality: "和歌山市" },
  { mound: 2, routeNumber: 2, sortOrder: 1, nameJa: "神福寺跡・方便品", nameEn: "Jinfukuji-ato Houbenhon", municipality: "泉南群岬町" },
  { mound: 3, routeNumber: 4, sortOrder: 1, nameJa: "大福山・譬喩品", nameEn: "Daifukusan Hiyuhon", municipality: "和歌山市" },
  { mound: 3, routeNumber: 4, sortOrder: 2, nameJa: "雲山峰・譬喩品", nameEn: "Unzanpou Hiyuhon", municipality: "和歌山市" },
  { mound: 4, routeNumber: 5, sortOrder: 1, nameJa: "さくら地蔵・信解品", nameEn: "Sakura Jizou Shingehon", municipality: "和歌山市" },
  { mound: 5, routeNumber: 6, sortOrder: 1, nameJa: "倉谷山・薬草喩品", nameEn: "Kurataniyama Yakusoyuhon", municipality: "紀の川市" },
  { mound: 6, routeNumber: 7, sortOrder: 1, nameJa: "志野峠・授記品", nameEn: "Shinotouge Jukihon", municipality: "紀の川市" },
  { mound: 7, routeNumber: 7, sortOrder: 2, nameJa: "中津川・化城喩品", nameEn: "Nakatsugawa Kejoyuhon", municipality: "紀の川市" },
  { mound: 8, routeNumber: 8, sortOrder: 1, nameJa: "犬鳴山七宝龍寺鈴杵ヶ嶽・五百弟子受記品", nameEn: "Inunakiyama-Shipporyuji-Reishogadake Gohyakudeshijukihon", municipality: "泉佐野市" },
  { mound: 9, routeNumber: 9, sortOrder: 1, nameJa: "嶺の龍王・授学無学人記品", nameEn: "Minenoryuou Jugakumugakuninkihon", municipality: "紀の川市" },
  { mound: 10, routeNumber: 9, sortOrder: 2, nameJa: "大威徳寺・法師品", nameEn: "Daiitokuji Hosshihon", municipality: "岸和田市" },
  { mound: 11, routeNumber: 10, sortOrder: 1, nameJa: "七越峠経塚山・見宝塔品", nameEn: "Nanakositouge-Kyozukayama Kenpoutouhon", municipality: "和泉市" },
  { mound: 12, routeNumber: 11, sortOrder: 1, nameJa: "護摩のたわ朴留・堤婆達多品", nameEn: "Gomanotawahoodome Daibadattahon", municipality: "伊都郡かつらぎ町" },
  { mound: 13, routeNumber: 11, sortOrder: 2, nameJa: "向い多和・勧持品", nameEn: "Mukaitawa Kanjihon", municipality: "伊都郡かつらぎ町" },
  { mound: 14, routeNumber: 12, sortOrder: 1, nameJa: "南葛城山鏡宿・安楽行品", nameEn: "Minamikatsuragisan-Kagaminoshuku Anrakugyohon", municipality: "橋本市" },
  { mound: 14, routeNumber: 11, sortOrder: 3, nameJa: "光滝寺仏徳多和・安楽行品", nameEn: "Kotakiji-Buttokunotawa Anrakugyohon", municipality: "河内長野市" },
  { mound: 15, routeNumber: 13, sortOrder: 1, nameJa: "岩湧山・従地湧出品", nameEn: "Iwawakisan Jyujiyujutsuhon", municipality: "河内長野市" },
  { mound: 16, routeNumber: 13, sortOrder: 2, nameJa: "流谷金剛童子・如来寿量品", nameEn: "Nagaretani-Kongodouji Nyoraijuuryobon", municipality: "河内長野市" },
  { mound: 17, routeNumber: 13, sortOrder: 3, nameJa: "天見不動・分別功徳品", nameEn: "Amamifudo Bunbetsukudokuhon", municipality: "河内長野市" },
  { mound: 18, routeNumber: 14, sortOrder: 1, nameJa: "岩瀬経塚山・随喜功徳品", nameEn: "Iwazekyozukayama Zuikikudokuhon", municipality: "河内長野市" },
  { mound: 19, routeNumber: 14, sortOrder: 2, nameJa: "神福山・法師功徳品", nameEn: "Jinpukusan Hosshikudokuhon", municipality: "五條市" },
  { mound: 20, routeNumber: 15, sortOrder: 1, nameJa: "石寺跡・常不軽菩薩品", nameEn: "Ishidera-ato Joufukyobosatsuhon", municipality: "御所市" },
  { mound: 21, routeNumber: 15, sortOrder: 2, nameJa: "金剛山・如来神力品", nameEn: "Kongozan Nyoraijinrikihon", municipality: "御所市" },
  { mound: 22, routeNumber: 16, sortOrder: 1, nameJa: "水越多和・嘱累品", nameEn: "Mizukoshitawa Zokuruihon", municipality: "御所市" },
  { mound: 23, routeNumber: 16, sortOrder: 2, nameJa: "俱尸羅・薬王菩薩本事品", nameEn: "Kujira Yakuoubosatsuhonjihon", municipality: "御所市" },
  { mound: 24, routeNumber: 17, sortOrder: 1, nameJa: "平石峠・妙音菩薩品", nameEn: "Hiraishitouge Myoonbosatsuhon", municipality: "南河内郡河南町" },
  { mound: 25, routeNumber: 17, sortOrder: 2, nameJa: "高貴寺香華畑・観世音菩薩普門品", nameEn: "Koukiji-kougebata Kanzeonbosatsufumonhon", municipality: "南河内郡河南町" },
  { mound: 26, routeNumber: 18, sortOrder: 1, nameJa: "二上山・陀羅尼品", nameEn: "Nijozan Daranihon", municipality: "葛城市" },
  { mound: 27, routeNumber: 18, sortOrder: 2, nameJa: "逢坂・妙荘厳王本事品", nameEn: "Ousaka Myoshogonnouhonjihon", municipality: "香芝市" },
  { mound: 28, routeNumber: 19, sortOrder: 1, nameJa: "亀の尾宿・普賢菩薩勧発品", nameEn: "Kamenooshuku Fugenbosatsukanbotsuhon", municipality: "柏原市" },
  { mound: 28, routeNumber: 19, sortOrder: 2, nameJa: "明神山・普賢菩薩勧発品", nameEn: "Myojinyama Fugenbosatsukanbotsuhon", municipality: "北葛城郡王寺町" },
];

/** What the seed inserts for each spot (the route is looked up by `routeNumber`). */
export function seedSpots(): { nameJa: string; nameEn: string; sortOrder: number; routeNumber: number }[] {
  return SEED_SPOTS.map(({ nameJa, nameEn, sortOrder, routeNumber }) => ({ nameJa, nameEn, sortOrder, routeNumber }));
}
