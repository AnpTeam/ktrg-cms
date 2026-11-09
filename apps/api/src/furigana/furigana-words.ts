import { publicCache } from "../lib/public-cache";
import { Elysia, t, type Static } from "elysia";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import type { ListDef } from "../admin-lists/list-routes";
import { createListService } from "../admin-lists/list-service";
import { bad, ok, type ListRow, type ListRules, type ListStore } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import { dictionaryWords, type Tokenizer } from "./dictionary";
import { hasHardKanji } from "./kyoiku-kanji";

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
export type FuriganaRow = ListRow & FuriganaFields & { pending?: boolean };

/**
 * The words list. `list` (the admin table) and `all` (what visitors get) hold only a person's words; the dictionary's
 * suggestions wait apart (`pending`) until approved. Changing a suggestion in the form makes it a person's word.
 */
export interface FuriganaStore extends ListStore<FuriganaRow, FuriganaFields> {
  /** Every word a person typed or approved, with its marked-up reading. */
  all(): Promise<{ word: string; reading: string }[]>;
  findByWord(word: string): Promise<FuriganaRow | null>;
  /** The dictionary's suggestions still waiting, in the order of the words. */
  pending(): Promise<FuriganaRow[]>;
  /** Make these suggestions a person's words; the number approved. */
  approve(actor: string, ids: string[]): Promise<number>;
  /** The dictionary's latest suggestions take the place of the waiting ones; a word already in the list (either kind) is kept. */
  setSuggestions(actor: string | null, words: { word: string; reading: string }[]): Promise<{ added: number; removed: number }>;
}

export const FURIGANA_AUDIT = { create: "furigana.create", update: "furigana.update", delete: "furigana.delete", approve: "furigana.approve", refresh: "furigana.refresh" } as const;

/** A course, published waypoint or published place whose name has a hard kanji but no reading yet: a person should type it. */
export interface UnreadName {
  kind: "route" | "spot" | "place";
  id: string;
  /** The course a waypoint is on (to open its editor). */
  routeId?: string;
  nameJa: string;
}

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

/** Every Japanese text field of a row (the keys ending in "Ja"), one line at a time. */
const jaLines = (row: object): string[] =>
  Object.entries(row).flatMap(([k, v]) => (k.endsWith("Ja") && typeof v === "string" ? v.split(/[\r\n]+/) : []));

/**
 * The site's published Japanese text, for the dictionary: courses that have a published place (a 準備中 course shows only
 * its name), published waypoints and places, and the blog posts and notices visitors can read. Never a draft.
 */
export async function siteTexts(sources: {
  routes: () => Promise<(Named & { publishedSpotCount: number })[]>;
  spots: () => Promise<object[]>;
  places: () => Promise<object[]>;
  posts: () => Promise<object[]>;
  notices: () => Promise<object[]>;
}): Promise<string[]> {
  const [routes, ...rest] = await Promise.all([sources.routes(), sources.spots(), sources.places(), sources.posts(), sources.notices()]);
  return [...routes.flatMap((r) => (r.publishedSpotCount > 0 ? jaLines(r) : [r.nameJa])), ...rest.flat().flatMap(jaLines)];
}

/** Courses, published waypoints and published places whose name holds a hard kanji but has no reading typed yet. */
export async function unreadNames(
  content: { listRoutes(): Promise<(Named & { id: string })[]>; listPublishedSpots(): Promise<(Named & { id: string; routeId: string })[]> },
  places: { listPublic(): Promise<(Named & { id: string })[]> },
): Promise<UnreadName[]> {
  const [routes, spots, listed] = await Promise.all([content.listRoutes(), content.listPublishedSpots(), places.listPublic()]);
  const needs = (n: Named) => !n.nameKana && hasHardKanji(n.nameJa);
  return [
    ...routes.filter(needs).map((r) => ({ kind: "route" as const, id: r.id, nameJa: r.nameJa })),
    ...spots.filter(needs).map((s) => ({ kind: "spot" as const, id: s.id, routeId: s.routeId, nameJa: s.nameJa })),
    ...listed.filter(needs).map((p) => ({ kind: "place" as const, id: p.id, nameJa: p.nameJa })),
  ];
}

/** The readings people typed with course names and with published waypoint and place names (a draft's name never shows). */
export async function nameReadings(
  content: { listRoutes(): Promise<Named[]>; listPublishedSpots(): Promise<Named[]> },
  places: { listPublic(): Promise<Named[]> },
): Promise<{ word: string; reading: string }[]> {
  const [routes, spots, listed] = await Promise.all([content.listRoutes(), content.listPublishedSpots(), places.listPublic()]);
  return [...routes, ...spots, ...listed].flatMap((r) => (r.nameKana ? [{ word: r.nameJa, reading: r.nameKana }] : []));
}

export function createFuriganaService(deps: {
  store: FuriganaStore;
  names?: () => Promise<{ word: string; reading: string }[]>;
  /** The site's published text, for the dictionary to read. */
  texts?: () => Promise<string[]>;
  tokenizer?: () => Promise<Tokenizer>;
  /** Names that still need a reading typed. */
  unread?: () => Promise<UnreadName[]>;
}) {
  return {
    ...createListService({ store: deps.store, rules: furiganaRules(deps.store) }),
    /**
     * Read the site's text with the dictionary again. New words become suggestions (waiting, never shown); suggestions for
     * words that are gone are dropped; a person's word and a name with a typed reading are never touched or suggested.
     */
    async refresh(actor: string | null): Promise<{ added: number; removed: number }> {
      if (!deps.texts || !deps.tokenizer) return { added: 0, removed: 0 };
      const [texts, tokenizer, words, names] = await Promise.all([deps.texts(), deps.tokenizer(), deps.store.all(), deps.names?.() ?? []]);
      const known = new Set([...words.map((w) => w.word), ...names.map((n) => n.word.trim())]);
      const found = dictionaryWords(tokenizer, texts, (w) => known.has(w));
      const suggestions = [...found].flatMap(([word, reading]) => {
        const markup = alignReading(word, reading);
        return markup ? [{ word, reading: markup }] : [];
      });
      return deps.store.setSuggestions(actor, suggestions);
    },
    pending: () => deps.store.pending(),
    approve: (actor: string, ids: string[]) => deps.store.approve(actor, ids),
    unread: async () => (await deps.unread?.()) ?? [],
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
  const rows = list.rows as Map<string, FuriganaRow>;
  const mine = () => [...rows.values()].filter((r) => !r.pending);
  const store: FuriganaStore = {
    ...list.store,
    async list(after, limit) {
      return (await list.store.list(after, Number.MAX_SAFE_INTEGER)).filter((r) => !(r as FuriganaRow).pending).slice(0, limit);
    },
    async update(actor, id, expected, changes) {
      const r = await list.store.update(actor, id, expected, changes);
      if (r && r !== "conflict") (r as FuriganaRow).pending = false;
      return r;
    },
    async all() {
      return mine().map(({ word, reading }) => ({ word, reading }));
    },
    async pending() {
      return [...rows.values()].filter((r) => r.pending).sort((a, b) => a.word.localeCompare(b.word, "ja"));
    },
    async approve(actor, ids) {
      let n = 0;
      for (const id of ids) {
        const r = rows.get(id);
        if (r?.pending) {
          r.pending = false;
          n++;
          await audit.record({ actorUserId: actor, action: FURIGANA_AUDIT.approve, targetId: id });
        }
      }
      return n;
    },
    async setSuggestions(actor, words) {
      const wanted = new Map(words.map((w) => [w.word, w.reading]));
      let removed = 0;
      for (const [id, r] of rows) if (r.pending && !wanted.has(r.word)) (rows.delete(id), removed++);
      const present = new Set([...rows.values()].map((r) => r.word));
      let added = 0;
      for (const [word, reading] of wanted) {
        if (present.has(word)) continue;
        const at = new Date();
        rows.set(crypto.randomUUID(), { id: "", word, reading, pending: true, createdAt: at, updatedAt: at });
        added++;
      }
      for (const [id, r] of rows) if (r.id === "") r.id = id;
      await audit.record({ actorUserId: actor, action: FURIGANA_AUDIT.refresh, targetId: null });
      return { added, removed };
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
      ja: "「ふりがなをつける」を選んだ人に、読みを漢字の上に表示します。下の一覧は、人が入れた読みと承認した辞書の読みで、訪れる人に表示されます。辞書の読みは、承認するまで表示されません。",
      en: "For visitors who turn furigana on, readings are shown over the kanji. The list below holds readings typed by a person and approved dictionary readings; visitors see these. A dictionary reading is not shown until it is approved.",
    },
    newLabel: { ja: "新しい言葉", en: "New word" },
    deleteWarning: { ja: "この言葉のふりがなを削除します。よろしいですか？", en: "Delete the furigana of this word?" },
    titleField: "word",
    fields: [
      { name: "word", kind: "text", label: { ja: "言葉", en: "Word" }, hint: { ja: "ページに書いてあるとおりに書きます。例：葛城山", en: "As it is written on the page. For example: 葛城山" }, required: true },
      {
        name: "reading",
        kind: "ruby",
        of: "word",
        label: { ja: "読み", en: "Reading" },
        hint: {
          ja: "上の言葉の漢字ごとに、ひらがなで読みを入れます（ルートや経由地の名前と同じ入れ方です）。",
          en: "Type the reading in hiragana under each run of kanji in the word above (the same as for route and waypoint names).",
        },
        required: true,
        inList: { text: { ja: "読み：{value}", en: "Reading: {value}" } },
      },
    ],
  },
};

/**
 * The ふりがな page's own actions (`furigana.manage`): what is waiting (dictionary suggestions, names with no reading),
 * approving suggestions, and reading the site again now. Writes are rate limited and audited by the store.
 */
export function adminFuriganaRoutes(getServices: () => FuriganaServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  const svc = () => getServices().furigana;
  return new Elysia({ prefix: "/admin/furigana", detail: { tags: ["Admin lists"] } })
    .use(plugins)
    .get(
      "/overview",
      async () => {
        const [pending, unread] = await Promise.all([svc().pending(), svc().unread()]);
        return { ok: true as const, pending: pending.map(({ id, word, reading }) => ({ id, word, reading })), unread };
      },
      { auth: "furigana.manage", detail: { summary: "Dictionary suggestions waiting, and names that still need a reading" } },
    )
    .post(
      "/approve",
      async ({ user, body }) => ({ ok: true as const, approved: await svc().approve(user.id, body.ids) }),
      { auth: "furigana.manage", rateLimit: { adminWriteUser: "user.id" }, body: t.Object({ ids: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 500 }) }) },
    )
    .post(
      "/refresh",
      async ({ user }) => ({ ok: true as const, ...(await svc().refresh(user.id)) }),
      { auth: "furigana.manage", rateLimit: { adminWriteUser: "user.id" }, detail: { summary: "Read the site's text with the dictionary again now" } },
    );
}

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
