// Adds readings to src/lib/furigana-words.json for every word that holds a kanji outside the elementary-school list
// (the words furigana is drawn over). It reads the Japanese texts of the app (src/locales/ja.po) and, with --api, the
// published content of a running site, asks the kuromoji dictionary how each word is read, and ADDS what is missing:
// an entry already in the file (a reading fixed by hand) is never changed. Look through the new entries before committing.
//   bun scripts/build-furigana-words.ts [--api http://localhost:3001]...
// kuromoji is only used here; the site itself reads the finished list and loads no dictionary.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
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
  const listFile = `${root}/src/lib/furigana-words.json`;
  const words: Record<string, string> = JSON.parse(readFileSync(listFile, "utf8"));

  const po = readFileSync(`${root}/src/locales/ja.po`, "utf8");
  const texts = [...po.matchAll(/^msgid "(.+)"$/gm)].map((m) => m[1]!.replace(/\\"/g, '"'));
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) if (args[i] === "--api") texts.push(...(await apiTexts(args[++i]!)));

  // kuromoji ships no types; the name is held in a variable so the compiler does not look for them.
  const name = "kuromoji";
  const kuromoji = (await import(name)).default as { builder(o: { dicPath: string }): { build(cb: (e: Error | null, t: Tokenizer) => void): void } };
  const dicPath = join(dirname(createRequire(import.meta.url).resolve(`${name}/package.json`)), "dict");
  const tokenizer = await new Promise<Tokenizer>((resolve, reject) => kuromoji.builder({ dicPath }).build((e, t) => (e ? reject(e) : resolve(t))));

  let added = 0;
  const skipped: string[] = [];
  for (const text of new Set(texts)) {
    if (!hasHardKanji(text)) continue;
    for (const t of tokenizer.tokenize(text)) {
      if (t.surface_form in words || !hasHardKanji(t.surface_form)) continue;
      const markup = markupFor(t.surface_form, t.reading);
      if (markup) {
        words[t.surface_form] = markup;
        added++;
      } else skipped.push(t.surface_form);
    }
  }
  const sorted = Object.fromEntries(Object.entries(words).sort(([a], [b]) => a.localeCompare(b, "ja")));
  writeFileSync(listFile, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`${added} words added (${Object.keys(sorted).length} in all).`);
  if (skipped.length > 0) console.log(`No reading could be lined up for: ${[...new Set(skipped)].join("、")}. Add them by hand.`);
}
