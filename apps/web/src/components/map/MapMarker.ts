import type { CourseDotState, NameSide } from "@/lib/map-screen";
import type { SpotStatus } from "@/lib/content";
import type { MarkerKind } from "@/lib/map";
import type { StopRole } from "@/lib/route-stops";
import type { PointKind } from "@/lib/point-kinds";
import { pointIconSvg } from "@/lib/point-icons";
import { placePicture } from "@/lib/place-icons";
import type { PlaceCategory, PlaceGroup } from "@/lib/places";

// Everything on the map is a real <button>: it can be reached with the keyboard, has a big tap
// target and a spoken name. The look is in globals.css (.map-marker, .place-marker),
// by data attributes, so the state is a shape (seal, ring, dashed ring, amber border, barrier) and
// never colour alone.

export interface MarkerOptions {
  /** null for a side trip (寄り道): its pin carries no number. */
  order: number | null;
  /** The spoken name, for example "3. 猿坂峠, stamped". */
  label: string;
  kind: MarkerKind;
  status: SpotStatus;
  /** A side trip (寄り道): the same pin as a stop, without a start or goal colour. */
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
  if (noStamp) el.dataset.noStamp = "true";
  if (role && !sideTrip) el.dataset.role = role;
  el.dataset.status = status;
  el.appendChild(pinSvg(sideTrip ? null : order, noStamp ? "flag" : "tear", role && !sideTrip ? role : null, !!stamped, place ?? null));
  el.setAttribute("aria-label", label);
  el.setAttribute("aria-pressed", "false");
  el.addEventListener("click", onSelect);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";

// The stop pins stand on their point (the tip is the position), so a pin never covers the spot it marks.
//   tear  a stop with a stamp: a teardrop with its number
//   flag  a place without a stamp: a flag-shaped pin with its number
// The tip is a small arc, not a point, so the pin ends softly.
const TEAR = "M27 14.5a12 12 0 0 0-24 0C3 23.5 8.2 31.5 12.9 37.7a2.7 2.7 0 0 0 4.2 0C21.8 31.5 27 23.5 27 14.5Z";
const FLAG = "M6 3h18a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3h-6.5L15 33l-2.5-7H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z";

function pinSvg(order: number | null, shape: "tear" | "flag", role: StopRole | null, stamped: boolean, place: PointKind | null): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 30 40");
  svg.setAttribute("class", "map-pin-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const body = document.createElementNS(SVG_NS, "path");
  body.setAttribute("d", shape === "tear" ? TEAR : FLAG);
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
      // A stop not yet stamped has a white head with its number in the pin's colour (hollow); once stamped the head is
      // filled and the number white. Drawn always, shown by the page's CSS only for the "todo" state.
      const hollow = document.createElementNS(SVG_NS, "circle");
      hollow.setAttribute("cx", "15");
      hollow.setAttribute("cy", "14.5");
      hollow.setAttribute("r", "9.6");
      hollow.setAttribute("class", "pin-hollow");
      svg.appendChild(hollow);
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", "15");
      text.setAttribute("y", "15");
      text.setAttribute("class", "pin-text");
      text.textContent = String(order);
      svg.appendChild(text);
    }
  }
  if (stamped && !role && !place && shape === "tear") {
    // Stamped: a small white badge with a check on the upper right, so it is not the colour alone that says "done".
    const badge = document.createElementNS(SVG_NS, "g");
    badge.setAttribute("class", "pin-check");
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", "25");
    ring.setAttribute("cy", "5");
    ring.setAttribute("r", "6");
    const tick = document.createElementNS(SVG_NS, "path");
    tick.setAttribute("d", "M22 5.2l2.2 2.2 3.8-4.4");
    badge.append(ring, tick);
    svg.appendChild(badge);
  }
  if (role && stamped) {
    const seal = document.createElementNS(SVG_NS, "circle");
    seal.setAttribute("cx", "4.5");
    seal.setAttribute("cy", "5");
    seal.setAttribute("r", "4.6");
    seal.setAttribute("class", "pin-seal");
    svg.appendChild(seal);
  }
  return svg;
}

/** A place (toilet, shop ...): a small circle with its coloured picture, smaller than a stop's pin so the course stands out. */
export function createPlaceMarkerElement({
  group,
  category,
  icon,
  label,
  closed,
  photo = false,
  onSelect,
}: {
  group: PlaceGroup;
  /** What the place is: its coloured picture. */
  category: PlaceCategory;
  /** The picture chosen for it, drawn instead of its category's. */
  icon?: string | null;
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
  svg.setAttribute("width", "15");
  svg.setAttribute("height", "15");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = placePicture(category, icon); // fixed markup from lib/place-icons.ts, never the name as typed
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
 * A dashed head means the course is not ready.
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
 * A course on the whole-trail map: a round button with its number, and its name beside it once the map is close enough.
 * Its centre is the middle of the course's rectangle, unless neighbours pushed it aside (see spreadLabels).
 */
export function createCourseDot({
  number,
  name,
  nameSide,
  label,
  state,
  onSelect,
}: {
  number: string;
  /** null: only the number. */
  name: string | null;
  nameSide?: NameSide;
  label: string;
  state: CourseDotState;
  onSelect: () => void;
}): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-dot";
  el.dataset.state = state;
  const disc = document.createElement("span");
  disc.className = "map-dot-disc";
  disc.textContent = number;
  el.append(disc);
  if (name) {
    const text = document.createElement("span");
    text.className = "map-dot-name";
    text.dataset.side = nameSide ?? "right";
    text.textContent = name;
    el.append(text);
  }
  el.setAttribute("aria-label", label);
  el.addEventListener("click", onSelect);
  return el;
}
