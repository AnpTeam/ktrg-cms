// Pure rules for one stop on the trail ribbon (WBS 3.2.3). No React, so they are unit-tested.

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
