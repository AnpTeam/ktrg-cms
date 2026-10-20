import { describe, expect, test } from "bun:test";
import { readHits, searchUrl } from "./place-search";

describe("place search", () => {
  test("asks Nominatim for places in Japan, in Japanese, with the words encoded", () => {
    const url = new URL(searchUrl(" 西念寺 和歌山 "));
    expect(url.hostname).toBe("nominatim.openstreetmap.org");
    expect(url.searchParams.get("countrycodes")).toBe("jp");
    expect(url.searchParams.get("q")).toBe("西念寺 和歌山");
  });

  test("keeps the hits with a name and a position, and nothing else", () => {
    expect(readHits([{ display_name: "西念寺", lat: "34.259", lon: "135.108" }, { display_name: "x", lat: "?", lon: "1" }, { lat: "1", lon: "2" }])).toEqual([{ name: "西念寺", lat: 34.259, lng: 135.108 }]);
    expect(readHits({ error: "rate limited" })).toEqual([]);
  });
});
