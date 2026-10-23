// Furigana for a name, one reading for each stretch of kanji. Stored as text in the existing reading field:
// "葛城{かつらぎ}修験{しゅげん}" (the reading follows the kanji it belongs to). A reading without any "{" is the old kind,
// one reading for the whole name. Pure, so it is tested without a browser.

export interface RubyPart {
  text: string;
  /** null where nothing is written over it. */
  reading: string | null;
}

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/u;
export const isKanji = (ch: string) => KANJI.test(ch);

/** The name cut into runs: each run of kanji alone (so it can carry a reading), the rest between them. */
export function runsOf(name: string): RubyPart[] {
  const parts: RubyPart[] = [];
  for (const ch of name) {
    const last = parts.at(-1);
    if (last && isKanji(last.text.at(-1)!) === isKanji(ch)) last.text += ch;
    else parts.push({ text: ch, reading: null });
  }
  return parts;
}

/** Whether the reading is written per kanji (with braces) rather than for the whole name. */
export const isPerKanji = (markup: string) => markup.includes("{");

/** The parts of a marked-up name, or null when the text is not in that form. */
export function parseRuby(markup: string): RubyPart[] | null {
  if (!isPerKanji(markup)) return null;
  const parts: RubyPart[] = [];
  const re = /([^{}]*?)\{([^{}]*)\}|([^{}]+)$/gy;
  let m: RegExpExecArray | null;
  let used = 0;
  while ((m = re.exec(markup)) && m[0] !== "") {
    used = re.lastIndex;
    if (m[3] !== undefined) parts.push({ text: m[3], reading: null });
    else {
      // Text before the braces is plain except for the kanji run just in front of them.
      const before = m[1]!;
      const run = [...before].reverse();
      let n = 0;
      while (n < run.length && isKanji(run[n]!)) n++;
      const chars = [...before];
      const plain = chars.slice(0, chars.length - n).join("");
      const kanji = chars.slice(chars.length - n).join("");
      if (plain) parts.push({ text: plain, reading: null });
      if (kanji) parts.push({ text: kanji, reading: m[2]!.trim() || null });
      else if (m[2]) parts.push({ text: "", reading: null });
    }
  }
  return used === markup.length ? parts.filter((p) => p.text !== "") : null;
}

/**
 * The marked-up text for these parts; "" when no part has a reading and the split is the default one. A kanji with no reading
 * yet keeps empty braces, so a split made by hand (a run cut into single kanji) is not lost before anything is typed.
 */
export function serializeRuby(parts: readonly RubyPart[]): string {
  const text = textOfRuby(parts);
  const sameSplit = runsOf(text).map((p) => p.text).join("|") === parts.map((p) => p.text).join("|");
  if (sameSplit && !parts.some((p) => p.reading)) return "";
  return parts.map((p) => (p.reading ? `${p.text}{${p.reading.replace(/[{}]/g, "")}}` : isKanji(p.text[0] ?? "") ? `${p.text}{}` : p.text)).join("");
}

/** The name the parts spell. */
export const textOfRuby = (parts: readonly RubyPart[]) => parts.map((p) => p.text).join("");

/** The parts to show or edit for this name and stored reading: per-kanji ones when they spell this very name, else fresh runs. */
export function partsFor(name: string, stored: string): RubyPart[] {
  const parsed = parseRuby(stored);
  if (parsed && textOfRuby(parsed) === name) {
    // Keep the saved split, and make sure every run of kanji is there to type a reading for.
    return parsed;
  }
  return runsOf(name);
}
