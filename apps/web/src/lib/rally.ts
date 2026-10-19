// Fixed facts about the trail and the rally (see CLAUDE.md, "Data model in words").
// Counts only: spot names and coordinates come from the admin, never from here.
export const TOTAL_STAMPS = 31; // the 31 sutra mound places (経塚): numbers 1 to 28 of 葛城二十八宿, with 3, 14 and 28 at two places each
export const TOTAL_ROUTES = 19;
export const TRAIL_KM = 112;

/** `/ja/stamps` from ("ja", "/stamps"). Links always carry the locale prefix. */
export function localePath(locale: string, path = "") {
  return `/${locale}${path}`;
}
