import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

// Client components ("use client") are shipped to every visitor's browser, together with
// everything they import. The content module imports the sample and draft data (names,
// descriptions, draft coordinates), so no browser-side file may reach it, directly or through
// other files. `import type` is erased and is fine. This follows imports all the way down.
const src = join(import.meta.dir, "..");
const forbidden = new Set(["lib/content.ts", "lib/api-content.ts", "lib/admin/admin-fetch.ts", "lib/sample-content.ts", "lib/sample-route-02.ts", "lib/sample-places.ts", "lib/sample-mounds.ts", "lib/sample-notices.ts"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/** Value imports of a file (not `import type`) that point inside src, as absolute paths. */
function valueImports(file: string): string[] {
  const out: string[] = [];
  for (const m of readFileSync(file, "utf8").matchAll(/^import\s+(?!type\s)[^;]*?from\s+"([^"]+)";?$/gm)) {
    const spec = m[1]!;
    const base = spec.startsWith("@/") ? join(src, spec.slice(2)) : spec.startsWith(".") ? join(dirname(file), spec) : null;
    if (!base) continue;
    const found = [base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx"), base].find(
      (p) => existsSync(p) && statSync(p).isFile(),
    );
    if (found) out.push(found);
  }
  return out;
}

/** The first import chain from a file to a forbidden module, or null. */
function chainToForbidden(start: string): string[] | null {
  const seen = new Set<string>();
  const walk = (file: string, chain: string[]): string[] | null => {
    const name = file.slice(src.length + 1).replace(/\\/g, "/");
    if (forbidden.has(name)) return [...chain, name];
    if (seen.has(file)) return null;
    seen.add(file);
    for (const next of valueImports(file)) {
      const found = walk(next, [...chain, name]);
      if (found) return found;
    }
    return null;
  };
  return walk(start, []);
}

describe("client boundary", () => {
  const clientFiles = files(src).filter((p) => /^\s*["']use client["']/.test(readFileSync(p, "utf8")));

  test("there are client components to check", () => {
    expect(clientFiles.length).toBeGreaterThan(3);
  });

  test("no client component can reach the content or sample modules", () => {
    const leaks = clientFiles.flatMap((file) => {
      const chain = chainToForbidden(file);
      return chain ? [chain.join(" -> ")] : [];
    });
    expect(leaks).toEqual([]);
  });
});
