// Checks on a video file before it is sent to the storage (the API only signs an address; it never sees the bytes).

/** The longest video file the API will sign for (the same number as the API's MAX_VIDEO_BYTES). */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export type VideoKind = { type: "video/mp4" | "video/webm" };

/** What the file really is, from its first bytes: MP4 has "ftyp" at byte 4, WebM starts with the EBML mark. Null for anything else. */
export function sniffVideo(head: Uint8Array): VideoKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (head.length >= 12 && ascii(4, 8) === "ftyp") return { type: "video/mp4" };
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return { type: "video/webm" };
  return null;
}

/**
 * Whether an MP4's index ("moov") comes before its picture data ("mdat"): "fast start". Without it a phone cannot begin
 * to play until the end of the file has been fetched. Walks the top-level boxes, reading a few bytes at a time.
 * `read(from, to)` gives those bytes. Unreadable or odd files answer true (no warning rather than a wrong one).
 */
export async function hasFastStart(size: number, read: (from: number, to: number) => Promise<Uint8Array>): Promise<boolean> {
  let offset = 0;
  for (let i = 0; i < 32 && offset + 8 <= size; i++) {
    const head = await read(offset, offset + 16);
    if (head.length < 8) return true;
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let boxSize = view.getUint32(0);
    const name = String.fromCharCode(...head.subarray(4, 8));
    if (name === "moov") return true;
    if (name === "mdat") return false;
    if (boxSize === 1) {
      if (head.length < 16) return true;
      boxSize = Number(view.getBigUint64(8));
    }
    if (boxSize < 8) return true;
    offset += boxSize;
  }
  return true;
}
