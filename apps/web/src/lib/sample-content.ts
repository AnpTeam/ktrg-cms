import type { RouteDetail, SpotDetail, SpotListItem } from "./content";

// SAMPLE DATA, not real. Invented only to exercise every layout case (full stats,
// partial stats, a skeleton route, a long name, English missing, each spot status).
// Never shown unless SHOW_SAMPLE_CONTENT=1. No real place names or coordinates.

const ROUTE1 = { routeId: "sample-r1", routeNameJa: "（見本）ルート1", routeNameEn: "(Sample) Route 1" };
const ROUTE2 = {
  routeId: "sample-r2",
  routeNameJa: "（見本）ルート2 とても長い名前の場合の表示をかくにんするための見本",
  routeNameEn: null,
};

const spot = (s: Partial<SpotDetail> & Pick<SpotDetail, "id" | "routeId" | "routeNameJa" | "nameJa">): SpotDetail => ({
  routeNameEn: null,
  nameEn: null,
  status: "open",
  stamped: null,
  descriptionJa: null,
  descriptionEn: null,
  statusNoteJa: null,
  statusNoteEn: null,
  statusUpdatedAt: null,
  ...s,
});

export const sampleSpots: SpotDetail[] = [
  spot({
    id: "sample-s1",
    ...ROUTE1,
    nameJa: "（見本）スポット1",
    nameEn: "(Sample) Spot 1",
    stamped: true,
    descriptionJa:
      "これは見本の文章です。実際の説明ではありません。\n改行は、そのまま表示されます。\n\n空行で段落をわけることもできます。長い文章でも、読みやすい行の長さで表示されることをかくにんするための見本です。",
    descriptionEn:
      "This is sample text, not a real description.\nLine breaks are kept as entered.\n\nA blank line starts a new paragraph. This sample is long enough to check that the line length stays comfortable to read.",
  }),
  spot({
    id: "sample-s2",
    ...ROUTE1,
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
    ...ROUTE1,
    nameJa: "（見本）スポット3",
    status: "closed",
    stamped: false,
    statusNoteJa: "（見本）がけくずれのため、立ち入れません。",
    statusUpdatedAt: "2026-10-14T23:10:00Z",
  }),
  spot({
    id: "sample-s4",
    ...ROUTE2,
    nameJa: "（見本）スポット4",
    descriptionJa: "日本語だけの見本です。英語の説明は入力されていません。",
  }),
  spot({ id: "sample-s5", ...ROUTE2, nameJa: "（見本）スポット5" }),
];

function listItem(id: string): SpotListItem {
  const s = sampleSpots.find((x) => x.id === id);
  if (!s) throw new Error(`sample spot missing: ${id}`);
  return { id: s.id, nameJa: s.nameJa, nameEn: s.nameEn, status: s.status, stamped: s.stamped };
}

export const sampleRoutes: RouteDetail[] = [
  {
    id: "sample-r1",
    nameJa: "（見本）ルート1",
    nameEn: "(Sample) Route 1",
    prefecture: "wakayama",
    municipality: "（見本）市",
    distanceKm: 8.2,
    elevationGainM: 420,
    difficulty: "ふつう",
    expectedTimeMin: 210,
    descriptionJa: "これは見本のルート説明です。",
    descriptionEn: "This is a sample route description.",
    spotCount: 3,
    stampedCount: 1,
    spots: [listItem("sample-s1"), listItem("sample-s2"), listItem("sample-s3")],
  },
  {
    id: "sample-r2",
    nameJa: ROUTE2.routeNameJa,
    nameEn: null,
    prefecture: "osaka",
    municipality: null,
    distanceKm: 12.5,
    elevationGainM: null,
    difficulty: null,
    expectedTimeMin: 90,
    descriptionJa: null,
    descriptionEn: null,
    spotCount: 2,
    stampedCount: 0,
    spots: [listItem("sample-s4"), listItem("sample-s5")],
  },
  {
    id: "sample-r3",
    nameJa: "（見本）ルート3",
    nameEn: "(Sample) Route 3",
    prefecture: "nara",
    municipality: null,
    distanceKm: null,
    elevationGainM: null,
    difficulty: null,
    expectedTimeMin: null,
    descriptionJa: null,
    descriptionEn: null,
    spotCount: 0,
    stampedCount: null,
    spots: [],
  },
  {
    id: "sample-r4",
    nameJa: "（見本）ルート4",
    nameEn: "(Sample) Route 4",
    prefecture: "nara",
    municipality: "（見本）町",
    distanceKm: 5,
    elevationGainM: 120,
    difficulty: "やさしい",
    expectedTimeMin: 150,
    descriptionJa: null,
    descriptionEn: null,
    spotCount: 0,
    stampedCount: null,
    spots: [],
  },
];
