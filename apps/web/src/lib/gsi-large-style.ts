// The 「大きい文字」 map: GSI's own vector style (std.json, in MapLibre form) with the sizes and colours that were changed in
// GSI's style editor put on top. The editor saves its own file format (a tree of folders, items and layers with `draw`
// settings), not a MapLibre style, so it cannot be loaded directly. Both files describe the same layers; a layer is the same
// one when its data layer, kind, zoom range and filter are the same, and then the editor's values replace GSI's.
// Layers the editor file does not match are left as GSI draws them (reported by the build script).
// Pure functions, unit-tested; scripts/build-large-text-style.ts runs them once and writes the result.

type Json = unknown;
type Obj = Record<string, Json>;

/** A layer of GSI's MapLibre style (only the fields used here). */
export interface StdLayer {
  id: string;
  type: string;
  "source-layer"?: string;
  minzoom?: number;
  maxzoom?: number;
  filter?: Json;
  layout?: Obj;
  paint?: Obj;
  [key: string]: Json;
}

interface EditorSub {
  type: string;
  "source-layer"?: string;
  draw?: Obj;
}
interface EditorLayer {
  minzoom?: number;
  maxzoom?: number;
  filter?: Json;
  list: EditorSub[];
}
interface EditorNode {
  type: "directory" | "item";
  filter?: Json;
  list: Array<EditorNode | EditorLayer>;
}

/** Which editor setting replaces which MapLibre property, and where it lives. */
const OVERRIDES: Record<string, Array<{ from: string; to: string; in: "layout" | "paint" }>> = {
  symbol: [
    { from: "text-size", to: "text-size", in: "layout" },
    { from: "icon-size", to: "icon-size", in: "layout" },
    { from: "text-color", to: "text-color", in: "paint" },
    { from: "text-halo-width", to: "text-halo-width", in: "paint" },
  ],
  line: [
    { from: "line-width", to: "line-width", in: "paint" },
    { from: "line-color", to: "line-color", in: "paint" },
  ],
  fill: [{ from: "fill-color", to: "fill-color", in: "paint" }],
};

/** The editor writes sizes as {stops: [[zoom, value], ...]}; one stop is a plain value, more become an interpolation. */
export function modernValue(v: Json): Json {
  if (typeof v !== "object" || v === null || Array.isArray(v) || !Array.isArray((v as Obj).stops)) return v;
  const stops = (v as { stops: Array<[number, Json]> }).stops;
  if (stops.length === 0) return v;
  if (stops.length === 1) return stops[0]?.[1];
  return ["interpolate", ["linear"], ["zoom"], ...stops.flatMap(([z, value]) => [z, value])];
}

const filterParts = (f: Json): string[] => {
  if (!Array.isArray(f)) return [];
  const items = f[0] === "all" ? f.slice(1) : [f];
  return items.map((i) => JSON.stringify(i));
};

const keyOf = (sourceLayer: string | undefined, type: string, minzoom: number | undefined, maxzoom: number | undefined, filters: string[]) =>
  JSON.stringify([sourceLayer ?? null, type, minzoom ?? null, maxzoom ?? null, [...new Set(filters)].sort()]);

/** Every drawable layer of the editor file with the key that identifies it. The editor's last zoom is inclusive, MapLibre's is not. */
export function editorEntries(tree: Json): Array<{ key: string; draw: Obj }> {
  const out: Array<{ key: string; draw: Obj }> = [];
  const walk = (nodes: Array<EditorNode | EditorLayer>) => {
    for (const node of nodes as EditorNode[]) {
      if (node.type === "directory") walk(node.list);
      else if (node.type === "item") {
        for (const layer of node.list as unknown as EditorLayer[]) {
          for (const sub of layer.list) {
            if (!sub.draw) continue;
            const max = layer.maxzoom === undefined ? undefined : layer.maxzoom + 1;
            out.push({ key: keyOf(sub["source-layer"], sub.type, layer.minzoom, max, [...filterParts(layer.filter), ...filterParts(node.filter)]), draw: sub.draw });
          }
        }
      }
    }
  };
  walk((tree as { list: Array<EditorNode | EditorLayer> }).list);
  return out;
}

export interface Report {
  layers: number;
  /** Layers that took the editor's values. */
  applied: number;
  /** Layers where several GSI layers and several editor layers shared a key and could not be told apart. */
  ambiguous: number;
  /** Layers with no editor counterpart: left as GSI draws them. */
  untouched: number;
}

/** GSI's style with the editor's sizes and colours applied. Does not change its input. */
export function applyEditorStyle(std: { layers: StdLayer[] } & Obj, editor: Json): { style: typeof std; report: Report } {
  const entries = new Map<string, Obj[]>();
  for (const e of editorEntries(editor)) entries.set(e.key, [...(entries.get(e.key) ?? []), e.draw]);

  // GSI layers sharing a key are paired with the editor layers of that key in order, only when there are as many of each.
  const seen = new Map<string, number>();
  const counts = new Map<string, number>();
  const keyFor = (l: StdLayer) => keyOf(l["source-layer"], l.type, l.minzoom, l.maxzoom, filterParts(l.filter));
  for (const l of std.layers) counts.set(keyFor(l), (counts.get(keyFor(l)) ?? 0) + 1);

  const report: Report = { layers: std.layers.length, applied: 0, ambiguous: 0, untouched: 0 };
  const layers = std.layers.map((l): StdLayer => {
    const key = keyFor(l);
    const draws = entries.get(key);
    if (!draws) {
      report.untouched += 1;
      return l;
    }
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    if (draws.length !== counts.get(key)) {
      report.ambiguous += 1;
      return l;
    }
    const draw = draws[index] as Obj;
    // Same key but a different dash pattern means another layer (a dashed and a solid line of one road): never mix them.
    if (l.type === "line" && JSON.stringify(draw["line-dasharray"]) !== JSON.stringify(l.paint?.["line-dasharray"])) {
      report.ambiguous += 1;
      return l;
    }
    const next: StdLayer = { ...l, layout: { ...l.layout }, paint: { ...l.paint } };
    for (const o of OVERRIDES[l.type] ?? []) {
      if (draw[o.from] !== undefined) (next[o.in] as Obj)[o.to] = modernValue(draw[o.from]);
    }
    report.applied += 1;
    return next;
  });
  return { style: { ...std, layers }, report };
}
