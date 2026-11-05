// Builds src/lib/map-style/gsi-large-text.entries.json: the small version of the GSI style-editor file that is the site's
// default 「大きい文字」 adjustments (map-style/gsi-large-text.source.json). Run it after saving a new editor file:
//   bun run build:map-style
// An admin can also upload a file in 管理 > サイト全体の設定; that one is kept in the database and wins over this default.
// src/lib/map-style/gsi-std.json is GSI's published style (gsivectortile-mapbox-gl-js, std.json, commit 19a38c5b); the
// adjustments are laid over it when the style is served (app/map-style/large/route.ts).
import { applyEntries, compactEntries, type StdLayer } from "../src/lib/gsi-large-style";

const editor = await Bun.file(new URL("../map-style/gsi-large-text.source.json", import.meta.url)).json();
const std = (await Bun.file(new URL("../src/lib/map-style/gsi-std.json", import.meta.url)).json()) as { layers: StdLayer[] };
const entries = compactEntries(editor);
await Bun.write(new URL("../src/lib/map-style/gsi-large-text.entries.json", import.meta.url), JSON.stringify(entries));
console.log(applyEntries(std, entries).report, `${entries.length} entries`);
