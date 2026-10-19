// A first guess of how long a route takes to walk, from its length and its climb. The editor offers it as a suggestion
// and the person can type their own number, as with the distance.
//
// The rule is the one Navivi uses for its narration and sidebar (apps services/tuning.py and legEstimate.ts there:
// 3 km/h on the flat, plus one hour for every 600 m climbed), so the minutes in a video and in this app agree.
// Japanese mountain guides use other constants (the standard course time of a hiking map); change the two numbers
// below if the team decides to follow one of those.

export const WALK_SPEED_KMH = 3;
export const ASCENT_M_PER_HOUR = 600;

/** The estimate in minutes, rounded to the nearest 5; null without a distance. A missing climb counts as flat. */
export function estimateWalkMinutes(distanceKm: number | null, climbM: number | null): number | null {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  const hours = distanceKm / WALK_SPEED_KMH + (climbM !== null && climbM > 0 ? climbM / ASCENT_M_PER_HOUR : 0);
  return Math.max(5, Math.round((hours * 60) / 5) * 5);
}
