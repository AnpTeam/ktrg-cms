import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Readings for the kanji in a piece of Japanese text, for the "furigana" accessibility choice. A tokenizer (kuromoji, with its
// own dictionary) splits the text into words and gives each word's reading; a word's reading is then narrowed to its kanji
// (歩い → "あるい", the い stays plain). Loaded the first time it is asked for: the dictionary takes a few hundred MB.

export interface Part {
  /** The text. */
  t: string;
  /** Its reading in hiragana, over the kanji; left out for plain text. */
  r?: string;
}

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/u;
const hasKanji = (s: string) => KANJI.test(s);
const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** One word and its reading (katakana, as the dictionary gives it) -> the parts to draw. */
export function partsOfWord(surface: string, reading: string | undefined): Part[] {
  if (!reading || reading === "*" || !hasKanji(surface)) return [{ t: surface }];
  const word = [...surface];
  const read = [...toHiragana(reading)];
  // Kana at the start and end of the word that the reading repeats (お願い → お + 願 + い) stay plain.
  let start = 0;
  while (start < word.length - 1 && !hasKanji(word[start]!) && toHiragana(word[start]!) === read[start]) start++;
  let endWord = word.length;
  let endRead = read.length;
  while (endWord > start + 1 && !hasKanji(word[endWord - 1]!) && toHiragana(word[endWord - 1]!) === read[endRead - 1]) {
    endWord--;
    endRead--;
  }
  const middle = word.slice(start, endWord).join("");
  const middleReading = read.slice(start, endRead).join("");
  // Kana inside the kanji (取り扱い): one reading for the whole stretch.
  const parts: Part[] = [];
  if (start > 0) parts.push({ t: word.slice(0, start).join("") });
  parts.push(middleReading ? { t: middle, r: middleReading } : { t: middle });
  if (endWord < word.length) parts.push({ t: word.slice(endWord).join("") });
  return parts;
}

/** Words -> parts, with neighbouring plain text joined. */
export function partsOfWords(words: readonly { surface: string; reading?: string }[]): Part[] {
  const out: Part[] = [];
  for (const w of words) {
    for (const p of partsOfWord(w.surface, w.reading)) {
      const last = out.at(-1);
      if (last && !last.r && !p.r) last.t += p.t;
      else out.push({ ...p });
    }
  }
  return out;
}

export interface Tokenizer {
  tokenize(text: string): { surface_form: string; reading?: string }[];
}

let loading: Promise<Tokenizer> | null = null;

/** The real tokenizer, built once on first use. */
export function loadKuromoji(): Promise<Tokenizer> {
  loading ??= (async () => {
    // kuromoji ships no types; the name is held in a variable so the compiler does not look for them.
    const name = "kuromoji";
    const kuromoji = (await import(name)).default as {
      builder(options: { dicPath: string }): { build(done: (err: Error | null, tokenizer: Tokenizer) => void): void };
    };
    const dicPath = join(dirname(createRequire(import.meta.url).resolve(`${name}/package.json`)), "dict");
    return new Promise<Tokenizer>((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, tokenizer) => (err ? reject(err) : resolve(tokenizer)));
    });
  })();
  loading.catch(() => (loading = null)); // a failed load is tried again next time
  return loading;
}

/** Texts that need none are not sent to the tokenizer; every answer is kept (the page's texts repeat a lot). */
export function createFuriganaService(load: () => Promise<Tokenizer> = loadKuromoji, maxKept = 5000) {
  const kept = new Map<string, Part[]>();
  return {
    async readings(texts: readonly string[]): Promise<Part[][]> {
      const need = [...new Set(texts)].filter((t) => hasKanji(t) && !kept.has(t));
      if (need.length > 0) {
        const tokenizer = await load();
        for (const text of need) {
          if (kept.size >= maxKept) kept.delete(kept.keys().next().value!);
          kept.set(text, partsOfWords(tokenizer.tokenize(text).map((w) => ({ surface: w.surface_form, reading: w.reading }))));
        }
      }
      return texts.map((t) => kept.get(t) ?? [{ t }]);
    },
  };
}

export type FuriganaService = ReturnType<typeof createFuriganaService>;
