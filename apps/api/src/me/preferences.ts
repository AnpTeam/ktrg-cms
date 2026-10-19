// How the app looks and behaves for one person: the accessibility and map choices of the settings
// screen and of the first-time set-up. Stored on the account (users.preferences) so they follow the
// person to a new phone; the web app also keeps a copy on the device for visitors who are not
// signed in. A full replacement each time, never a partial merge.

export const TEXT_SIZES = ["standard", "large", "xlarge"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export interface Preferences {
  /** Text and components together: standard 100%, large 112.5%, extra large 125% of the base size. */
  size: TextSize;
  /** Merge stops that sit close together on the map into one numbered group. Off is the plain map. */
  mergeStops: boolean;
  /** Show the nearby places (toilets, shops ...) on the map from the start. */
  placesOnMap: boolean;
  /** The first-time set-up has been done (or skipped), so it is not offered again. */
  setupDone: boolean;
  /**
   * When the person made this choice, in milliseconds since 1970, by the clock of the phone they
   * used. The phone and the account each keep a copy and the NEWER one wins, so a change that
   * could not reach the account (no signal) is not undone by the older copy there.
   */
  updatedAt: number;
}
