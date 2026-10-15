import { elevationArea, fitPoints, linePath, type Sketch } from "@/lib/sketch";

// Two small drawings from the same simplified line. Both are decorative (the numbers
// are in the text next to them), so they are hidden from screen readers.

/** The shape of the route seen from above, in a square of `size` px (56 in the list). */
export function RouteSilhouette({ sketch, size = 56 }: { sketch: Sketch; size?: number }) {
  const pad = size / 9;
  const d = linePath(sketch.points, size, size, pad);
  if (!d) return null;
  const fitted = fitPoints(sketch.points, size, size, pad);
  const start = fitted[0];
  const end = fitted[fitted.length - 1];
  const dot = size / 16;
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0 text-accent">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={size / 19} strokeLinecap="round" strokeLinejoin="round" />
      {start ? <circle cx={start[0]} cy={start[1]} r={dot} className="fill-moss" /> : null}
      {end ? <circle cx={end[0]} cy={end[1]} r={dot} className="fill-shu" /> : null}
    </svg>
  );
}

/** The climb along the route: a filled profile, full width of the row. */
export function ElevationStrip({ elevations }: { elevations: number[] }) {
  const area = elevationArea(elevations, 300, 40, 2);
  if (!area) return null;
  return (
    <svg aria-hidden="true" viewBox="0 0 300 40" preserveAspectRatio="none" className="h-10 w-full">
      <path d={area} className="fill-moss/25 stroke-moss" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
