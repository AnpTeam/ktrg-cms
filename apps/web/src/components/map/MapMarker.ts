import type { SpotStatus } from "@/lib/content";
import type { MarkerKind } from "@/lib/map";

// A stop on the map is a real <button>: it can be reached with the keyboard, has a 3rem tap
// target and a spoken name. The look is in globals.css (.map-marker), by data attributes, so the
// state is a shape (seal, ring, dashed ring, amber border, barrier) and never colour alone.

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
