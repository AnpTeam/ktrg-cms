// Finds the words that have a kanji outside the elementary-school list and are not in the site's furigana list yet, asks the
// kuromoji dictionary how each is read, and prints SQL that adds them (nothing is written anywhere by this script). It reads the
// Japanese texts of the app (src/locales/ja.po) and the published content of a running site (--api), and skips every word
// the site already has. Look the guesses over, fix any wrong reading in the SQL or later in the admin (ふりがな), then run it.
//   bun scripts/build-furigana-words.ts --api https://the-site.example > new-words.sql
// kuromoji is only used here; the site itself loads no dictionary.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { hasHardKanji } from "../src/lib/kyoiku-kanji";
import { isKanji } from "../src/lib/ruby";

interface Tokenizer {
  tokenize(text: string): { surface_form: string; reading?: string }[];
}

const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/**
 * One word and its reading (katakana, as the dictionary gives it) as marked-up text: the reading follows the kanji it
 * belongs to ("取{と}り扱{あつか}い"). null when the kana inside the word cannot be lined up with the reading.
 */
export function markupFor(surface: string, reading: string | undefined): string | null {
  if (!reading || reading === "*" || !hasHardKanji(surface)) return null;
  const read = toHiragana(reading);
  const segments: { text: string; kanji: boolean }[] = [];
  for (const ch of surface) {
    const last = segments.at(-1);
    if (last && last.kanji === isKanji(ch)) last.text += ch;
    else segments.push({ text: ch, kanji: isKanji(ch) });
  }
  let pos = 0;
  let out = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.kanji) {
      const next = segments[i + 1];
      // The reading of a kanji run ends where the kana after it starts (the last run takes what is left).
      let end = read.length;
      if (next) {
        const kana = toHiragana(next.text);
        end = i + 1 === segments.length - 1 ? read.length - kana.length : read.indexOf(kana, pos + 1);
        if (end < pos + 1 || read.slice(end, end + kana.length) !== kana) return null;
      }
      out += `${seg.text}{${read.slice(pos, end)}}`;
      pos = end;
    } else {
      const kana = toHiragana(seg.text);
      if (read.slice(pos, pos + kana.length) !== kana) return null;
      out += seg.text;
      pos += kana.length;
    }
  }
  return pos === read.length ? out : null;
}

/** Every string anywhere in a JSON answer. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
  return out;
}

async function apiTexts(origin: string): Promise<string[]> {
  const get = async (path: string) => (await fetch(`${origin}/api/v1${path}`)).json().catch(() => null) as Promise<{ routes?: { id: string }[] } | null>;
  const texts: string[] = [];
  for (const path of ["/routes", "/places", "/notices", "/banners", "/rallies", "/settings"]) texts.push(...strings(await get(path)));
  const routes = (await get("/routes"))?.routes ?? [];
  for (const r of routes) texts.push(...strings(await get(`/routes/${r.id}`)));
  return texts.flatMap((t) => t.split(/[\n\r]+/)).filter((t) => !/^https?:\/\//.test(t));
}

if (import.meta.main) {
  const root = import.meta.dir + "/..";
  const po = readFileSync(`${root}/src/locales/ja.po`, "utf8");
  const texts = [...po.matchAll(/^msgid "(.+)"$/gm)].map((m) => m[1]!.replace(/\\"/g, '"'));
  const known = new Set<string>();
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== "--api") continue;
    const origin = args[++i]!;
    texts.push(...(await apiTexts(origin)));
    const listed = (await (await fetch(`${origin}/api/v1/furigana/words`)).json().catch(() => null)) as { words?: Record<string, string> } | null;
    for (const w of Object.keys(listed?.words ?? {})) known.add(w);
  }

  // kuromoji ships no types; the name is held in a variable so the compiler does not look for them.
  const name = "kuromoji";
  const kuromoji = (await import(name)).default as { builder(o: { dicPath: string }): { build(cb: (e: Error | null, t: Tokenizer) => void): void } };
  const dicPath = join(dirname(createRequire(import.meta.url).resolve(`${name}/package.json`)), "dict");
  const tokenizer = await new Promise<Tokenizer>((resolve, reject) => kuromoji.builder({ dicPath }).build((e, t) => (e ? reject(e) : resolve(t))));

  const found = new Map<string, string>();
  const skipped = new Set<string>();
  for (const text of new Set(texts)) {
    if (!hasHardKanji(text)) continue;
    for (const t of tokenizer.tokenize(text)) {
      if (known.has(t.surface_form) || found.has(t.surface_form) || !hasHardKanji(t.surface_form)) continue;
      const markup = markupFor(t.surface_form, t.reading);
      if (markup) found.set(t.surface_form, markup);
      else skipped.add(t.surface_form);
    }
  }
  const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
  const rows = [...found].sort(([a], [b]) => a.localeCompare(b, "ja")).map(([w, r]) => `  (${q(w)}, ${q(r)})`);
  if (rows.length > 0) console.log(`INSERT INTO "furigana_words" ("word", "reading") VALUES\n${rows.join(",\n")}\nON CONFLICT ("word") DO NOTHING;`);
  console.error(`${found.size} new words.`);
  if (skipped.size > 0) console.error(`No reading could be lined up for: ${[...skipped].join("、")}. Add them in the admin by hand.`);
}
