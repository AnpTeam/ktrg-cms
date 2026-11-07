import type { TrailNotice } from "./notices";

// SAMPLE DATA, for design review only (shown only when sample content is on). Invented: no real closure, no real
// source. The source links go to the official Japan Heritage site's home page only so the link looks right.
export const sampleNotices: TrailNotice[] = [
  {
    id: "sample-notice-1",
    titleJa: "（見本）一部の区間で、道の工事があります",
    titleEn: "(Sample) Trail work on one section",
    bodyJa: "これは画面を確かめるための見本です。本当のお知らせではありません。",
    bodyEn: "This is a sample to check the layout. It is not a real notice.",
    sourceUrl: "https://katsuragisyugen-nihonisan.com/",
    sourceNameJa: "日本遺産「葛城修験」公式サイト",
    sourceNameEn: "Japan Heritage Katsuragi Shugen official site",
    verifiedOn: "2026-10-16",
    expiresOn: "2099-12-31",
    closure: false,
    routeId: null,
  },
];
