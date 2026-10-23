import type { PointKind } from "./point-kinds";

/**
 * A small line drawing for each kind of waypoint (24 x 24 grid, stroked): the map's pins carry it in a badge on their
 * corner, so what a place is can be read before it is opened. Plain shapes that stay readable at about 9 px.
 */
export const pointIconPaths: Record<PointKind, string[]> = {
  // A torii gate.
  temple: ["M3 6.5c4 1.6 14 1.6 18 0", "M5.5 10.5h13", "M7.5 10.5V20", "M16.5 10.5V20"],
  // A mound with a stone marker on top.
  mound: ["M3 20h18", "M6 20a6 6 0 0 1 12 0", "M12 14V8", "M9.5 8h5"],
  // A mountain.
  view: ["M2.5 20 9 8.5l4 6.5 2.5-3.5L21.5 20z"],
  turn: ["M7 20V10a3 3 0 0 1 3-3h7", "M14 3.5 17.5 7 14 10.5"],
  danger: ["M12 4 21 20H3z", "M12 10v4.5", "M12 17.6v.01"],
  // Two standing figures.
  toilet: ["M12 3v18", "M7.5 4.2a1.3 1.3 0 1 0 .01 0", "M5 9h5v5.5H5z", "M7.5 14.5V20", "M16.5 4.2a1.3 1.3 0 1 0 .01 0", "M14.5 9h4l1 11h-6z"],
  // A bench.
  rest_area: ["M4 11h16", "M5 7h14", "M6 11v8", "M18 11v8"],
  // A drop.
  drinking_water: ["M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"],
  vending_machine: ["M7 4h10v16H7z", "M10 8h4", "M10 12h4", "M9.5 17h5"],
  // A bus-stop sign on its pole.
  bus_stop: ["M12 21V11", "M6.5 3h11A1.5 1.5 0 0 1 19 4.5V11H5V4.5A1.5 1.5 0 0 1 6.5 3z", "M8.5 7h7"],
  // A train.
  station: ["M7 3h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2z", "M5 10h14", "M9 21l2-3", "M15 21l-2-3"],
  // The letter P.
  parking: ["M9 20V5h4.5a3.2 3.2 0 0 1 0 6.4H9"],
  // A map pin.
  other: ["M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z", "M12 9.5a1.5 1.5 0 1 0 .01 0"],
};
