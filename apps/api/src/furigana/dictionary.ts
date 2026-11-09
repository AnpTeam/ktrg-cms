import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { hasHardKanji } from "./kyoiku-kanji";

// The dictionary side of furigana: kuromoji reads the site's published text and suggests a reading for each word with a
// kanji a grown-up may not know. Suggestions are only suggestions: they wait for a person to approve them (furigana-words.ts),
// because a dictionary cannot tell which reading a sentence needs, and it does not always know a name when it sees one.

export interface Token {
  surface_form: string;
  /** Katakana; "*" or missing when the dictionary does not know the word. */
  reading?: string;
  /** "固有名詞" for a proper noun (a temple's, a person's or a place's name). */
  pos_detail_1?: string;
}
export interface Tokenizer {
  tokenize(text: string): Token[];
}

let loading: Promise<Tokenizer> | null = null;

/** kuromoji, loaded once per server instance (about 1 to 2 seconds, from its own dictionary files). */
export function loadTokenizer(): Promise<Tokenizer> {
  loading ??= (async () => {
    // kuromoji ships no types; the name is held in a variable so the compiler does not look for them.
    const name = "kuromoji";
    const kuromoji = (await import(name)).default as { builder(o: { dicPath: string }): { build(cb: (e: Error | null, t: Tokenizer) => void): void } };
    const dicPath = join(dirname(createRequire(import.meta.url).resolve(`${name}/package.json`)), "dict");
    return new Promise<Tokenizer>((resolve, reject) => kuromoji.builder({ dicPath }).build((e, t) => (e ? reject(e) : resolve(t))));
  })().catch((err: unknown) => {
    loading = null; // try again next time
    throw err;
  });
  return loading;
}

/**
 * The words in these texts the dictionary would read, each with its katakana reading. Only words holding a kanji outside the
 * elementary-school list; never a proper noun (names are typed by a person); never a word `skip` says is handled already.
 */
export function dictionaryWords(tokenizer: Tokenizer, texts: Iterable<string>, skip: (word: string) => boolean): Map<string, string> {
  const found = new Map<string, string>();
  for (const text of new Set(texts)) {
    if (!hasHardKanji(text)) continue;
    for (const t of tokenizer.tokenize(text)) {
      const word = t.surface_form;
      if (found.has(word) || !hasHardKanji(word) || t.pos_detail_1 === "固有名詞" || !t.reading || t.reading === "*" || skip(word)) continue;
      found.set(word, t.reading);
    }
  }
  return found;
}
