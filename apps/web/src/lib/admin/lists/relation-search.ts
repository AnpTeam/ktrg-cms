/** Compares names the way a person types them: width and case do not matter (全角ＡＢＣ = abc). */
const fold = (s: string) => s.normalize("NFKC").toLowerCase();

/** The choices whose name (or second line, such as the route) contains what was typed; all of them when nothing was typed, in their own order. */
export function matchChoices<T extends { name: string; detail?: string }>(choices: readonly T[], query: string): T[] {
  const q = fold(query.trim());
  return q === "" ? [...choices] : choices.filter((c) => fold(`${c.name} ${c.detail ?? ""}`).includes(q));
}
