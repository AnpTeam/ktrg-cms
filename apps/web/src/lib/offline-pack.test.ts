import { afterEach, beforeEach, expect, test } from "bun:test";
import { clearSavedPages, deletePack, megabytes, packAge, packTileUrls, readPack, savePack } from "./offline-pack";

const area = { lat: 34.45, lng: 135.65, widthM: 4000, heightM: 4000, verified: true };

// A Cache Storage in memory: just enough of caches / Cache for the pack.
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    const s = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, s);
    return { put: async (u: string, r: Response) => void s.set(u, r), match: async (u: string) => s.get(u)?.clone(), delete: async (u: string) => s.delete(u) };
  };
  return { stores, caches: { open, keys: async () => [...stores.keys()], has: async (n: string) => stores.has(n), delete: async (n: string) => stores.delete(n) } };
}

const realFetch = globalThis.fetch;
let fake: ReturnType<typeof fakeCaches>;
beforeEach(() => {
  fake = fakeCaches();
  (globalThis as { caches?: unknown }).caches = fake.caches;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as { caches?: unknown }).caches;
});

test("the tile list holds the base map and the overlay, each within its own zoom range", () => {
  const urls = packTileUrls(area, { base: "pale", terrain: "relief" });
  expect(urls.some((u) => u.includes("/pale/11/"))).toBe(true);
  expect(urls.some((u) => u.includes("/relief/15/"))).toBe(true);
  expect(packTileUrls(area, { base: "blank", terrain: "hillshade" }).some((u) => u.includes("/blank/15/"))).toBe(false);
  expect(packTileUrls(area, { base: "photo", terrain: "hillshade" }).some((u) => u.includes("/seamlessphoto/") && u.endsWith(".jpg"))).toBe(true);
});

// Pages answer with a body, tiles with bytes; the course answers with a line.
const site = (u: string) =>
  u === "/api/v1/routes/r1" ? new Response(JSON.stringify({ route: { line: { coordinates: [[1, 2]] }, spots: ["private"] } })) : new Response("x".repeat(1000));

test("the pages and the line are kept with the pack, the line without the rest of the course", async () => {
  globalThis.fetch = (async (u: string) => site(u)) as unknown as typeof fetch;
  await savePack("r1", ["u/1"], () => {});
  expect([...(fake.stores.get("ktrg-pages")?.keys() ?? [])].sort()).toEqual(["/map", "/routes/r1"]);
  const line = await fake.stores.get("ktrg-pack-r1")?.get("/api/v1/routes/r1")?.json();
  expect(line).toEqual({ route: { line: { coordinates: [[1, 2]] } } });
});

test("deleting the last pack takes the map page too, and signing out empties the saved pages", async () => {
  globalThis.fetch = (async (u: string) => site(u)) as unknown as typeof fetch;
  await savePack("r1", ["u/1"], () => {});
  await savePack("r2", ["u/1"], () => {});
  await deletePack("r1");
  expect([...(fake.stores.get("ktrg-pages")?.keys() ?? [])].sort()).toEqual(["/map", "/routes/r2"]);
  await deletePack("r2");
  expect([...(fake.stores.get("ktrg-pages")?.keys() ?? [])]).toEqual([]);
  await savePack("r2", ["u/1"], () => {});
  await clearSavedPages();
  expect(fake.stores.has("ktrg-pages")).toBe(false);
});

test("a page that cannot be fetched fails the whole pack", async () => {
  globalThis.fetch = (async (u: string) => (u === "/map" ? new Response("", { status: 500 }) : site(u))) as unknown as typeof fetch;
  await expect(savePack("r1", ["u/1"], () => {})).rejects.toThrow();
  expect(fake.stores.has("ktrg-pack-r1")).toBe(false);
});

test("a saved pack is described, and deleting it removes everything", async () => {
  globalThis.fetch = (async () => new Response("x".repeat(1000))) as unknown as typeof fetch;
  const seen: number[] = [];
  const info = await savePack("r1", ["u/1", "u/2", "u/3", "u/4"], (d) => seen.push(d), 5000);
  expect(info).toEqual({ savedAt: 5000, bytes: 4000, tiles: 4 });
  expect(seen.length).toBe(4);
  expect(await readPack("r1")).toEqual(info);
  expect(await readPack("r2")).toBeNull();
  await deletePack("r1");
  expect(await readPack("r1")).toBeNull();
});

test("a download where most tiles failed is not kept as saved", async () => {
  globalThis.fetch = (async (u: string) => (u.endsWith("1") ? new Response("x") : new Response("", { status: 404 }))) as unknown as typeof fetch;
  await expect(savePack("r1", ["u/1", "u/2", "u/3", "u/4"], () => {})).rejects.toThrow();
  expect(fake.stores.has("ktrg-pack-r1")).toBe(false);
});

test("age and size read plainly", () => {
  const now = 10 * 24 * 3600_000;
  expect(packAge(now - 30_000, now)).toEqual({ n: 0, unit: "minute" });
  expect(packAge(now - 5 * 3600_000, now)).toEqual({ n: 5, unit: "hour" });
  expect(packAge(now - 3 * 24 * 3600_000, now)).toEqual({ n: 3, unit: "day" });
  expect(megabytes(800_000)).toBe("0.8");
  expect(megabytes(100)).toBe("0.1");
  expect(megabytes(12_400_000)).toBe("12");
});
