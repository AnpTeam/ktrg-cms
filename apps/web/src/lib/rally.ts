// Fixed facts about the trail and the rally (see CLAUDE.md, "Data model in words").
// Counts only: spot names and coordinates come from the admin, never from here.
export const TOTAL_STAMPS = 28; // 葛城二十八宿: the 28 sutra mounds
export const TOTAL_ROUTES = 19;
export const TRAIL_KM = 112;

/** `/ja/stamps` from ("ja", "/stamps"). Links always carry the locale prefix. */
export function localePath(locale: string, path = "") {
  return `/${locale}${path}`;
}
