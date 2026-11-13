import { describe, expect, test } from "bun:test";
import { photoHostsFor, withWikimedia } from "./https-url";

describe("which hosts a photo link may use", () => {
  test("PHOTO_HOSTS wins: trimmed, lower-cased, empty entries dropped", () => {
    expect(photoHostsFor({ photoHosts: " Photos.Example.com, ,cdn.example.com ", r2PublicUrl: "https://pub-1.r2.dev", production: true })).toEqual(["photos.example.com", "cdn.example.com"]);
  });

  test("in production without PHOTO_HOSTS, only the photo bucket's own host (not any website)", () => {
    expect(photoHostsFor({ r2PublicUrl: "https://pub-1.r2.dev", production: true })).toEqual(["pub-1.r2.dev"]);
    expect(withWikimedia(photoHostsFor({ r2PublicUrl: "https://photos.example.com/base", production: true }))).toEqual(["photos.example.com", "upload.wikimedia.org"]);
  });

  test("outside production, or with no bucket either, it stays open (the startup warns about the second case)", () => {
    expect(photoHostsFor({ r2PublicUrl: "https://pub-1.r2.dev", production: false })).toEqual([]);
    expect(photoHostsFor({ production: true })).toEqual([]);
    expect(photoHostsFor({ production: false })).toEqual([]);
  });
});
