import { expect, test } from "bun:test";
import { noticeFeed } from "./notice-feed";
import type { TrailNotice } from "./notices";

const n = (id: string, routeId: string | null, titleJa: string): TrailNotice =>
  ({ id, titleJa, titleEn: "", bodyJa: "<b>&", bodyEn: "", sourceUrl: "https://example.com/a?x=1&y=2", sourceNameJa: "", sourceNameEn: "", verifiedOn: "2026-10-01", expiresOn: null, routeId }) as TrailNotice;

test("feed keeps one route's notices plus whole-trail ones, and escapes text", () => {
  const xml = noticeFeed([n("a", "r1", "A"), n("b", "r2", "B"), n("c", null, "C")], { site: "https://x.test", locale: "ja", routeId: "r1" });
  expect(xml).toContain("<title>A</title>");
  expect(xml).toContain("<title>C</title>");
  expect(xml).not.toContain("<title>B</title>");
  expect(xml).toContain("&lt;b&gt;&amp;");
  expect(xml).toContain("x=1&amp;y=2");
});
