import { describe, expect, test } from "bun:test";
import { parseVideoUrl } from "./video";

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
