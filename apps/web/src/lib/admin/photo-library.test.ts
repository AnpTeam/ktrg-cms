import { describe, expect, test } from "bun:test";
import { fileName, filterPhotos, formatSize, sortPhotos, type LibraryPhoto } from "./photo-library";

const p = (key: string, size: number, uploadedAt: string): LibraryPhoto => ({ key, url: `https://x.test/${key}`, size, uploadedAt });
const photos = [
  p("photos/kada-k3f9q2.jpg", 500_000, "2026-03-01T00:00:00Z"),
  p("photos/Shrine-10-aaaaaa.png", 2_500_000, "2026-01-01T00:00:00Z"),
  p("photos/shrine-2-bbbbbb.png", 100_000, "2026-02-01T00:00:00Z"),
  p("photos/友ヶ島-cccccc.webp", 900_000, "2026-02-01T00:00:00Z"),
];

describe("fileName", () => {
  test("drops the folder and the random ending, keeps the extension", () => {
    expect(fileName("photos/kada-k3f9q2.jpg")).toBe("kada.jpg");
    expect(fileName("photos/友ヶ島-cccccc.webp")).toBe("友ヶ島.webp");
    expect(fileName("photos/plain.jpg")).toBe("plain.jpg");
  });
});

describe("filterPhotos", () => {
  test("every word must be in the name; case and full width letters do not matter; empty keeps all", () => {
    expect(filterPhotos(photos, "shrine").map((x) => fileName(x.key))).toEqual(["Shrine-10.png", "shrine-2.png"]);
    expect(filterPhotos(photos, "ＳＨＲＩＮＥ 2").map((x) => fileName(x.key))).toEqual(["shrine-2.png"]);
    expect(filterPhotos(photos, "友ヶ島")).toHaveLength(1);
    expect(filterPhotos(photos, "  ")).toHaveLength(4);
    expect(filterPhotos(photos, "nothing")).toEqual([]);
  });
});

describe("sortPhotos", () => {
  test("by date, either way, without changing the list it was given", () => {
    const before = [...photos];
    expect(sortPhotos(photos, "date", "desc")[0]!.key).toBe("photos/kada-k3f9q2.jpg");
    expect(sortPhotos(photos, "date", "asc")[0]!.key).toBe("photos/Shrine-10-aaaaaa.png");
    expect(photos).toEqual(before);
  });
  test("by name, numbers by value (2 before 10); by size", () => {
    expect(sortPhotos(photos, "name", "asc").map((x) => fileName(x.key))).toEqual(["kada.jpg", "shrine-2.png", "Shrine-10.png", "友ヶ島.webp"]);
    expect(sortPhotos(photos, "size", "desc")[0]!.size).toBe(2_500_000);
    expect(sortPhotos(photos, "size", "asc")[0]!.size).toBe(100_000);
  });
});

test("formatSize", () => {
  expect(formatSize(100)).toBe("1 KB");
  expect(formatSize(850 * 1024)).toBe("850 KB");
  expect(formatSize(1.2 * 1024 * 1024)).toBe("1.2 MB");
});
