import { describe, expect, test } from "bun:test";
import { parseVideoFile, parseVideoUrl, subtitleUrl } from "./video";

describe("parseVideoUrl", () => {
  test("accepts the usual YouTube forms and embeds them without cookies", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      const v = parseVideoUrl(url);
      expect(v?.provider).toBe("youtube");
      expect(v?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    }
  });

  test("accepts Vimeo", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")?.embedUrl).toBe("https://player.vimeo.com/video/123456789");
    expect(parseVideoUrl("https://player.vimeo.com/video/123456789")?.id).toBe("123456789");
  });

  test("rejects other hosts, look-alike hosts, plain http and junk", () => {
    for (const url of [
      "https://example.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=short",
      "https://vimeo.com/about",
      "javascript:alert(1)",
      "not a url",
      "",
    ]) {
      expect(parseVideoUrl(url)).toBeNull();
    }
    expect(parseVideoUrl(undefined)).toBeNull();
  });
});

describe("parseVideoFile", () => {
  test("accepts https links to .mp4 and .webm files only", () => {
    expect(parseVideoFile("https://photos.example.com/videos/walk-abc234.mp4")?.src).toBe("https://photos.example.com/videos/walk-abc234.mp4");
    expect(parseVideoFile("https://photos.example.com/v.WEBM")).not.toBeNull();
    for (const bad of ["http://photos.example.com/v.mp4", "https://photos.example.com/v.mov", "https://youtu.be/dQw4w9WgXcQ", "", null, "nope"]) {
      expect(parseVideoFile(bad)).toBeNull();
    }
  });
});

describe("subtitle address", () => {
  const video = { src: "https://pub.example.dev/videos/walk-ab12.mp4" };
  test("sits beside the video; a version is added so replaced subtitles are fetched again", () => {
    expect(subtitleUrl(video)).toBe("https://pub.example.dev/videos/walk-ab12.vtt");
    expect(subtitleUrl(video, "2026-10-28T02:00:00.000Z")).toBe("https://pub.example.dev/videos/walk-ab12.vtt?v=2026-10-28T02%3A00%3A00.000Z");
    expect(subtitleUrl(video, null)).toBe("https://pub.example.dev/videos/walk-ab12.vtt");
  });
});
