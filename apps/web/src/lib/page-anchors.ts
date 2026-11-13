// Ids that a server component writes and a client component looks up. A constant exported from a "use client" file is a
// reference when a server component imports it, not the string, so these live in a plain module.

/** The bookmark button under a course's numbers: the phone's sticky bar shows its own bookmark icon once this one scrolls out of sight. */
export const BOOKMARK_ANCHOR = "route-bookmark";
