import { describe, expect, test } from "bun:test";
import { addPhoto, fromList, makeMain, MAX_PHOTOS, movePhoto, patchPhoto, removePhoto, toList, type ListPhoto } from "./photo-list";

const p = (n: string, over: Partial<ListPhoto> = {}): ListPhoto => ({ url: `https://photos.example.com/${n}.jpg`, credit: null, sourceUrl: null, ...over });
const place = { photoUrl: "https://photos.example.com/a.jpg", photoCredit: "Taro", photoSourceUrl: "https://commons.example.org/a", photos: [p("b"), p("c")] };

describe("the photos of a waypoint as one list (the first is the main photo)", () => {
  test("the main photo comes first, then the gallery; an empty main photo is not an item", () => {
    expect(toList(place).map((x) => x.url.slice(-5))).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(toList(place)[0]).toEqual({ url: place.photoUrl, credit: "Taro", sourceUrl: "https://commons.example.org/a" });
    expect(toList({ photoUrl: "", photoCredit: "", photoSourceUrl: "", photos: [p("b")] })).toEqual([p("b")]);
  });
  test("saving a list gives back the same fields", () => {
    expect(fromList(toList(place))).toEqual(place);
    expect(fromList([])).toEqual({ photoUrl: "", photoCredit: "", photoSourceUrl: "", photos: [] });
  });
  test("a main photo that is also in the gallery is listed once", () => {
    expect(toList({ ...place, photos: [p("a"), p("b")] }).map((x) => x.url.slice(-5))).toEqual(["a.jpg", "b.jpg"]);
  });
  test("a new photo goes to the end, and becomes the main one when there is none; the same photo twice is ignored", () => {
    expect(addPhoto([], p("a")).map((x) => x.url.slice(-5))).toEqual(["a.jpg"]);
    expect(addPhoto(toList(place), p("d")).at(-1)).toEqual(p("d"));
    expect(addPhoto(toList(place), p("b"))).toHaveLength(3);
  });
  test("no more than the limit", () => {
    const full = Array.from({ length: MAX_PHOTOS }, (_, i) => p(String(i)));
    expect(addPhoto(full, p("x"))).toHaveLength(MAX_PHOTOS);
  });
  test("making a photo the main one puts it first; the old main photo follows it", () => {
    const list = makeMain(toList(place), 2);
    expect(list.map((x) => x.url.slice(-5))).toEqual(["c.jpg", "a.jpg", "b.jpg"]);
    expect(fromList(list).photoUrl.endsWith("c.jpg")).toBe(true);
  });
  test("moving up or down swaps neighbours; moving the first up, or the last down, does nothing; moving to the top makes it the main photo", () => {
    const list = toList(place);
    expect(movePhoto(list, 0, -1)).toEqual(list);
    expect(movePhoto(list, 2, 1)).toEqual(list);
    expect(movePhoto(list, 1, -1).map((x) => x.url.slice(-5))).toEqual(["b.jpg", "a.jpg", "c.jpg"]);
  });
  test("removing the main photo promotes the next one; the credit goes with its photo", () => {
    const after = fromList(removePhoto(toList(place), 0));
    expect(after).toMatchObject({ photoUrl: "https://photos.example.com/b.jpg", photoCredit: "", photos: [p("c")] });
  });
  test("a credit or source is changed on its own photo only; empty text becomes none", () => {
    const list = patchPhoto(toList(place), 1, { credit: "Hanako", sourceUrl: "https://commons.example.org/b" });
    expect(list[1]).toMatchObject({ credit: "Hanako", sourceUrl: "https://commons.example.org/b" });
    expect(list[0]!.credit).toBe("Taro");
    expect(patchPhoto(list, 1, { credit: "  " })[1]!.credit).toBeNull();
  });
});
