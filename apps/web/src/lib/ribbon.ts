// Pure rules for one stop on the trail ribbon (WBS 3.2.3). No React, so they are unit-tested.
// Types only from content: the Lingui macro in the components cannot load under `bun test` in CI.
import type { RouteSummary } from "@/lib/content";

export type Kind = "done" | "open" | "soon";

export type NodeState =
  | "soon" // the route has no published spots yet (準備中)
  | "neutral" // signed out, or nothing personal to show
  | "notStarted"
  | "inProgress"
  | "complete";

export interface NodeInput {
  status: "ready" | "soon";
  /** Stamps the visitor holds on this route; null when signed out. */
  stamped: number | null;
  /** Stamp spots on this route (published waypoints). */
  total: number;
}

export function nodeState({ status, stamped, total }: NodeInput): NodeState {
  if (status === "soon" || total === 0) return "soon";
  if (stamped === null) return "neutral";
  if (stamped >= total) return "complete";
  return stamped > 0 ? "inProgress" : "notStarted";
}

/** 0..1 share for the progress arc; 0 when there is nothing to measure. */
export function progressShare(stamped: number | null, total: number): number {
  if (stamped === null || total <= 0) return 0;
  return Math.min(1, Math.max(0, stamped / total));
}

/**
 * How each connector between two stops is drawn. A connector leads into the stop at `index`
 * (index 0 has none). It is "done" when the stop before it is complete, otherwise "open".
 * Signed-out stops are never complete, so their connectors are always open.
 */
export function connectorStates(states: readonly NodeState[]): ("done" | "open")[] {
  return states.map((_, i) => (i > 0 && states[i - 1] === "complete" ? "done" : "open"));
}

/** Routes completed, for the header line ("3 of 19"). null when signed out. */
export function completedCount(states: readonly NodeState[], signedIn: boolean): number | null {
  return signedIn ? states.filter((s) => s === "complete").length : null;
}

export interface Stop {
  route: RouteSummary;
  state: NodeState;
  above: Kind | null;
  below: Kind | null;
}

export function buildStops(routes: RouteSummary[]): Stop[] {
  const states = routes.map((route) => nodeState({ status: route.status, stamped: route.stampedCount, total: route.spotCount }));
  const connectors = connectorStates(states);
  // A jump in the numbers (the home page lists only open courses: 1, then 16) is dashed like a course not ready yet,
  // so the line never claims two courses meet when others lie between them.
  const gap = (i: number) => (routes[i]?.order ?? 0) - (routes[i - 1]?.order ?? 0) > 1;
  const into = (i: number): Kind | null => (i === 0 ? null : states[i] === "soon" || gap(i) ? "soon" : connectors[i] === "done" ? "done" : "open");
  return routes.map((route, i) => ({
    route,
    state: states[i] as NodeState,
    above: into(i),
    below: i === routes.length - 1 ? null : into(i + 1),
  }));
}
