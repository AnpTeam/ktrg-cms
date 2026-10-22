// How a route is walked, as an admin picks it (the API holds the same three values: routes.walk_style).
//   one_way       from the start to a different goal
//   loop          ends where it began (周回)
//   out_and_back  to a turnaround and back the same way (往復)
// Not set (null) means nobody has said, and the page then claims nothing beyond what the places show.

export const walkStyles = ["one_way", "loop", "out_and_back"] as const;
export type WalkStyle = (typeof walkStyles)[number];

export const walkStyleOf = (v: unknown): WalkStyle | null => (typeof v === "string" && (walkStyles as readonly string[]).includes(v) ? (v as WalkStyle) : null);
