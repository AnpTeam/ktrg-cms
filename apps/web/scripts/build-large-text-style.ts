// Builds src/lib/map-style/gsi-large-text.json (the 「大きい文字」 vector map) from GSI's published std.json and the sizes
// saved by GSI's style editor (map-style/gsi-large-text.source.json). Run it again after saving a new editor file:
//   bun run build:map-style
// GSI's file is fetched at a fixed commit, so the result only changes when the editor file does.
import { applyEditorStyle } from "../src/lib/gsi-large-style";

const GSI_COMMIT = "19a38c5b08f2792b841367ccc5c4faa1a4b972b0";
const std = (await (await fetch(`https://raw.githubusercontent.com/gsi-cyberjapan/gsivectortile-mapbox-gl-js/${GSI_COMMIT}/std.json`)).json()) as Parameters<typeof applyEditorStyle>[0];
const editor = await Bun.file(new URL("../map-style/gsi-large-text.source.json", import.meta.url)).json();

const { style, report } = applyEditorStyle(std, editor);
// Our own sprite and metadata are set when the style is served (app/map-style/large/route.ts); drop what is not needed.
delete (style as Record<string, unknown>).metadata;
await Bun.write(new URL("../src/lib/map-style/gsi-large-text.json", import.meta.url), JSON.stringify(style));
console.log(report);
