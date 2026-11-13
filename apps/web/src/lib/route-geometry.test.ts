import { describe, expect, test } from "bun:test";
import { areaFromBounds, boundsFromBox, boundsOfPoints, boxFromBounds, dragCorner, moveBox, padBounds } from "./route-geometry";

describe("a course area as a box and as corners", () => {
  const bounds = { west: 135.0, south: 34.2, east: 135.3, north: 34.4 };

  test("the centre, width and height (metres) and the corners (degrees) describe the same box", () => {
    const box = boxFromBounds(bounds);
    expect(box.lat).toBeCloseTo(34.3, 6);
    expect(box.lng).toBeCloseTo(135.15, 6);
    expect(box.heightM).toBeCloseTo(0.2 * 110_574, 0);
    expect(box.widthM).toBeGreaterThan(27_000); // 0.3 degrees of longitude at 34 degrees north is about 27.6 km
    expect(box.widthM).toBeLessThan(28_500);
    const back = boundsFromBox(box);
    for (const k of ["west", "south", "east", "north"] as const) expect(back[k]).toBeCloseTo(bounds[k], 5);
  });

  test("the overview map draws the editor's corners as they are (a course is never drawn smaller than the minimum)", () => {
    const area = areaFromBounds(bounds)!;
    expect(area.lat).toBeCloseTo(34.3, 6);
    expect(area.heightM).toBeCloseTo(0.2 * 110_574, 0);
    expect(areaFromBounds({ west: 135, south: 34, east: 135.001, north: 34.001 })!.widthM).toBe(1500);
  });
});

describe("editing a course area on the map", () => {
  const b = { west: 135.0, south: 34.2, east: 135.3, north: 34.4 };

  test("dragging a corner moves that corner and keeps the opposite one where it is", () => {
    expect(dragCorner(b, "nw", { lat: 34.5, lng: 134.9 })).toEqual({ west: 134.9, south: 34.2, east: 135.3, north: 34.5 });
    expect(dragCorner(b, "se", { lat: 34.1, lng: 135.4 })).toEqual({ west: 135.0, south: 34.1, east: 135.4, north: 34.4 });
  });

  test("a corner dragged past the opposite one stops just short of it, so the box never turns inside out or vanishes", () => {
    const g = dragCorner(b, "nw", { lat: 34.0, lng: 136.0 });
    expect(g.west).toBeLessThan(g.east);
    expect(g.south).toBeLessThan(g.north);
    expect(g.east).toBe(135.3);
    expect(g.south).toBe(34.2);
  });

  test("moving the box keeps its size and puts its centre where it is dropped", () => {
    const m = moveBox(b, { lat: 34.5, lng: 135.5 });
    expect(m.east - m.west).toBeCloseTo(0.3, 6);
    expect(m.north - m.south).toBeCloseTo(0.2, 6);
    expect((m.west + m.east) / 2).toBeCloseTo(135.5, 6);
    expect((m.south + m.north) / 2).toBeCloseTo(34.5, 6);
  });

  test("the box around some points, grown by a margin, is never smaller than the minimum; no points, no box", () => {
    expect(boundsOfPoints([])).toBeNull();
    const around = boundsOfPoints([[135.0, 34.0], [135.2, 34.1]])!;
    expect(around).toEqual({ west: 135.0, south: 34.0, east: 135.2, north: 34.1 });
    const grown = padBounds(around)!;
    expect(grown.west).toBeLessThan(135.0);
    expect(grown.north).toBeGreaterThan(34.1);
    const tiny = padBounds({ west: 135, south: 34, east: 135, north: 34 })!;
    expect(tiny.east - tiny.west).toBeGreaterThan(0.01);
  });
});
