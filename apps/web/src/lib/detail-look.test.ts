import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user): the course page and the rally page in the new look, matching the stop page: Mincho titles in the
// readable red, group titles with the brand bar, capsule panels. The rally page takes the course page's cover.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8").replace(/\r\n/g, "\n");
const GROUP_TITLE = "border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent";
const rally = () => read("app", "(public)", "rallies", "[id]", "page.tsx");
const routePage = () => read("app", "(public)", "routes", "[id]", "page.tsx");
const view = () => read("components", "RouteView.tsx");

test("the course title is Mincho in the readable red and keeps its furigana", () => {
  expect(view()).toMatch(/<h1 className="min-w-0 font-serif text-4xl font-bold leading-tight text-accent has-\[rt\]:pt-4">\n\s*<NameRuby title=\{title\} reading=\{route\.nameKana\} \/>/);
  expect(routePage()).toMatch(/<h1 className="font-serif text-3xl font-bold text-accent">/);
});

test("every group title on the course page has the brand bar", () => {
  const v = view();
  const folds = [...v.matchAll(/<Fold[^>]*title=\{<span className="([^"]*)">/g)].map((m) => m[1]);
  expect(folds.length).toBe(5);
  for (const c of folds) expect(c).toBe("border-l-4 border-brand pl-3 font-serif text-accent");
  expect(v).not.toMatch(/<Fold[^>]*title=\{<Trans>/);
  expect(v).toContain(`<h2 className="${GROUP_TITLE}">`);
  expect(v).not.toMatch(/<h2 className="text-xl font-bold">/);
});

test("course page panels are capsules", () => {
  for (const f of ["ElevationChart.tsx", "ElevationProfile.tsx", "RouteJourney.tsx", "RouteStats.tsx", "StopList.tsx", "OfflinePack.tsx"]) {
    expect(read("components", f)).not.toMatch(/rounded-3xl|rounded-lg bg-surface/);
  }
  expect(read("components", "ElevationChart.tsx")).toMatch(/rounded-\[1\.75rem\] bg-surface p-4/);
  expect(read("components", "ElevationProfile.tsx")).toMatch(/rounded-\[1\.75rem\] bg-surface p-4/);
  expect(read("components", "RouteJourney.tsx")).toMatch(/rounded-\[1\.75rem\] bg-surface p-4/);
  expect(read("components", "OfflinePack.tsx")).toMatch(/rounded-\[1\.75rem\] bg-surface p-4/);
  expect(read("components", "StopList.tsx")).toMatch(/overflow-hidden rounded-\[1\.75rem\] bg-surface/);
  // The next-course card and the not-ready note are capsules too.
  expect(routePage()).not.toMatch(/rounded-2xl/);
  expect(routePage()).toMatch(/rounded-\[1\.75rem\] bg-surface p-4 no-underline/);
});

test("the rally page takes the course cover, Mincho title and group titles", () => {
  const r = rally();
  expect(r).toMatch(/<CoverPhoto photo=\{photo\} flat \/>/);
  expect(r).toMatch(/<h1 className="font-serif text-3xl font-bold leading-snug text-accent wide:text-4xl">/);
  expect(r).not.toMatch(/SectionBanner|rounded-3xl|className="frame/);
  const h2s = [...r.matchAll(/<h2 className="([^"]*)"/g)].map((m) => m[1]);
  expect(h2s.length).toBe(2);
  for (const c of h2s) expect(c).toBe(GROUP_TITLE);
  expect(r).toMatch(/pattern-shippo mx-4 flex flex-col items-center gap-3 rounded-\[1\.75rem\] bg-surface p-6/);
});

test("stamping and status pieces stay on the rally page", () => {
  const r = rally();
  expect(r).toContain("<RallyNearbyStamp places={detail.places} held={held} locale={i18n.locale} rallyName={name} quiet={stamped === 0} />");
  expect(r).toContain("<StampGrid total={rally.total} stamped={stampedNumbers(rally)} showNext={rally.stamped !== null} />");
});
