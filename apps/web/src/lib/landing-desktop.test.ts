import { describe, expect, test } from "bun:test";
import { DESK_QUERY, DESK_SCROLL_SVH, PHONE_SCROLL_SVH, RIDGE_ROOM_PX, SCENE_QUERY, beatsFit, panelPhotos } from "./landing-desktop";

const course = (order: number, status: "ready" | "soon", photoUrl: string | null, photoCredit?: string | null) => ({ order, status, photoUrl, photoCredit });
const FALLBACK = "/home/top_slider_img01.jpg";

describe("the desktop gate", () => {
  test("the scene and the desk are told apart by their queries; a phone on its side is never a desk", () => {
    expect(SCENE_QUERY).toBe("(prefers-reduced-motion: no-preference) and (min-height: 38rem)");
    expect(DESK_QUERY).toBe("(min-width: 1024px) and (min-height: 38rem)");
    expect(DESK_QUERY).not.toContain("max-height");
    expect(DESK_SCROLL_SVH).toBe(300);
    expect(PHONE_SCROLL_SVH).toBe(250);
    expect(RIDGE_ROOM_PX).toBe(96);
  });
});

describe("panelPhotos", () => {
  test("takes courses that have a photo, published first, then by order, two by default", () => {
    const routes = [course(3, "soon", "/c3.jpg"), course(2, "ready", "/c2.jpg", "© two"), course(1, "ready", null), course(5, "ready", "/c5.jpg")];
    expect(panelPhotos(routes, null, FALLBACK)).toEqual([
      { src: "/c2.jpg", credit: "© two" },
      { src: "/c5.jpg", credit: null },
    ]);
  });
  test("is filled from the banner photo, then the fallback, so it always has the wanted count and no empty source", () => {
    expect(panelPhotos([course(1, "ready", "/c1.jpg")], "/banner.jpg", FALLBACK)).toEqual([
      { src: "/c1.jpg", credit: null },
      { src: "/banner.jpg", credit: null },
    ]);
    expect(panelPhotos([], null, FALLBACK)).toEqual([
      { src: FALLBACK, credit: null },
      { src: FALLBACK, credit: null },
    ]);
    expect(panelPhotos([], "", FALLBACK).every((p) => p.src !== "")).toBe(true);
  });
  test("skips a repeated source and leaves the input as it was", () => {
    const routes = [course(1, "ready", "/same.jpg"), course(2, "ready", "/same.jpg"), course(3, "ready", "/other.jpg")];
    const copy = JSON.stringify(routes);
    expect(panelPhotos(routes, null, FALLBACK).map((p) => p.src)).toEqual(["/same.jpg", "/other.jpg"]);
    expect(JSON.stringify(routes)).toBe(copy);
  });
});

describe("beatsFit", () => {
  test("every beat must be no taller than the stage", () => {
    expect(beatsFit([600, 700], 800)).toBe(true);
    expect(beatsFit([600, 801], 800)).toBe(false);
    expect(beatsFit([], 800)).toBe(true);
  });
  test("a height or stage that is not a number does not fit", () => {
    expect(beatsFit([Number.NaN], 800)).toBe(false);
    expect(beatsFit([600], Number.NaN)).toBe(false);
  });
});
