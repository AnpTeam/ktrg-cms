import { parseRuby } from "./ruby";

// Our own list of readings for the words furigana is drawn over (furigana-words.json): the word as it is written, and its
// reading in the marked-up form of lib/ruby.ts ("葛城{かつらぎ}"). Only words with a kanji outside the elementary-school list
// are in it (see kyoiku-kanji.ts); everything else is left plain. The list is made by apps/api/scripts/build-furigana-words.ts
// and corrected by hand: the script never overwrites an entry that is already there.

export type WordList = Readonly<Record<string, string>>;
export interface Part {
  t: string;
  r?: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A function that cuts a text into parts, the listed words carrying their readings (the longest word wins). */
export function wordMatcher(words: WordList): (text: string) => Part[] {
  const keys = Object.keys(words).sort((a, b) => b.length - a.length);
  const pattern = keys.length > 0 ? new RegExp(keys.map(escapeRegExp).join("|"), "gu") : null;
  return (text) => {
    if (!pattern) return [{ t: text }];
    const parts: Part[] = [];
    let last = 0;
    for (const m of text.matchAll(pattern)) {
      if (m.index > last) parts.push({ t: text.slice(last, m.index) });
      const ruby = parseRuby(words[m[0]]!);
      if (ruby) for (const p of ruby) parts.push(p.reading ? { t: p.text, r: p.reading } : { t: p.text });
      else parts.push({ t: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ t: text.slice(last) });
    return parts;
  };
}
