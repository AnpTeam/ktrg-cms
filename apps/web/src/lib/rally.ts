// Fixed facts about the trail and the rally (see CLAUDE.md, "Data model in words").
// Counts only: spot names and coordinates come from the admin, never from here.
export const TOTAL_STAMPS = 31; // the 31 sutra mound places (経塚): numbers 1 to 28 of 葛城二十八宿, with 3, 14 and 28 at two places each
/** The mounds of 葛城二十八宿 are numbered 1 to 28; these have two stamp places each (the others have one). */
export const TOTAL_MOUNDS = 28;
export const DOUBLE_MOUNDS: readonly number[] = [3, 14, 28];
/** The places of each mound in order (1 or 2): what the landing draws one seal for each of, grouped by mound. */
export const MOUND_PLACES: readonly number[] = Array.from({ length: TOTAL_MOUNDS }, (_, i) => (DOUBLE_MOUNDS.includes(i + 1) ? 2 : 1));
export const TOTAL_ROUTES = 19;
export const TRAIL_KM = 112;
