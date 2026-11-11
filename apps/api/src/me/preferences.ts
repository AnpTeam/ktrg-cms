// How the app looks and behaves for one person: the accessibility and map choices of the settings
// screen and of the first-time set-up. Stored on the account (users.preferences) so they follow the
// person to a new phone; the web app also keeps a copy on the device for visitors who are not
// signed in. A full replacement each time, never a partial merge.

export const TEXT_SIZES = ["small", "standard", "large", "xlarge"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export interface Preferences {
  /** Text and components together: small 87.5%, standard 100%, large 112.5%, extra large 125% of the base size. */
  size: TextSize;
  /** No longer used: stops are never merged on the map (2026-11-11). Older apps still send it, so it is accepted and kept. */
  mergeStops?: boolean;
  /** Show the nearby places (toilets, shops ...) on the map from the start. */
  placesOnMap: boolean;
  /** The first-time set-up has been done (or skipped), so it is not offered again. */
  setupDone: boolean;
  /** Furigana over every kanji of the page. Left out = off. */
  furigana?: boolean;
  /** Stronger contrast: black on white, thicker lines. Left out = off. */
  contrast?: boolean;
  /** Calm: no animation or movement. Left out = off. */
  calm?: boolean;
  /**
   * When the person made this choice, in milliseconds since 1970, by the clock of the phone they
   * used. The phone and the account each keep a copy and the NEWER one wins, so a change that
   * could not reach the account (no signal) is not undone by the older copy there.
   */
  updatedAt: number;
}
