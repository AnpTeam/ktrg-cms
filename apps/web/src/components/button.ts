// Display (flex or inline-flex) is left to the caller, so a button keeps its place in the layout.
// One look for every visitor-side button and button-like link: a class string, so it fits <button>, <Link>, <a> and <label>.
// Corners are 8 px (rounded-lg): the design calls for nearly square corners (4 to 8 px).
const KIND = {
  /** The brand red: a button that changes something (stamp, start navigation, send, save, sign in). */
  action: "bg-brand text-on-brand",
  /** Ink: the main way onward that only goes to another page or closes something. */
  primary: "bg-ink text-paper",
  secondary: "border border-ink bg-paper text-ink hover:bg-surface",
} as const;
const SIZE = {
  lg: "min-h-14 px-6 text-xl",
  md: "px-5 text-lg",
  sm: "px-3 text-base",
} as const;

export type ButtonKind = keyof typeof KIND;
export type ButtonSize = keyof typeof SIZE;

/** The class for a button; `extra` is layout only: `flex` or `inline-flex` (required), width, margin, shadow; never colour or shape. */
export function buttonStyle(kind: ButtonKind, size: ButtonSize = "md", extra = ""): string {
  // White on the brand red is only about 3.85:1, so it is held to large bold text (see contrast.test.ts): never below text-xl.
  const sizeClass = kind === "action" ? SIZE[size].replace(/text-\w+$/, "text-xl") : SIZE[size];
  return `tap-target items-center justify-center gap-2 rounded-lg font-bold disabled:opacity-60 ${KIND[kind]} ${sizeClass} ${extra}`.trim();
}
