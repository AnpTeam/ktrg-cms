import { describe, expect, test } from "bun:test";
import { toVtt } from "./subtitles";

describe("toVtt", () => {
  test("SubRip gets the header and dotted milliseconds", () => {
    const srt = "﻿1\r\n00:00:01,500 --> 00:00:03,000\r\nこんにちは\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,250\r\nHello, world\r\n";
    expect(toVtt(srt)).toBe("WEBVTT\n\n1\n00:00:01.500 --> 00:00:03.000\nこんにちは\n\n2\n00:00:04.000 --> 00:00:05.250\nHello, world\n");
  });
  test("a comma in the words is left alone", () => {
    expect(toVtt("1\n00:00:01,000 --> 00:00:02,000\n1,234 people")).toContain("1,234 people");
  });
  test("WebVTT is kept as it is; text that is not subtitles is refused", () => {
    expect(toVtt("WEBVTT\n\n00:01.000 --> 00:02.000\nHi")).toBe("WEBVTT\n\n00:01.000 --> 00:02.000\nHi\n");
    expect(toVtt("just some words")).toBeNull();
  });
});
