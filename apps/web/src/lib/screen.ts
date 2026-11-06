/** The desktop layout: a wide screen, or a phone on its side (the same rule as the `wide` variant in globals.css). */
export const WIDE_QUERY = "(min-width: 1024px), (min-width: 768px) and (max-height: 600px)";
/** A phone on its side: there is little height, and every bit of width counts. */
export const LOW_QUERY = "(max-width: 1023px) and (min-width: 768px) and (max-height: 600px)";

export function watchQuery(query: string, onChange: () => void) {
  const list = window.matchMedia(query);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}
