// The 31 sutra mound places (経塚) as a stamp rally of their own, for the stamp page while the API does not
// exist yet. Names, readings and courses are copied from the manager's sheet (the same rows as the API's
// seed, apps/api/src/db/seed-data.ts); the English names are the sheet's romanised readings, a draft.
// Which ones are stamped is INVENTED sample progress. Shown only when sample content is on, like the
// other sample data, and never reachable from client code (see client-boundary.test.ts).

export interface SampleMound {
  /** The place in this rally, 1 to 31. */
  number: number;
  /** The mound's own number, 1 to 28 (3, 14 and 28 have two places). */
  mound: number;
  /** The course (1 to 19) it sits on. */
  routeNumber: number;
  nameJa: string;
  nameEn: string;
}

export const sampleMounds: readonly SampleMound[] = [
  { number: 1, mound: 1, routeNumber: 1, nameJa: "友ヶ島・序品", nameEn: "Tomogashima Johon" },
  { number: 2, mound: 2, routeNumber: 2, nameJa: "神福寺跡・方便品", nameEn: "Jinfukuji-ato Houbenhon" },
  { number: 3, mound: 3, routeNumber: 4, nameJa: "大福山・譬喩品", nameEn: "Daifukusan Hiyuhon" },
  { number: 4, mound: 3, routeNumber: 4, nameJa: "雲山峰・譬喩品", nameEn: "Unzanpou Hiyuhon" },
  { number: 5, mound: 4, routeNumber: 5, nameJa: "さくら地蔵・信解品", nameEn: "Sakura Jizou Shingehon" },
  { number: 6, mound: 5, routeNumber: 6, nameJa: "倉谷山・薬草喩品", nameEn: "Kurataniyama Yakusoyuhon" },
  { number: 7, mound: 6, routeNumber: 7, nameJa: "志野峠・授記品", nameEn: "Shinotouge Jukihon" },
  { number: 8, mound: 7, routeNumber: 7, nameJa: "中津川・化城喩品", nameEn: "Nakatsugawa Kejoyuhon" },
  { number: 9, mound: 8, routeNumber: 8, nameJa: "犬鳴山七宝龍寺鈴杵ヶ嶽・五百弟子受記品", nameEn: "Inunakiyama-Shipporyuji-Reishogadake Gohyakudeshijukihon" },
  { number: 10, mound: 9, routeNumber: 9, nameJa: "嶺の龍王・授学無学人記品", nameEn: "Minenoryuou Jugakumugakuninkihon" },
  { number: 11, mound: 10, routeNumber: 9, nameJa: "大威徳寺・法師品", nameEn: "Daiitokuji Hosshihon" },
  { number: 12, mound: 11, routeNumber: 10, nameJa: "七越峠経塚山・見宝塔品", nameEn: "Nanakositouge-Kyozukayama Kenpoutouhon" },
  { number: 13, mound: 12, routeNumber: 11, nameJa: "護摩のたわ朴留・堤婆達多品", nameEn: "Gomanotawahoodome Daibadattahon" },
  { number: 14, mound: 13, routeNumber: 11, nameJa: "向い多和・勧持品", nameEn: "Mukaitawa Kanjihon" },
  { number: 15, mound: 14, routeNumber: 12, nameJa: "南葛城山鏡宿・安楽行品", nameEn: "Minamikatsuragisan-Kagaminoshuku Anrakugyohon" },
  { number: 16, mound: 14, routeNumber: 11, nameJa: "光滝寺仏徳多和・安楽行品", nameEn: "Kotakiji-Buttokunotawa Anrakugyohon" },
  { number: 17, mound: 15, routeNumber: 13, nameJa: "岩湧山・従地湧出品", nameEn: "Iwawakisan Jyujiyujutsuhon" },
  { number: 18, mound: 16, routeNumber: 13, nameJa: "流谷金剛童子・如来寿量品", nameEn: "Nagaretani-Kongodouji Nyoraijuuryobon" },
  { number: 19, mound: 17, routeNumber: 13, nameJa: "天見不動・分別功徳品", nameEn: "Amamifudo Bunbetsukudokuhon" },
  { number: 20, mound: 18, routeNumber: 14, nameJa: "岩瀬経塚山・随喜功徳品", nameEn: "Iwazekyozukayama Zuikikudokuhon" },
  { number: 21, mound: 19, routeNumber: 14, nameJa: "神福山・法師功徳品", nameEn: "Jinpukusan Hosshikudokuhon" },
  { number: 22, mound: 20, routeNumber: 15, nameJa: "石寺跡・常不軽菩薩品", nameEn: "Ishidera-ato Joufukyobosatsuhon" },
  { number: 23, mound: 21, routeNumber: 15, nameJa: "金剛山・如来神力品", nameEn: "Kongozan Nyoraijinrikihon" },
  { number: 24, mound: 22, routeNumber: 16, nameJa: "水越多和・嘱累品", nameEn: "Mizukoshitawa Zokuruihon" },
  { number: 25, mound: 23, routeNumber: 16, nameJa: "俱尸羅・薬王菩薩本事品", nameEn: "Kujira Yakuoubosatsuhonjihon" },
  { number: 26, mound: 24, routeNumber: 17, nameJa: "平石峠・妙音菩薩品", nameEn: "Hiraishitouge Myoonbosatsuhon" },
  { number: 27, mound: 25, routeNumber: 17, nameJa: "高貴寺香華畑・観世音菩薩普門品", nameEn: "Koukiji-kougebata Kanzeonbosatsufumonhon" },
  { number: 28, mound: 26, routeNumber: 18, nameJa: "二上山・陀羅尼品", nameEn: "Nijozan Daranihon" },
  { number: 29, mound: 27, routeNumber: 18, nameJa: "逢坂・妙荘厳王本事品", nameEn: "Ousaka Myoshogonnouhonjihon" },
  { number: 30, mound: 28, routeNumber: 19, nameJa: "亀の尾宿・普賢菩薩勧発品", nameEn: "Kamenooshuku Fugenbosatsukanbotsuhon" },
  { number: 31, mound: 28, routeNumber: 19, nameJa: "明神山・普賢菩薩勧発品", nameEn: "Myojinyama Fugenbosatsukanbotsuhon" },
];

/** Invented progress: the first six places are stamped. */
export const sampleMoundsStamped = new Set([1, 2, 3, 4, 5, 6]);

/** Invented "last stamped" times, to show which rally the visitor was in most recently. */
export const sampleLastStamped: Record<string, string> = {
  mounds: "2026-10-14T09:40:00+09:00",
  "sample-r1": "2026-10-12T15:10:00+09:00",
  "sample-r2": "2026-10-15T11:25:00+09:00",
  "sample-r3": "2026-10-10T13:00:00+09:00",
  "sample-r4": "2026-10-11T10:45:00+09:00",
};
