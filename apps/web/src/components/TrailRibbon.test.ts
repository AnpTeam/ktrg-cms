import { expect, test } from "bun:test";
import type { RouteSummary } from "@/lib/content";
import { buildStops } from "./TrailRibbon";

const route = (order: number, status: "ready" | "soon" = "ready"): RouteSummary =>
  ({ id: `r${order}`, order, status, nameJa: `R${order}`, nameEn: null, prefecture: null, municipality: null, spotCount: 3, stampedCount: null } as RouteSummary);

test("a jump in the course numbers is dashed, never a solid line between courses that do not meet", () => {
  // The home page at launch: only courses 1 and 16 open.
  const [first, second] = buildStops([route(1), route(16)]);
  expect(first!.below).toBe("soon");
  expect(second!.above).toBe("soon");
});

test("neighbouring open courses keep a solid line", () => {
  const [first, second] = buildStops([route(1), route(2)]);
  expect(first!.below).toBe("open");
  expect(second!.above).toBe("open");
});
