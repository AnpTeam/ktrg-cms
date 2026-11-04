import type { RouteArea } from "./map-screen";
import { distanceMeters } from "./places";
import type { RouteDetail, SpotDetail, SpotListItem } from "./content";
import { route02Draft } from "./sample-route-02";
import type { Sketch } from "./sketch";

// SAMPLE DATA, for design review only; never shown unless SHOW_SAMPLE_CONTENT=1.
// The 19 route NAMES are the real ones (the same list as the database seed, from the
// official site) and are in trail order. Everything else is invented to exercise every
// state: a few routes are filled in and prefixed （見本）, the rest are skeletons exactly
// like the seed (name and order only). Spot names are invented. No coordinates.

const ROUTE_NAMES: readonly [string, string][] = [
  ["友ヶ島と加太周辺", "Tomogashima and Kada Surroundings"],
  ["甲山から孝子越え", "From Mt. Kabuto across Kyōshi-tōge"],
  ["飯盛山から札立山", "From Mt. Iimori to Mt. Fudatate"],
  ["大福山から雲山峰", "From Mt. Daifuku to the peak of Mt. Unzan"],
  ["山中渓から雄ノ山峠越え", "From Yamanakadani and over Onoyama-tōge Pass"],
  ["神通から根来寺", "From Jintsuu to Negoro-ji Temple"],
  ["志野峠から中津川・粉河寺へ", "From Shino-tōge Pass to Nakatsugawa and Kokawa-dera Temple"],
  ["犬鳴山", "Inunakisan"],
  ["和泉葛城山", "Mount Izumi-Katsuragi"],
  ["七越峠から桧原越え", "From Nanakoshi-tōge Pass and over Hibara"],
  ["四郷、堀越から光滝寺へ", "From Shigo and Horikoshi to Kotaki-ji Temple"],
  ["南葛城山", "Mount Minami-Katsuragi"],
  ["流谷から岩湧寺・天見不動", "From Nagaredani to Iwawaki-ji Temple and Amami-fudo"],
  ["岩瀬経塚山から神福山", "From Mount Kyōzuka in Iwase to Mount Jinpuku"],
  ["金剛山", "Mount Kongō"],
  ["葛城の道", "Katsuragi no Michi Route"],
  ["岩橋山", "Mount Iwahashi"],
  ["二上山", "Mount Nijō"],
  ["明神山から亀の瀬", "From Mount Myōjin to Kamenose"],
];

// Invented sketches, only so the silhouette and elevation fill can be reviewed.
const sketchA: Sketch = {
  points: [[0, 0.6], [0.1, 0.5], [0.22, 0.58], [0.34, 0.4], [0.5, 0.45], [0.62, 0.25], [0.78, 0.3], [0.9, 0.12], [1, 0.18]],
  elevations: [20, 60, 110, 90, 180, 260, 240, 330, 300],
};
const sketchB: Sketch = {
  points: [[0, 0.2], [0.15, 0.35], [0.3, 0.3], [0.45, 0.55], [0.6, 0.5], [0.72, 0.7], [0.85, 0.62], [1, 0.8]],
  elevations: [400, 380, 420, 300, 320, 220, 260, 150],
};

const spot = (s: Partial<SpotDetail> & Pick<SpotDetail, "id" | "routeId" | "routeNameJa" | "nameJa">): SpotDetail => ({
  routeNameEn: null,
  nameEn: null,
  status: "open",
  stamped: true,
  position: null,
  descriptionJa: null,
  descriptionEn: null,
  statusNoteJa: null,
  statusNoteEn: null,
  statusUpdatedAt: null,
  photoUrl: null,
  ...s,
});

const R1 = { routeId: "sample-r1", routeNameJa: "（見本）友ヶ島と加太周辺", routeNameEn: "(Sample) Tomogashima and Kada Surroundings" };

const handSpots: SpotDetail[] = [
  spot({
    id: "sample-s1",
    ...R1,
    nameJa: "（見本）スポット1",
    nameEn: "(Sample) Spot 1",
    // A sample story and two sample photos, so the page can be reviewed: the addresses are made up and show no picture.
    historyJa: "これは見本の「歴史・由来」です。実際の説明ではありません。\n名前の由来や、そこで起きたことを書きます。",
    historyEn: "This is a sample story, not a real one.\nIt tells where the name comes from and what happened there.",
    gallery: [
      { url: "https://example.com/sample-photo-1.jpg", credit: "（見本）撮影：山田 太郎、CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/" },
      { url: "https://example.com/sample-photo-2.jpg", credit: null, sourceUrl: null },
    ],
    descriptionJa:
      "これは見本の文章です。実際の説明ではありません。\n改行は、そのまま表示されます。\n\n空行で段落をわけることもできます。長い文章でも、読みやすい行の長さで表示されることをかくにんするための見本です。",
    descriptionEn:
      "This is sample text, not a real description.\nLine breaks are kept as entered.\n\nA blank line starts a new paragraph. This sample is long enough to check that the line length stays comfortable to read.",
  }),
  spot({
    id: "sample-s2",
    ...R1,
    nameJa: "（見本）スポット2",
    nameEn: "(Sample) Spot 2",
    status: "caution",
    stamped: false,
    statusNoteJa: "（見本）道がぬかるんでいます。足もとに気をつけてください。",
    statusNoteEn: "(Sample) The path is muddy. Watch your step.",
    statusUpdatedAt: "2026-10-15T05:30:00Z",
    descriptionJa: "これは見本の説明です。",
  }),
  spot({
    id: "sample-s3",
    ...R1,
    nameJa: "（見本）スポット3",
    status: "closed",
    stamped: false,
    statusNoteJa: "（見本）がけくずれのため、立ち入れません。",
    statusUpdatedAt: "2026-10-14T23:10:00Z",
  }),
];

/** n invented spots for a route; the first `stamped` of them are stamped. */
function plainSpots(routeId: string, routeNameJa: string, count: number, stamped: number): SpotDetail[] {
  return Array.from({ length: count }, (_, i) =>
    spot({
      id: `${routeId}-s${i + 1}`,
      routeId,
      routeNameJa,
      nameJa: `（見本）スポット${i + 1}`,
      nameEn: `(Sample) Spot ${i + 1}`,
      stamped: i < stamped,
    }),
  );
}

// Route 2: real draft stops. The first two are shown as stamped, for the signed-in preview only.
const R2 = { id: "sample-r2", name: route02Draft.nameJa };
const r2Spots: SpotDetail[] = route02Draft.spots.map((s, i) =>
  spot({
    id: `sample-r2-s${i + 1}`,
    routeId: R2.id,
    routeNameJa: R2.name,
    routeNameEn: "From Mt. Kabuto across Kyōshi-tōge",
    nameJa: s.nameJa,
    stamped: i < 2,
    position: { lat: s.lat, lng: s.lng, verified: false }, // draft: clicked on Navivi's map
    descriptionJa: s.descriptionJa,
  }),
);

const R3 = { id: "sample-r3", name: "（見本）飯盛山から札立山" };
const R4 = { id: "sample-r4", name: "（見本）大福山から雲山峰" };
const r3Spots = plainSpots(R3.id, R3.name, 6, 6); // complete
const r4Spots = plainSpots(R4.id, R4.name, 9, 3); // in progress

// Route 16 (葛城の道, Gose in Nara): a DEV placeholder so the Nara filter and the Nara emblem can be tried. Only the
// course name, its place (Gose city) and the plain names of its eight stops, in walking order, are kept; every text
// that describes the course or a stop was removed (it came from the foundation's other app and our right to reuse it
// is not settled), and there are no English names or coordinates yet. Descriptions are to be written by us from
// official sources, and coordinates entered from an authoritative source (CLAUDE.md). Shown only when sample content
// is on. The walk starts at a bus stop and ends at a station; those are transit points, not stamp places.
const R16 = { id: "sample-r16", nameJa: "葛城の道", nameEn: "Katsuragi no Michi Route" };
const r16Names = [
  "葛木水分神社（葛城第二十二経塚）",
  "中村家住宅（重要文化財）",
  "郵便名柄館",
  "葛城一言主神社",
  "九品寺（御所市）",
  "六地蔵石仏",
  "第二十三経塚",
  "吉祥草寺",
];
const r16Spots: SpotDetail[] = r16Names.map((nameJa, i) =>
  spot({
    id: `${R16.id}-s${i + 1}`,
    routeId: R16.id,
    routeNameJa: R16.nameJa,
    routeNameEn: R16.nameEn,
    nameJa,
    stamped: i < 3, // invented progress, for the signed-in preview only
  }),
);

export const sampleSpots: SpotDetail[] = [...handSpots, ...r2Spots, ...r3Spots, ...r4Spots, ...r16Spots];

function listItem(s: SpotDetail): SpotListItem {
  // The samples carry no kind of their own; the ones named as a sutra mound stand in for mounds on the map.
  return { id: s.id, nameJa: s.nameJa, nameEn: s.nameEn, status: s.status, descriptionJa: s.descriptionJa, descriptionEn: s.descriptionEn, statusNoteJa: s.statusNoteJa, statusNoteEn: s.statusNoteEn, statusUpdatedAt: s.statusUpdatedAt, photoUrl: s.photoUrl, kind: s.nameJa.includes("経塚") ? "mound" : undefined, stamped: s.stamped, position: s.position };
}

// ROUGH, INVENTED PLACEMENT for the home map's areas (sample data only, shown with the note 見本の位置（目安です）).
// The 19 courses are spread evenly along a hand-drawn line from Tomogashima in the west, across the Izumi range,
// to the Kongo and Nijo mountains and Kamenose in the east. The real area of each course must be entered in the
// CMS from an authoritative source (CLAUDE.md: positions are never guessed); course 2 uses its draft path.
const TRAIL_AXIS: readonly { lat: number; lng: number }[] = [
  { lat: 34.275, lng: 135.06 },
  { lat: 34.262, lng: 135.125 },
  { lat: 34.3, lng: 135.22 },
  { lat: 34.35, lng: 135.35 },
  { lat: 34.39, lng: 135.48 },
  { lat: 34.43, lng: 135.58 },
  { lat: 34.43, lng: 135.67 },
  { lat: 34.46, lng: 135.72 },
  { lat: 34.5, lng: 135.7 },
  { lat: 34.53, lng: 135.67 },
  { lat: 34.58, lng: 135.69 },
];

function sampleArea(order: number): RouteArea {
  const lengths = TRAIL_AXIS.slice(1).map((p, i) => distanceMeters(TRAIL_AXIS[i] as RouteArea, p));
  const total = lengths.reduce((a, b) => a + b, 0);
  let left = (total * (order - 1)) / 18;
  for (let i = 0; i < lengths.length; i++) {
    const segment = lengths[i] as number;
    if (left <= segment || i === lengths.length - 1) {
      const t = Math.min(1, left / segment);
      const a = TRAIL_AXIS[i] as RouteArea;
      const b = TRAIL_AXIS[i + 1] as RouteArea;
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, widthM: 9000, heightM: 6000, verified: false };
    }
    left -= segment;
  }
  return { ...(TRAIL_AXIS[0] as RouteArea), widthM: 9000, heightM: 6000, verified: false };
}

/** Course 2's area follows its own draft path: a box around all of it, with a margin. */
function route02Area(): RouteArea {
  const points = route02Draft.line.map(([lat, lng]) => ({ lat: lat as number, lng: lng as number }));
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  const widthM = distanceMeters({ lat: center.lat, lng: Math.min(...lngs) }, { lat: center.lat, lng: Math.max(...lngs) });
  const heightM = distanceMeters({ lat: Math.min(...lats), lng: center.lng }, { lat: Math.max(...lats), lng: center.lng });
  return { ...center, widthM: Math.round(widthM * 1.25), heightM: Math.round(heightM * 1.25), verified: false };
}

const skeleton = (order: number, ja: string, en: string): RouteDetail => ({
  id: `sample-r${order}`,
  order,
  status: "soon",
  nameJa: ja,
  nameEn: en,
  prefecture: null,
  municipality: null,
  distanceKm: null,
  elevationGainM: null,
  difficulty: null,
  nameKana: null,
  accessPoints: [],
  physicalLevel: null,
  technicalLevel: null,
  expectedTimeMin: null,
  farDistanceM: null,
  sketch: null,
  area: sampleArea(order),
  spotCount: 0,
  stampedCount: null,
  descriptionJa: null,
  descriptionEn: null,
  historyJa: null,
  historyEn: null,
  accessJa: null,
  accessEn: null,
  spots: [],
  points: [],
  line: null,
  videoUrl: null,
  photoUrl: null,
});

/** Filled-in routes replace their skeleton: same id, name prefixed （見本）. */
const rich: Record<number, Partial<RouteDetail>> = {
  1: {
    status: "ready",
    nameJa: R1.routeNameJa,
    nameEn: R1.routeNameEn,
    prefecture: "wakayama",
    municipality: "（見本）市",
    distanceKm: 8.2,
    elevationGainM: 420,
    difficulty: "ふつう",
    nameKana: null,
    accessPoints: [],
    physicalLevel: null,
    technicalLevel: null,
    expectedTimeMin: 210,
    farDistanceM: null,
    sketch: sketchA,
    descriptionJa: "これは見本のルート説明です。",
    descriptionEn: "This is a sample route description.",
    spotCount: 3,
    stampedCount: 1,
    spots: handSpots.filter((s) => s.routeId === "sample-r1").map(listItem),
  },
  2: {
    status: "ready",
    nameJa: R2.name,
    prefecture: route02Draft.prefecture,
    municipality: route02Draft.municipality,
    distanceKm: route02Draft.distanceKm,
    elevationGainM: route02Draft.elevationGainM,
    sketch: { points: [...route02Draft.sketch], elevations: [...route02Draft.elevations] },
    area: route02Area(),
    line: route02Draft.line.map(([lat, lng]) => ({ lat, lng })),
    // Invented: the sketch's elevations spread over the line's points, only so the chart can be reviewed.
    lineElevations: route02Draft.line.map((_, i, all) => {
      const at = (i / Math.max(1, all.length - 1)) * (route02Draft.elevations.length - 1);
      const lo = Math.floor(at);
      const hi = Math.min(route02Draft.elevations.length - 1, lo + 1);
      return route02Draft.elevations[lo]! + (route02Draft.elevations[hi]! - route02Draft.elevations[lo]!) * (at - lo);
    }),
    spotCount: r2Spots.length,
    stampedCount: 2,
    spots: r2Spots.map(listItem),
  },
  16: {
    status: "ready",
    nameJa: R16.nameJa,
    nameEn: R16.nameEn,
    prefecture: "nara",
    municipality: "御所市",
    spotCount: r16Spots.length,
    stampedCount: 3,
    spots: r16Spots.map(listItem),
  },
  3: {
    status: "ready",
    nameJa: R3.name,
    nameEn: "(Sample) From Mt. Iimori to Mt. Fudatate",
    prefecture: "osaka",
    distanceKm: 6.4,
    elevationGainM: 310,
    difficulty: "やさしい",
    nameKana: null,
    accessPoints: [],
    physicalLevel: null,
    technicalLevel: null,
    expectedTimeMin: 150,
    farDistanceM: null,
    sketch: sketchB,
    spotCount: r3Spots.length,
    stampedCount: r3Spots.length,
    spots: r3Spots.map(listItem),
  },
  4: {
    status: "ready",
    nameJa: R4.name,
    nameEn: null,
    prefecture: "osaka",
    distanceKm: 14.1,
    elevationGainM: 880,
    difficulty: "きびしい",
    nameKana: null,
    accessPoints: [],
    physicalLevel: null,
    technicalLevel: null,
    expectedTimeMin: 330,
    farDistanceM: null,
    sketch: sketchA,
    spotCount: r4Spots.length,
    stampedCount: 3,
    spots: r4Spots.map(listItem),
  },
};

export const sampleRoutes: RouteDetail[] = ROUTE_NAMES.map(([ja, en], i) => ({
  ...skeleton(i + 1, ja, en),
  ...(rich[i + 1] ?? {}),
}));
