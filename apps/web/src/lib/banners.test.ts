import { expect, test } from "bun:test";
import { slidesToShow, type BannerSlide } from "./banners";

const photo: BannerSlide = { src: "/banners/01.jpg", altJa: "山", altEn: "Mountain" };

test("real slides are shown as they are", () => {
  expect(slidesToShow([photo], false)).toEqual([photo]);
  expect(slidesToShow([photo], true)).toEqual([photo]);
});

test("with no photos: nothing in production, placeholders only while previewing sample content", () => {
  expect(slidesToShow([], false)).toEqual([]);
  expect(slidesToShow([], true)).toHaveLength(3);
  expect(slidesToShow([], true).every((s) => s.src === null)).toBe(true);
});
