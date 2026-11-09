import { publicCache } from "../lib/public-cache";
import { Elysia, t, type Static } from "elysia";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import type { ListDef } from "../admin-lists/list-routes";
import { createListService } from "../admin-lists/list-service";
import { bad, ok, type ListRow, type ListRules, type ListStore } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import type { KitServices } from "../auth/route-kit";

/**
 * The readings furigana is drawn from: a word as it is written and its reading. Visitors who turn furigana on get every
 * word here, and the page draws the reading over the word wherever the word is found. Made and corrected in the admin.
 *
 * The reading is typed either as plain hiragana for the whole word ("かつらぎ") or, where the kana cannot be lined up
 * on their own, with each reading after the kanji it belongs to ("取{と}り扱{あつか}い"). It is kept in the second form.
 */
export const FURIGANA_FIELDS = {
  word: t.String({ minLength: 1, maxLength: 40 }),
  reading: t.String({ minLength: 1, maxLength: 120 }),
};

const furiganaFields = t.Object(FURIGANA_FIELDS);
export type FuriganaFields = Static<typeof furiganaFields>;
export type FuriganaRow = ListRow & FuriganaFields;

export interface FuriganaStore extends ListStore<FuriganaRow, FuriganaFields> {
  /** Every word and its marked-up reading. */
  all(): Promise<{ word: string; reading: string }[]>;
  findByWord(word: string): Promise<FuriganaRow | null>;
}

export const FURIGANA_AUDIT = { create: "furigana.create", update: "furigana.update", delete: "furigana.delete" } as const;

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/u;
const isKanji = (ch: string) => KANJI.test(ch);
const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/**
 * Plain hiragana for a whole word -> the marked-up form ("取{と}り扱{あつか}い"), or null when the kana inside the word cannot
 * be lined up with the reading (then the person types it with braces).
 */
export function alignReading(word: string, hiragana: string): string | null {
  const read = toHiragana(hiragana);
  const segments: { text: string; kanji: boolean }[] = [];
  for (const ch of word) {
    const last = segments.at(-1);
    if (last && last.kanji === isKanji(ch)) last.text += ch;
    else segments.push({ text: ch, kanji: isKanji(ch) });
  }
  if (!segments.some((s) => s.kanji)) return null;
  let pos = 0;
  let out = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.kanji) {
      const next = segments[i + 1];
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

/** The marked-up reading checked against the word: taking the braces away must give the word, and no reading is empty. */
const validMarkup = (word: string, markup: string) => markup.replace(/\{[^{}]*\}/g, "") === word && !/\{\s*\}/.test(markup) && !/[{}]/.test(markup.replace(/\{[^{}]*\}/g, ""));

/** The word has no spaces; the reading is made into the marked-up form, or refused. A word may be in the list once. */
export const furiganaRules = (store: Pick<FuriganaStore, "findByWord">): ListRules<FuriganaFields> => async (fields, mode) => {
  const out = { ...fields };
  if (out.word !== undefined) {
    out.word = out.word.trim();
    if (out.word === "" || /\s/.test(out.word) || !isKanjiIn(out.word)) return bad("validation_failed");
    if (mode === "create" && (await store.findByWord(out.word))) return bad("conflict");
  }
  if (out.reading !== undefined) {
    out.reading = out.reading.trim();
    const word = out.word;
    if (out.reading === "" || word === undefined) return bad("validation_failed");
    if (out.reading.includes("{")) {
      if (!validMarkup(word, out.reading)) return bad("validation_failed");
    } else {
      const aligned = alignReading(word, out.reading);
      if (!aligned) return bad("validation_failed");
      out.reading = aligned;
    }
  }
  return ok(out);
};
const isKanjiIn = (word: string) => [...word].some(isKanji);

export type FuriganaService = ReturnType<typeof createFuriganaService>;

type Named = { nameJa: string; nameKana?: string | null };

/** The readings people typed with course names and with published waypoint and place names (a draft's name never shows). */
export async function nameReadings(
  content: { listRoutes(): Promise<Named[]>; listPublishedSpots(): Promise<Named[]> },
  places: { listPublic(): Promise<Named[]> },
): Promise<{ word: string; reading: string }[]> {
  const [routes, spots, listed] = await Promise.all([content.listRoutes(), content.listPublishedSpots(), places.listPublic()]);
  return [...routes, ...spots, ...listed].flatMap((r) => (r.nameKana ? [{ word: r.nameJa, reading: r.nameKana }] : []));
}

export function createFuriganaService(deps: { store: FuriganaStore; names?: () => Promise<{ word: string; reading: string }[]> }) {
  return {
    ...createListService({ store: deps.store, rules: furiganaRules(deps.store) }),
    /**
     * What the page needs: every word with its reading. The readings typed with a course's, waypoint's or place's own name
     * come first (each in the marked-up form; a reading that does not fit its name is left out); the words list wins over them.
     * Two places written the same way but read differently keep their readings on their own pages only: the name is left out
     * here, so neither reading is shown for the other.
     */
    async words(): Promise<Record<string, string>> {
      const [names, words] = await Promise.all([deps.names?.() ?? [], deps.store.all()]);
      const found = new Map<string, Set<string>>();
      for (const n of names) {
        const word = n.word.trim();
        const reading = n.reading.trim();
        if (!isKanjiIn(word) || /\s/.test(word)) continue;
        const markup = reading.includes("{") ? (validMarkup(word, reading) ? reading : null) : alignReading(word, reading);
        if (markup) found.set(word, (found.get(word) ?? new Set()).add(markup));
      }
      const out: Record<string, string> = {};
      for (const [word, readings] of found) if (readings.size === 1) out[word] = [...readings][0]!;
      for (const w of words) out[w.word] = w.reading;
      return out;
    },
  };
}

/** In-memory words for tests and the dev page. */
export function createMemoryFuriganaStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const list = createMemoryListStore<FuriganaFields>(audit, FURIGANA_AUDIT, opts);
  const store: FuriganaStore = {
    ...list.store,
    async all() {
      return [...list.rows.values()].map(({ word, reading }) => ({ word, reading }));
    },
    async findByWord(word) {
      return [...list.rows.values()].find((r) => r.word === word) ?? null;
    },
  };
  return { store, rows: list.rows };
}

export interface FuriganaServices extends KitServices {
  furigana: FuriganaService;
}

/** The furigana words as an admin list (`furigana.manage`). */
export const furiganaList: ListDef<"furigana", typeof FURIGANA_FIELDS, FuriganaRow, FuriganaServices> = {
  key: "furigana",
  permission: "furigana.manage",
  fields: FURIGANA_FIELDS,
  service: (s) => s.furigana,
  ops: { create: true, edit: true, delete: true },
  ui: {
    title: { ja: "ふりがな", en: "Furigana" },
    intro: {
      ja: "「ふりがなをつける」を選んだ人に、ここの言葉の読みを漢字の上に表示します。小学校で習わない漢字を含む言葉だけ載せてください。",
      en: "For visitors who turn furigana on, the reading of each word here is shown over its kanji. Only add words that have a kanji not taught in elementary school.",
    },
    newLabel: { ja: "新しい言葉", en: "New word" },
    deleteWarning: { ja: "この言葉のふりがなを削除します。よろしいですか？", en: "Delete the furigana of this word?" },
    titleField: "word",
    fields: [
      { name: "word", kind: "text", label: { ja: "言葉", en: "Word" }, hint: { ja: "ページに書いてあるとおりに書きます。例：葛城山", en: "As it is written on the page. For example: 葛城山" }, required: true },
      {
        name: "reading",
        kind: "text",
        label: { ja: "読み", en: "Reading" },
        hint: {
          ja: "ひらがなで言葉全体の読みを書きます。例：かつらぎさん。送りがなが中にある言葉（取り扱い）は、漢字のすぐあとに読みを書きます。例：取{と}り扱{あつか}い",
          en: "The whole word's reading in hiragana. For example: かつらぎさん. For a word with kana inside it, write each reading right after its kanji. For example: 取{と}り扱{あつか}い",
        },
        required: true,
        inList: { text: { ja: "読み：{value}", en: "Reading: {value}" } },
      },
    ],
  },
};

/** What visitors get when they turn furigana on: every word with its reading. A few minutes old at most. */
export function publicFuriganaRoutes(getFurigana: () => FuriganaService) {
  return new Elysia({ detail: { tags: ["Content"] } }).get(
    "/furigana/words",
    async ({ set }) => {
      publicCache(set, 300);
      return { ok: true as const, words: await getFurigana().words() };
    },
    { detail: { summary: "The words furigana is drawn over, with their readings" } },
  );
}
