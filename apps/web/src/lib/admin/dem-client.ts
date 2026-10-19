import { DEM_TILE_URL } from "./dem";

/**
 * Download one elevation tile and return its RGBA pixels (256 x 256), or null when it cannot be had (no signal, a
 * tile outside the data). Browser only. The caller carries on without elevations when this returns null.
 */
export async function loadDemTile(z: number, x: number, y: number): Promise<Uint8ClampedArray | null> {
  try {
    const res = await fetch(DEM_TILE_URL(z, x, y), { mode: "cors" });
    if (!res.ok) return null;
    // No colour conversion: the colours ARE the numbers.
    const bitmap = await createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    const canvas = new OffscreenCanvas(256, 256);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, 256, 256).data;
  } catch {
    return null;
  }
}
