import type { RouteDetail, SpotDetail, SpotListItem } from "./content";
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
  descriptionJa: null,
  descriptionEn: null,
  statusNoteJa: null,
  statusNoteEn: null,
  statusUpdatedAt: null,
  ...s,
});

const R1 = { routeId: "sample-r1", routeNameJa: "（見本）友ヶ島と加太周辺", routeNameEn: "(Sample) Tomogashima and Kada Surroundings" };
const R2 = { routeId: "sample-r2", routeNameJa: "（見本）甲山から孝子越え", routeNameEn: null };

const handSpots: SpotDetail[] = [
  spot({
    id: "sample-s1",
    ...R1,
    nameJa: "（見本）スポット1",
    nameEn: "(Sample) Spot 1",
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
  spot({
    id: "sample-s4",
    ...R2,
    nameJa: "（見本）スポット4",
    stamped: false,
    descriptionJa: "日本語だけの見本です。英語の説明は入力されていません。",
  }),
  spot({ id: "sample-s5", ...R2, nameJa: "（見本）スポット5", stamped: false }),
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

const R3 = { id: "sample-r3", name: "（見本）飯盛山から札立山" };
const R4 = { id: "sample-r4", name: "（見本）大福山から雲山峰" };
const r3Spots = plainSpots(R3.id, R3.name, 6, 6); // complete
const r4Spots = plainSpots(R4.id, R4.name, 9, 3); // in progress

export const sampleSpots: SpotDetail[] = [...handSpots, ...r3Spots, ...r4Spots];

function listItem(s: SpotDetail): SpotListItem {
  return { id: s.id, nameJa: s.nameJa, nameEn: s.nameEn, status: s.status, stamped: s.stamped };
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
  expectedTimeMin: null,
  sketch: null,
  spotCount: 0,
  stampedCount: null,
  descriptionJa: null,
  descriptionEn: null,
  spots: [],
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
    expectedTimeMin: 210,
    sketch: sketchA,
    descriptionJa: "これは見本のルート説明です。",
    descriptionEn: "This is a sample route description.",
    spotCount: 3,
    stampedCount: 1,
    spots: handSpots.filter((s) => s.routeId === "sample-r1").map(listItem),
  },
  2: {
    status: "ready",
    nameJa: R2.routeNameJa,
    nameEn: null,
    prefecture: "osaka",
    distanceKm: 12.5,
    expectedTimeMin: 90,
    sketch: sketchB,
    spotCount: 2,
    stampedCount: 0,
    spots: handSpots.filter((s) => s.routeId === "sample-r2").map(listItem),
  },
  3: {
    status: "ready",
    nameJa: R3.name,
    nameEn: "(Sample) From Mt. Iimori to Mt. Fudatate",
    prefecture: "osaka",
    distanceKm: 6.4,
    elevationGainM: 310,
    difficulty: "やさしい",
    expectedTimeMin: 150,
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
    expectedTimeMin: 330,
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
