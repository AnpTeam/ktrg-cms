import type { SpotStatus } from "@/lib/content";
import type { MarkerKind } from "@/lib/map";
import { placeIconPaths, type PlaceGroup } from "@/lib/places";

// Everything on the map is a real <button>: it can be reached with the keyboard, has a big tap
// target and a spoken name. The look is in globals.css (.map-marker, .place-marker, .map-cluster),
// by data attributes, so the state is a shape (seal, ring, dashed ring, amber border, barrier) and
// never colour alone.

export interface MarkerOptions {
  /** null for a side trip (寄り道): its pin carries no number. */
  order: number | null;
  /** The spoken name, for example "3. 猿坂峠, stamped". */
  label: string;
  kind: MarkerKind;
  status: SpotStatus;
  /** A side trip (寄り道): smaller, with a dashed ring. */
  sideTrip?: boolean;
  /** A place where no stamp can be collected: a square pin instead of a round one. */
  noStamp?: boolean;
  onSelect: () => void;
}

export function createMarkerElement({ order, label, kind, status, sideTrip, noStamp, onSelect }: MarkerOptions): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-marker";
  el.dataset.kind = kind;
  if (sideTrip) el.dataset.side = "true";
  if (noStamp) el.dataset.noStamp = "true";
  el.dataset.status = status;
  el.appendChild(pinSvg(order, sideTrip ? "dot" : noStamp ? "flag" : "tear"));
  el.setAttribute("aria-label", label);
  el.setAttribute("aria-pressed", "false");
  el.addEventListener("click", onSelect);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";

// The stop pins stand on their point (the tip is the position), so a pin never covers the spot it marks.
//   tear  a stop with a stamp: a teardrop with its number
//   flag  a place without a stamp: a flag-shaped pin with its number
//   dot   a side trip (寄り道): a small dashed ring, no number
const TEAR = "M15 39C15 39 3 25.5 3 14.5a12 12 0 0 1 24 0C27 25.5 15 39 15 39Z";
const FLAG = "M6 3h18a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3h-6.5L15 33l-2.5-7H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z";

function pinSvg(order: number | null, shape: "tear" | "flag" | "dot"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", shape === "dot" ? "0 0 20 20" : "0 0 30 40");
  svg.setAttribute("class", "map-pin-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  let body: SVGElement;
  if (shape === "dot") {
    body = document.createElementNS(SVG_NS, "circle");
    body.setAttribute("cx", "10");
    body.setAttribute("cy", "10");
    body.setAttribute("r", "8");
  } else {
    body = document.createElementNS(SVG_NS, "path");
    body.setAttribute("d", shape === "tear" ? TEAR : FLAG);
  }
  body.setAttribute("class", "pin-shape");
  svg.appendChild(body);
  if (shape !== "dot") {
    // Closed: a bar across the head (drawn only for that state, by the page's own CSS).
    const bar = document.createElementNS(SVG_NS, "line");
    bar.setAttribute("x1", "8");
    bar.setAttribute("y1", "7");
    bar.setAttribute("x2", "22");
    bar.setAttribute("y2", "21");
    bar.setAttribute("class", "pin-bar");
    svg.appendChild(bar);
    if (order !== null) {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", "15");
      text.setAttribute("y", "15");
      text.setAttribute("class", "pin-text");
      text.textContent = String(order);
      svg.appendChild(text);
    }
  }
  return svg;
}

/** A place (toilet, shop ...): a rounded square with the group's picture, so it never looks like a numbered stop. */
export function createPlaceMarkerElement({
  group,
  label,
  closed,
  photo = false,
  onSelect,
}: {
  group: PlaceGroup;
  label: string;
  /** Closed or gone: a diagonal bar over the picture. */
  closed: boolean;
  /** The place has a photo: a small camera in the corner says a popup with it opens. */
  photo?: boolean;
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
  if (photo) {
    el.dataset.photo = "true";
    const badge = document.createElement("span");
    badge.className = "place-photo";
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.2"/></svg>';
    el.appendChild(badge);
  }
  el.addEventListener("click", onSelect);
  return el;
}

/**
 * A course on the map in a language that is written sideways: a pin whose point is the middle of the course's
 * rectangle, with the course number in its head and, where there is room, its name beside it on a few short lines.
 * A dashed head means the course is not ready. (Japanese uses the narrower top-to-bottom tag below.)
 */
export function createPinElement({
  number,
  name,
  label,
  soon,
  onSelect,
}: {
  number: string;
  /** null where there is no room: only the number is shown. */
  name: string | null;
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
    text.textContent = name;
    el.appendChild(text);
  }
  el.setAttribute("aria-label", label);
  el.addEventListener("click", onSelect);
  return el;
}

/**
 * A course on the map in Japanese: a name tag read top to bottom (as on the official map) standing on the middle of
 * the course's rectangle, with the course number in a round head above it. It is narrow, so all the courses can
 * show their names together even when the whole trail is in view. A dashed head means the course is not ready.
 */
export function createTagElement({
  number,
  name,
  label,
  soon,
  onSelect,
}: {
  number: string;
  name: string;
  label: string;
  soon: boolean;
  onSelect: () => void;
}): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-tag";
  if (soon) el.dataset.soon = "true";
  const head = document.createElement("span");
  head.className = "map-tag-head";
  head.textContent = number;
  const text = document.createElement("span");
  text.className = "map-tag-name";
  text.textContent = name;
  el.append(head, text);
  el.setAttribute("aria-label", label);
  el.addEventListener("click", onSelect);
  return el;
}

/** Several markers too close to tell apart at this zoom: one button showing what is inside; a tap zooms in. */
export function createClusterElement({
  text,
  label,
  kind,
  names,
  onSelect,
}: {
  text: string;
  label: string;
  kind: "stops" | "places";
  /** When given, the group also lists who is inside (a line each, then "+n more"), so no course name is ever hidden. */
  names?: { lines: string[]; more: string | null };
  onSelect: () => void;
}): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-cluster";
  el.dataset.kind = kind;
  if (names) {
    el.dataset.named = "true";
    const count = document.createElement("span");
    count.className = "map-cluster-count";
    count.textContent = text;
    const list = document.createElement("span");
    list.className = "map-cluster-names";
    for (const line of [...names.lines, ...(names.more ? [names.more] : [])]) {
      const row = document.createElement("span");
      row.textContent = line;
      list.appendChild(row);
    }
    el.append(count, list);
  } else el.textContent = text;
  el.setAttribute("aria-label", label);
  el.addEventListener("click", onSelect);
  return el;
}
