// Grouping markers that would sit on top of each other. Done in screen pixels, at the current zoom:
// zoom in and a group falls apart, zoom out and neighbours join. Pure, so it is unit-tested.

export interface PixelPoint {
  id: string;
  x: number;
  y: number;
}

/**
 * Greedy grouping: each point joins the first group whose first member is within `minDistance`
 * pixels, otherwise it starts a new group. The result keeps the input order (groups by their
 * first member, ids inside a group in input order), and a chain A-B-C where only neighbours are
 * close does not become one group, so the same zoom always gives the same groups.
 */
export function clusterByPixels(points: readonly PixelPoint[], minDistance: number): string[][] {
  const groups: { head: PixelPoint; ids: string[] }[] = [];
  for (const p of points) {
    const home = groups.find((g) => Math.hypot(g.head.x - p.x, g.head.y - p.y) < minDistance);
    if (home) home.ids.push(p.id);
    else groups.push({ head: p, ids: [p.id] });
  }
  return groups.map((g) => g.ids);
}
