/**
 * Lets Vercel's edge (and the browser) keep an anonymous answer for a minute, so a script calling a public list in a loop
 * is served from the edge instead of the database. Only for answers that are the same for every visitor.
 */
export function publicCache(set: { headers: Record<string, string | number | undefined> }, seconds = 60): void {
  set.headers["cache-control"] = `public, max-age=${seconds}`;
}
