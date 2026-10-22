import { describe, expect, test } from "bun:test";
import { hasFastStart, sniffVideo } from "./video-file";

const box = (name: string, payload = 0) => {
  const b = new Uint8Array(8 + payload);
  new DataView(b.buffer).setUint32(0, b.length);
  b.set(new TextEncoder().encode(name), 4);
  return b;
};
const join = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((p) => [...p]));
const reader = (bytes: Uint8Array) => async (from: number, to: number) => bytes.slice(from, to);

describe("sniffVideo", () => {
  test("knows MP4 and WebM from the first bytes, nothing else", () => {
    expect(sniffVideo(join(box("ftyp", 8)))).toEqual({ type: "video/mp4" });
    expect(sniffVideo(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2]))).toEqual({ type: "video/webm" });
    expect(sniffVideo(new TextEncoder().encode("<svg xmlns='x'/>"))).toBeNull();
  });
});

describe("hasFastStart", () => {
  test("true when moov comes before mdat, false when the picture data comes first", async () => {
    const fast = join(box("ftyp", 8), box("moov", 20), box("mdat", 100));
    const slow = join(box("ftyp", 8), box("mdat", 100), box("moov", 20));
    expect(await hasFastStart(fast.length, reader(fast))).toBe(true);
    expect(await hasFastStart(slow.length, reader(slow))).toBe(false);
  });
});
