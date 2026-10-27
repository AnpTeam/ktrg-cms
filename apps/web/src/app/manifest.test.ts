import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import manifest from "./manifest";

describe("web app manifest", () => {
  const icons = manifest().icons ?? [];

  test("has what Chrome needs to offer Install: a 192 px and a 512 px PNG, and a maskable one", () => {
    const has = (sizes: string, purpose: string) => icons.some((i) => i.sizes === sizes && i.type === "image/png" && (i.purpose ?? "any") === purpose);
    expect(has("192x192", "any")).toBe(true);
    expect(has("512x512", "any")).toBe(true);
    expect(has("512x512", "maskable")).toBe(true);
  });

  test("every icon it names is a file the site serves (public/ or the app's own icon files)", () => {
    for (const icon of icons) {
      const name = icon.src.replace(/^\//, "");
      expect(existsSync(join(import.meta.dir, "../../public", name)) || existsSync(join(import.meta.dir, name))).toBe(true);
    }
  });
});
