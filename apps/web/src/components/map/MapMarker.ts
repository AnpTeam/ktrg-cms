import type { SpotStatus } from "@/lib/content";
import type { MarkerKind } from "@/lib/map";
import type { StopRole } from "@/lib/route-stops";
import type { PointKind } from "@/lib/point-kinds";
import { pointIconSvg } from "@/lib/point-icons";
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
  /** Where the walk starts or ends: blue for the start, orange for the goal, both colours for one place that is both. */
  role?: StopRole;
  /** Stamped already: a pin that has a role colour shows it with a small seal on the corner (the colour is the role's). */
  stamped?: boolean;
  /** What the place is (a station, a toilet ...): drawn as a small picture on the pin's corner. */
  place?: PointKind;
  onSelect: () => void;
}

export function createMarkerElement({ order, label, kind, status, sideTrip, noStamp, role, stamped, place, onSelect }: MarkerOptions): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-marker";
  el.dataset.kind = kind;
  if (sideTrip) el.dataset.side = "true";
  if (noStamp) el.dataset.noStamp = "true";
  if (role && !sideTrip) el.dataset.role = role;
  el.dataset.status = status;
  el.appendChild(pinSvg(order, sideTrip ? "dot" : noStamp ? "flag" : "tear", role && !sideTrip ? role : null, !!stamped, sideTrip ? null : place ?? null));
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
// The tip is a small arc, not a point, so the pin ends softly.
const TEAR = "M27 14.5a12 12 0 0 0-24 0C3 23.5 8.2 31.5 12.9 37.7a2.7 2.7 0 0 0 4.2 0C21.8 31.5 27 23.5 27 14.5Z";
const FLAG = "M6 3h18a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3h-6.5L15 33l-2.5-7H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z";

function pinSvg(order: number | null, shape: "tear" | "flag" | "dot", role: StopRole | null, stamped: boolean, place: PointKind | null): SVGSVGElement {
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
  if (role === "both") {
    // One place that is the start and the goal: blue fading into orange, top to bottom (the colours of the Start / Goal
    // badge). Every pin draws the same gradient under the same id, so a repeated id is harmless.
    const defs = document.createElementNS(SVG_NS, "defs");
    const grad = document.createElementNS(SVG_NS, "linearGradient");
    grad.setAttribute("id", "pin-start-goal");
    grad.setAttribute("x1", "0");
    grad.setAttribute("y1", "0");
    grad.setAttribute("x2", "0");
    grad.setAttribute("y2", "1");
    for (const [offset, cssVar] of [["0.25", "--color-ruri"], ["0.75", "--color-goal"]] as const) {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", `var(${cssVar})`);
      grad.appendChild(stop);
    }
    defs.appendChild(grad);
    svg.appendChild(defs);
  }
  svg.appendChild(body);
  if (shape !== "dot") {
    if (place) {
      // The kind of place as a coloured picture on a white disc in the head, with the number in a chip on the upper right.
      const disc = document.createElementNS(SVG_NS, "circle");
      disc.setAttribute("cx", "15");
      disc.setAttribute("cy", "14.5");
      disc.setAttribute("r", "9.2");
      disc.setAttribute("class", "pin-disc");
      svg.appendChild(disc);
      const icon = document.createElementNS(SVG_NS, "g");
      icon.setAttribute("transform", "translate(7.4 6.9) scale(0.62)");
      icon.innerHTML = pointIconSvg[place];
      svg.appendChild(icon);
    }
    // Closed: a bar across the head (drawn only for that state, by the page's own CSS).
    const bar = document.createElementNS(SVG_NS, "line");
    bar.setAttribute("x1", "8");
    bar.setAttribute("y1", "7");
    bar.setAttribute("x2", "22");
    bar.setAttribute("y2", "21");
    bar.setAttribute("class", "pin-bar");
    svg.appendChild(bar);
    if (order !== null) {
      if (place) {
        const chip = document.createElementNS(SVG_NS, "g");
        chip.setAttribute("class", "pin-chip");
        const ring = document.createElementNS(SVG_NS, "circle");
        ring.setAttribute("cx", "25.5");
        ring.setAttribute("cy", "4.5");
        ring.setAttribute("r", "6.3");
        const num = document.createElementNS(SVG_NS, "text");
        num.setAttribute("x", "25.5");
        num.setAttribute("y", "5");
        if (String(order).length > 1) num.setAttribute("font-size", "7.4");
        num.textContent = String(order);
        chip.append(ring, num);
        svg.appendChild(chip);
      } else {
        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("x", "15");
        text.setAttribute("y", "15");
        text.setAttribute("class", "pin-text");
        text.textContent = String(order);
        svg.appendChild(text);
      }
    }
  }
  if (role && stamped && shape !== "dot") {
    const seal = document.createElementNS(SVG_NS, "circle");
    seal.setAttribute("cx", "4.5");
    seal.setAttribute("cy", "5");
    seal.setAttribute("r", "4.6");
    seal.setAttribute("class", "pin-seal");
    svg.appendChild(seal);
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
