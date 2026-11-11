import { describe, expect, test } from "bun:test";
import { pinPhotoSrc } from "./pin-photo";

describe("pinPhotoSrc: which photo a map pin may draw", () => {
  test("a stop's own https photo is drawn", () => {
    expect(pinPhotoSrc({ src: "https://pub-1234.r2.dev/spots/a.jpg", alt: "" })).toBe("https://pub-1234.r2.dev/spots/a.jpg");
  });

  test("one of our own files (a root-relative path) is drawn", () => {
    expect(pinPhotoSrc({ src: "/home/top_slider_img01.jpg", alt: "" })).toBe("/home/top_slider_img01.jpg");
  });

  test("no photo, an empty one or blanks give no photo: the pin keeps its number head", () => {
    expect(pinPhotoSrc(null)).toBeNull();
    expect(pinPhotoSrc(undefined)).toBeNull();
    expect(pinPhotoSrc({ src: "", alt: "" })).toBeNull();
    expect(pinPhotoSrc({ src: "   ", alt: "" })).toBeNull();
  });

  test("anything that is not https or one of our paths is never put into the pin", () => {
    for (const src of ["javascript:alert(1)", "data:image/svg+xml,<svg/>", "http://example.com/a.jpg", "//evil.example/a.jpg", "ftp://x/a.jpg"]) {
      expect(pinPhotoSrc({ src, alt: "" })).toBeNull();
    }
  });
});
