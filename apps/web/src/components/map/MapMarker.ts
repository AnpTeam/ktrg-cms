import type { SpotStatus } from "@/lib/content";
import type { MarkerKind } from "@/lib/map";
import { placeIconPaths, type PlaceGroup } from "@/lib/places";

// Everything on the map is a real <button>: it can be reached with the keyboard, has a big tap
// target and a spoken name. The look is in globals.css (.map-marker, .place-marker, .map-cluster),
// by data attributes, so the state is a shape (seal, ring, dashed ring, amber border, barrier) and
// never colour alone.

export interface MarkerOptions {
  order: number;
  /** The spoken name, for example "3. 猿坂峠, stamped". */
  label: string;
  kind: MarkerKind;
  status: SpotStatus;
  onSelect: () => void;
}

export function createMarkerElement({ order, label, kind, status, onSelect }: MarkerOptions): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-marker";
  el.dataset.kind = kind;
  el.dataset.status = status;
  el.textContent = String(order);
  el.setAttribute("aria-label", label);
  el.setAttribute("aria-pressed", "false");
  el.addEventListener("click", onSelect);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** A place (toilet, shop ...): a rounded square with the group's picture, so it never looks like a numbered stop. */
export function createPlaceMarkerElement({
  group,
  label,
  closed,
  onSelect,
}: {
  group: PlaceGroup;
  label: string;
  /** Closed or gone: a diagonal bar over the picture. */
  closed: boolean;
  onSelect: () => void;
}): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "place-marker";
  el.dataset.group = group;
  if (closed) el.dataset.closed = "true";
  el.setAttribute("aria-label", label);
  el.setAttribute("aria-pressed", "false");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of placeIconPaths[group]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  el.appendChild(svg);
  el.addEventListener("click", onSelect);
  return el;
}

/**
 * A course on the map: a pin whose point is the middle of the course's rectangle, with the course number in its
 * head and, once the map is zoomed in far enough, its name beside it. Japanese names run top to bottom (as on the
 * official map, and they take far less width that way); other languages wrap onto a few short lines. A dashed
 * head means the course is not ready.
 */
export function createPinElement({
  number,
  name,
  vertical,
  label,
  soon,
  onSelect,
}: {
  number: string;
  /** null while the map is zoomed out: only the number is shown. */
  name: string | null;
  vertical: boolean;
  label: string;
  soon: boolean;
  onSelect: () => void;
}): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-pin";
  if (soon) el.dataset.soon = "true";
  const head = document.createElement("span");
  head.className = "map-pin-head";
  head.textContent = number;
  el.appendChild(head);
  if (name) {
    const text = document.createElement("span");
    text.className = "map-pin-name";
    text.dataset.vertical = String(vertical);
    text.textContent = name;
    el.appendChild(text);
  }
  el.setAttribute("aria-label", label);
  el.addEventListener("click", onSelect);
  return el;
}

/** Several markers too close to tell apart at this zoom: one button showing what is inside; a tap zooms in. */
export function createClusterElement({
  text,
  label,
  kind,
  onSelect,
}: {
  text: string;
  label: string;
  kind: "stops" | "places";
  onSelect: () => void;
}): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-cluster";
  el.dataset.kind = kind;
  el.textContent = text;
  el.setAttribute("aria-label", label);
  el.addEventListener("click", onSelect);
  return el;
}
