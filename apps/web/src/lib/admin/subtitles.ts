// Subtitles: browsers read WebVTT in a <track>, not SubRip (.srt). An .srt is turned into WebVTT here before it is uploaded.
// Pure, so it is tested without a browser.

export const MAX_SUBTITLE_BYTES = 1024 * 1024;

/**
 * The WebVTT text for a subtitle file (.srt or .vtt), or null when it is not subtitles at all. SubRip becomes WebVTT by
 * adding the "WEBVTT" line and writing the milliseconds with a dot (00:00:01,500 → 00:00:01.500); cue numbers stay (WebVTT allows them).
 */
export function toVtt(text: string): string | null {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!/-->/.test(clean)) return null;
  if (/^WEBVTT/.test(clean)) return `${clean}\n`;
  const body = clean.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body}\n`;
}
