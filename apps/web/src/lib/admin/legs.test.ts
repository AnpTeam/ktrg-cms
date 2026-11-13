import { describe, expect, test } from "bun:test";
import {
  anchorsFromPoints,
  backChoices,
  backLeg,
  backPairs,
  pairId,
  capLegs,
  guideRoute,
  insertGuidePoint,
  moveGuidePoint,
  removeGuidePoint,
  insertAnchor,
  joinLegs,
  legFromPath,
  legsFromJoined,
  pathOfLeg,
  pathStops,
  pointsFromAnchors,
  reconcileLegs,
  removeAnchors,
  setAllCurves,
  sidePairs,
  splitLine,
  stopsFollowLine,
  toggleAnchorCurve,
  type Leg,
  type Path,
  type Stop,
} from "./legs";
import type { LngLatEle } from "./line";

const stop = (key: string, lat: number, lng: number): Stop => ({ key, lat, lng });
const A = stop("a", 34.0, 135.0);
const B = stop("b", 34.01, 135.01);
const C = stop("c", 34.02, 135.0);
const leg = (from: Stop, to: Stop, ...inner: LngLatEle[]): Leg => ({ from: from.key, to: to.key, points: [[from.lng, from.lat], ...inner, [to.lng, to.lat]] });

describe("stops", () => {
  test("a side trip and a waypoint without a position are not on the path", () => {
    const places = [
      { key: "a", lat: 34, lng: 135, stopBy: false },
      { key: "side", lat: 34.005, lng: 135.005, stopBy: true },
      { key: "none", lat: null, lng: null, stopBy: false },
      { key: "b", lat: 34.01, lng: 135.01, stopBy: false },
    ];
    expect(pathStops(places).map((s) => s.key)).toEqual(["a", "b"]);
  });
});

describe("side trips (寄り道)", () => {
  const places = [
    { key: "early", lat: 34.0, lng: 135.0, stopBy: true }, // before any stop: nothing to branch from
    { key: "a", lat: 34.0, lng: 135.0, stopBy: false },
    { key: "side", lat: 34.005, lng: 135.005, stopBy: true },
    { key: "unplaced", lat: null, lng: null, stopBy: true },
    { key: "b", lat: 34.01, lng: 135.01, stopBy: false },
    { key: "side2", lat: 34.015, lng: 135.015, stopBy: true },
  ];

  test("a stop-by place branches off the stop before it in the list", () => {
    expect(sidePairs(places).map((p) => [p.from.key, p.to.key])).toEqual([["a", "side"], ["b", "side2"]]);
  });

  test("a side trip keeps its stretch beside the route's own, marked as a side trip, and stays out of the joined line", () => {
    const stops = pathStops(places);
    const main = leg(A, B, [135.003, 34.003]);
    const spur: Leg = { from: "a", to: "side", points: [[135.0, 34.0], [135.005, 34.005]] };
    const kept = reconcileLegs(stops, [main, spur], sidePairs(places));
    expect(kept.map((l) => [l.from, l.to, !!l.side])).toEqual([["a", "b", false], ["a", "side", true]]);
    expect(joinLegs(stops, kept).line).toEqual(main.points);
    // Nothing changed: the same legs come back, so the draft does not look edited.
    expect(reconcileLegs(stops, kept, sidePairs(places))).toBe(kept);
  });

  test("a side trip whose place was removed or whose stop-by switch went off is dropped or becomes a stretch of the route", () => {
    const spur: Leg = { from: "a", to: "side", points: [[135.0, 34.0], [135.005, 34.005]], side: true };
    expect(reconcileLegs(pathStops(places.filter((p) => p.key !== "side")), [spur], sidePairs(places.filter((p) => p.key !== "side")))).toEqual([]);
    const asStop = places.map((p) => (p.key === "side" ? { ...p, stopBy: false } : p));
    const kept = reconcileLegs(pathStops(asStop), [spur], sidePairs(asStop));
    expect(kept.map((l) => [l.from, l.to, !!l.side])).toEqual([["a", "side", false]]);
  });
});

describe("joining legs", () => {
  test("legs are joined in order without repeating the shared stop", () => {
    const { line, pieces } = joinLegs([A, B, C], [leg(A, B, [135.002, 34.004]), leg(B, C, [135.008, 34.015])]);
    expect(line).toEqual([[135, 34], [135.002, 34.004], [135.01, 34.01], [135.008, 34.015], [135, 34.02]]);
    expect(pieces).toEqual([
      { from: "a", to: "b", start: 0, skipFirst: false, length: 3 },
      { from: "b", to: "c", start: 3, skipFirst: true, length: 2 },
    ]);
  });
  test("a pair without a leg is bridged by a straight hop", () => {
    expect(joinLegs([A, B, C], [leg(B, C)]).line).toEqual([[135, 34], [135.01, 34.01], [135, 34.02]]);
  });
  test("heights filled into the joined line go back to the legs they belong to", () => {
    const legs = [leg(A, B, [135.002, 34.004]), leg(B, C)];
    const { line } = joinLegs([A, B, C], legs);
    const withHeights = line.map((p, i): LngLatEle => [p[0], p[1], 100 + i]);
    const back = legsFromJoined([A, B, C], legs, withHeights)!;
    expect(back[0]!.points.map((p) => p[2])).toEqual([100, 101, 102]);
    expect(back[1]!.points.map((p) => p[2])).toEqual([102, 103]); // its first point is the stop it shares
    // a line that is no longer the one the legs make is refused
    expect(legsFromJoined([A, B, C], legs, withHeights.slice(1))).toBeNull();
  });
});

describe("keeping legs in step with the stops", () => {
  test("a leg whose end stop moved follows it; unchanged legs are kept as they were", () => {
    const [l1, l2] = [leg(A, B, [135.002, 34.004]), leg(B, C)];
    const moved = stop("b", 34.012, 135.011);
    const out = reconcileLegs([A, moved, C], [l1, l2]);
    expect(out[0]!.points.at(-1)).toEqual([135.011, 34.012]);
    expect(out[0]!.points[1]).toEqual([135.002, 34.004]); // its inner points stay
    expect(reconcileLegs([A, B, C], [l1, l2])).toEqual([l1, l2]);
  });
  test("a hand-drawn leg is rebuilt from its anchors when a stop moves", () => {
    const path = { anchors: [[34.005, 135.0] as [number, number]], curves: [null] };
    const drawn = legFromPath(A, B, path);
    const moved = stop("b", 34.012, 135.011);
    const out = reconcileLegs([A, moved], [drawn]);
    expect(out[0]!.anchors).toEqual(path.anchors);
    expect(out[0]!.points.at(-1)).toEqual([135.011, 34.012]);
  });
  test("taking a stop out joins the two legs that met there; reordering drops legs that no longer fit", () => {
    const [l1, l2] = [leg(A, B, [135.002, 34.004]), leg(B, C, [135.008, 34.015])];
    const merged = reconcileLegs([A, C], [l1, l2]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ from: "a", to: "c" });
    expect(merged[0]!.points.map((p) => [p[0], p[1]])).toEqual([[135, 34], [135.002, 34.004], [135.01, 34.01], [135.008, 34.015], [135, 34.02]]);
    expect(reconcileLegs([A, C, B], [l1, l2])).toEqual([]);
  });
});

describe("cutting a line into legs", () => {
  const line: LngLatEle[] = [[135, 34], [135.002, 34.002], [135.005, 34.005, 50], [135.008, 34.008], [135.01, 34.01], [135.005, 34.015], [135, 34.02]];
  test("each pair of stops takes its stretch, ends exactly on the stops, heights of inner points kept", () => {
    const legs = splitLine([A, B, C], line);
    expect(legs.map((l) => [l.from, l.to])).toEqual([["a", "b"], ["b", "c"]]);
    expect(legs[0]!.points[0]).toEqual([135, 34]);
    expect(legs[0]!.points.at(-1)).toEqual([135.01, 34.01]);
    expect(legs[0]!.points).toContainEqual([135.005, 34.005, 50]);
    expect(legs[1]!.points[0]).toEqual([135.01, 34.01]);
  });
  test("stops that do not follow the line are not cut: no straight hops are made from a good line", () => {
    expect(stopsFollowLine([A, B, C], line)).toBe(true);
    // the same stops in another order (a stop visited twice, or back to the start)
    expect(splitLine([A, C, B], line)).toEqual([]);
    expect(splitLine([A, B, A, C], line)).toEqual([]);
    // a stop far from the line is not on it
    expect(splitLine([A, stop("far", 34.5, 135.5), C], line)).toEqual([]);
    // forcing cuts anyway
    expect(splitLine([A, C, B], line, { force: true })).toHaveLength(2);
  });
  test("a small step back (a viewpoint on a spur) is fine", () => {
    const spur: LngLatEle[] = [[135, 34], [135.001, 34.001], [135.002, 34.002], [135.003, 34.003], [135.004, 34.004], [135.01, 34.01]];
    const near = stop("n", 34.0025, 135.0025);
    const spurStop = stop("s", 34.0015, 135.0015); // nearest point is before the previous stop's, by about 150 m
    expect(splitLine([A, near, spurStop, B], spur)).toHaveLength(3);
  });
  test("fewer than two stops or points: nothing to cut", () => {
    expect(splitLine([A], line)).toEqual([]);
    expect(splitLine([A, B], [[135, 34]])).toEqual([]);
  });
  test("a long line is thinned to the budget, the long leg keeping more than the short one", () => {
    const long: LngLatEle[] = Array.from({ length: 3000 }, (_, i) => [135 + i * 1e-5, 34 + Math.sin(i / 20) * 1e-3]);
    const legs = capLegs([
      { from: "a", to: "b", points: long.slice(0, 2700) },
      { from: "b", to: "c", points: long.slice(2700) },
    ]);
    const total = legs.reduce((n, l) => n + l.points.length, 0);
    expect(total).toBeLessThanOrEqual(2100);
    expect(legs[0]!.points.length).toBeGreaterThan(legs[1]!.points.length);
  });
});

describe("hand-drawn legs", () => {
  test("anchors make a path from stop to stop; a smooth anchor bends it", () => {
    const corner = pointsFromAnchors(A, B, [[34.0, 135.01]], [null]);
    const bent = pointsFromAnchors(A, B, [[34.0, 135.01]], ["auto"]);
    expect(corner[0]).toEqual([135, 34]);
    expect(corner.at(-1)).toEqual([135.01, 34.01]);
    expect(bent.length).toBeGreaterThan(2);
    expect(bent).not.toEqual(corner);
  });
  test("a hand-drawn leg ends exactly on its stops, so fitting it again to the same stops changes nothing", () => {
    const exactA = stop("a", 34.123456789, 135.987654321);
    const exactB = stop("b", 34.2345678901, 135.8765432109);
    const drawn = legFromPath(exactA, exactB, { anchors: [[34.17, 135.93]], curves: ["auto"] });
    expect(drawn.points[0]).toEqual([135.987654321, 34.123456789]);
    expect(drawn.points.at(-1)).toEqual([135.8765432109, 34.2345678901]);
    const legs = [drawn];
    expect(reconcileLegs([exactA, exactB], legs)).toBe(legs);
  });
  test("editing anchors: insert, remove, toggle and smooth-all keep anchors and curves the same length", () => {
    let p: Path = { anchors: [[34.003, 135.001], [34.006, 135.004]], curves: [null, null] };
    p = insertAnchor(p, 1, [34.004, 135.002]);
    expect(p.anchors).toHaveLength(3);
    expect(p.curves).toHaveLength(3);
    p = toggleAnchorCurve(p, 0);
    expect(p.curves[0]).toBe("auto");
    p = setAllCurves(p, true);
    expect(insertAnchor(p, 3, [34.009, 135.008]).curves.at(-1)).toBe("auto"); // a point added to an all-smooth path is smooth
    p = removeAnchors(p, new Set([1]));
    expect(p.anchors).toHaveLength(2);
    expect(p.curves).toHaveLength(2);
  });
  test("a leg without anchors is edited through a few anchors worked out from its shape", () => {
    const shape = leg(A, B, ...Array.from({ length: 200 }, (_, i): LngLatEle => [135.0001 + i * 4e-5, 34.0001 + i * 4e-5 + Math.sin(i / 10) * 1e-4]));
    const path = pathOfLeg(shape);
    expect(path.anchors.length).toBeGreaterThan(0);
    expect(path.anchors.length).toBeLessThanOrEqual(28);
    expect(path.curves).toHaveLength(path.anchors.length);
    expect(anchorsFromPoints([[135, 34], [135.01, 34.01]])).toEqual([]);
  });
});

describe("guide points", () => {
  const P = (lng: number, lat: number): [number, number] => [lng, lat];

  test("a new point goes where it adds the least walking, so the guide points stay in walking order", () => {
    // A (135, 34) to B (135.01, 34.01): the first guide point near A's end, the second near B.
    let via = insertGuidePoint(A, B, [], P(135.002, 34.002));
    via = insertGuidePoint(A, B, via, P(135.008, 34.008));
    expect(via).toEqual([P(135.002, 34.002), P(135.008, 34.008)]);
    // One put beside the first leg of the chain goes before them, one in the middle goes between, one near B at the end.
    expect(insertGuidePoint(A, B, via, P(135.0005, 34.0005))).toEqual([P(135.0005, 34.0005), ...via]);
    expect(insertGuidePoint(A, B, via, P(135.005, 34.005))).toEqual([via[0]!, P(135.005, 34.005), via[1]!]);
    expect(insertGuidePoint(A, B, via, P(135.0095, 34.0095))).toEqual([...via, P(135.0095, 34.0095)]);
  });

  test("they are rounded to about 10 cm, moved and removed by position, and asked of the router between the two stops", () => {
    const via = insertGuidePoint(A, B, [], P(135.0020000004, 34.0020000004));
    expect(via).toEqual([P(135.002, 34.002)]);
    expect(moveGuidePoint(via, 0, P(135.003, 34.003))).toEqual([P(135.003, 34.003)]);
    expect(removeGuidePoint([P(1, 1), P(2, 2), P(3, 3)], 1)).toEqual([P(1, 1), P(3, 3)]);
    expect(guideRoute(A, B, via)).toEqual([{ lat: 34, lng: 135 }, { lat: 34.002, lng: 135.002 }, { lat: 34.01, lng: 135.01 }]);
    expect(guideRoute(A, B)).toHaveLength(2);
  });

  test("a leg keeps its guide points when its stops move", () => {
    const own: Leg = { ...leg(A, B), via: [P(135.002, 34.002)] };
    const moved = reconcileLegs([stop("a", 34.0001, 135.0001), B], [own]);
    expect(moved[0]!.via).toEqual([P(135.002, 34.002)]);
  });
});

describe("return legs (a route that goes back over its own way)", () => {
  const places = [
    { key: "a", lat: 34.0, lng: 135.0, stopBy: false },
    { key: "b", lat: 34.01, lng: 135.01, stopBy: false },
    { key: "c", lat: 34.02, lng: 135.02, stopBy: false },
  ];
  const stops = pathStops(places);
  const ab: Leg = { from: "a", to: "b", points: [[135.0, 34.0], [135.01, 34.01]] };
  const bc: Leg = { from: "b", to: "c", points: [[135.01, 34.01], [135.02, 34.02]] };
  // The way back: c to b, then b to a (stops are not repeated in the list; the legs say where the line returns to).
  const cb: Leg = { from: "c", to: "b", points: [[135.02, 34.02], [135.015, 34.012], [135.01, 34.01]], back: true };
  const ba: Leg = { from: "b", to: "a", points: [[135.01, 34.01], [135.0, 34.0]], back: true };

  test("the return legs are pairs of stops in the order they were added", () => {
    expect(backPairs(stops, [ab, bc, cb, ba]).map((p) => [p.from.key, p.to.key])).toEqual([["c", "b"], ["b", "a"]]);
    expect(backPairs(stops, [ab, bc])).toEqual([]);
  });

  test("the joined line runs the route, then the way back, each leg once", () => {
    const { line } = joinLegs(stops, [ab, bc, cb, ba]);
    expect(line).toEqual([[135.0, 34.0], [135.01, 34.01], [135.02, 34.02], [135.015, 34.012], [135.01, 34.01], [135.0, 34.0]]);
  });

  test("a return leg stays while both its stops stand, and is dropped when one is removed; nothing changed keeps the same array", () => {
    const legs = [ab, bc, cb, ba];
    expect(reconcileLegs(stops, legs)).toBe(legs);
    const without = pathStops(places.filter((p) => p.key !== "a"));
    expect(reconcileLegs(without, legs).map((l) => [l.from, l.to])).toEqual([["b", "c"], ["c", "b"]]);
  });

  test("moving a stop drags the end of the return leg that meets it", () => {
    const moved = pathStops(places.map((p) => (p.key === "c" ? { ...p, lat: 34.03 } : p)));
    const kept = reconcileLegs(moved, [ab, bc, cb, ba]);
    const back = kept.find((l) => l.back && l.from === "c")!;
    expect(back.points[0]).toEqual([135.02, 34.03]);
    expect(back.back).toBe(true);
  });

  test("a joined line with elevations is handed back to every leg, return legs included", () => {
    const legs = [ab, bc, cb, ba];
    const withEle = joinLegs(stops, legs).line.map((p): LngLatEle => [p[0], p[1], 100]);
    const given = legsFromJoined(stops, legs, withEle)!;
    expect(given.find((l) => l.from === "b" && l.to === "a")!.points.every((p) => p[2] === 100)).toBe(true);
    expect(given.find((l) => l.from === "c" && l.to === "b")!.back).toBe(true);
  });

  test("where a return path can go on: from the last stop, then from where it got to, only back to earlier stops", () => {
    expect(backChoices(stops, [ab, bc])).toEqual({ end: stops[2]!, options: [stops[0]!, stops[1]!] });
    expect(backChoices(stops, [ab, bc, cb])).toEqual({ end: stops[1]!, options: [stops[0]!] });
    expect(backChoices(stops, [ab, bc, cb, ba])).toEqual({ end: stops[0]!, options: [] });
    expect(backChoices([], [])).toEqual({ end: null, options: [] });
  });

  test("a new return leg is a straight leg between the two stops, marked as a return leg", () => {
    expect(backLeg(stops[2]!, stops[1]!)).toEqual({ from: "c", to: "b", points: [[135.02, 34.02], [135.01, 34.01]], back: true });
  });

  test("every leg has its own id: a route leg by the stop it runs to, a return leg by both stops (two legs can end on the same stop)", () => {
    expect(pairId({ from: stops[0]!, to: stops[1]! })).toBe("b");
    expect(pairId({ from: stops[2]!, to: stops[1]!, back: true })).toBe("back:c:b");
    expect(pairId({ from: stops[2]!, to: stops[1]!, back: true })).not.toBe(pairId({ from: stops[0]!, to: stops[1]! }));
  });
});
