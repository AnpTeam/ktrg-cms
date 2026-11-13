"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "@/components/button";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode, type ErrorKey } from "@/lib/api-error";
import { showToast } from "@/lib/admin/toast";
import { parseRuby } from "@/lib/ruby";
import { readJson } from "@/lib/read-json";

type Suggestion = { id: string; word: string; reading: string };
type Unread = { kind: "route" | "spot" | "place"; id: string; routeId?: string; nameJa: string };
type Answer<T> = { ok: true; data: T } | { ok: false; key: ErrorKey };

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<Answer<T>> {
  try {
    const res = await fetch(`/api/v1/admin/furigana/${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await readJson<{ ok?: unknown; error?: unknown }>(res);
    if (res.ok && json?.ok === true) return { ok: true, data: json as T };
    if (json?.ok === false && isServerCode(json.error)) return { ok: false, key: json.error };
    return { ok: false, key: errorKeyFromApi(res.status, json) };
  } catch {
    return { ok: false, key: "network" };
  }
}

/** The word with its reading over it, as visitors would see it. */
function Preview({ word, reading }: { word: string; reading: string }) {
  const parts = parseRuby(reading);
  if (!parts) return <span className="text-2xl">{word}</span>;
  return (
    <span className="text-2xl leading-[2.2]">
      {parts.map((p, i) =>
        p.reading ? (
          <ruby key={i}>
            {p.text}
            <rt className="text-sm">{p.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

/**
 * The top of the ふりがな page: the names that still need a reading typed by a person (course, waypoint and place names are
 * never left to the dictionary), then the dictionary's readings waiting for approval. A waiting reading is never shown to
 * visitors; approving it (or correcting it) adds it to the list below, which is what visitors get.
 */
export function FuriganaOverview() {
  const { t } = useLingui();
  const router = useRouter();
  const messages = useErrorMessages();
  const [pending, setPending] = useState<Suggestion[] | null>(null);
  const [unread, setUnread] = useState<Unread[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);

  const load = useCallback(async () => {
    const r = await call<{ pending: Suggestion[]; unread: Unread[] }>("GET", "overview");
    if (!r.ok) return setError(r.key);
    setError(null);
    setPending(r.data.pending);
    setUnread(r.data.unread);
    setPicked((now) => new Set([...now].filter((id) => r.data.pending.some((p) => p.id === id))));
  }, []);
  useEffect(() => {
    // Loads once when the page opens; the setState calls happen after the request, not during the effect itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function approve(ids: string[]) {
    if (busy || ids.length === 0) return;
    setBusy(true);
    const r = await call<{ approved: number }>("POST", "approve", { ids });
    setBusy(false);
    if (!r.ok) return showToast({ kind: "error", text: messages[r.key] });
    const n = r.data.approved;
    showToast({ kind: "ok", text: t`${n}件の読みを承認しました。訪れる人に表示されます。` });
    await load();
    router.refresh(); // the list of shown readings below now holds them
  }

  async function refresh() {
    if (busy) return;
    setBusy(true);
    const r = await call<{ added: number; removed: number }>("POST", "refresh");
    setBusy(false);
    if (!r.ok) return showToast({ kind: "error", text: messages[r.key] });
    const n = r.data.added;
    showToast({ kind: "ok", text: n > 0 ? t`辞書の読みが${n}件ふえました。確認してください。` : t`新しい言葉はありませんでした。` });
    await load();
  }

  const toggle = (id: string) => setPicked((now) => (now.has(id) ? new Set([...now].filter((x) => x !== id)) : new Set([...now, id])));
  const editHref = (u: Unread) => (u.kind === "route" ? `/admin/routes/${u.id}` : u.kind === "spot" ? `/admin/routes/${u.routeId}?tab=places` : `/admin/directory/${u.id}`);
  const kindName = { route: t`ルート`, spot: t`経由地`, place: t`場所` };

  if (error) return <p role="alert" className="rounded-2xl bg-surface p-4 text-lg font-bold text-danger">{messages[error]}</p>;
  if (!pending) return <p className="text-lg text-muted">{t`読み込んでいます…`}</p>;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="unread-title" className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:p-5">
        <h2 id="unread-title" className="text-xl font-bold text-accent">
          {t`読みを入れてほしい名前`} <span className="text-lg text-muted tabular-nums">{unread.length}</span>
        </h2>
        <p className="text-base text-muted">{t`寺社・経塚・行場などの名前は、辞書には任せず人が読みを入れます。それぞれの編集画面の「名前の読み」で入れてください。`}</p>
        {unread.length === 0 ? (
          <p className="text-lg">{t`すべての名前に読みがあります。`}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {unread.map((u) => (
              <li key={`${u.kind}-${u.id}`}>
                <Link href={editHref(u)} className="tap-target inline-flex items-center gap-2 rounded-full border-2 border-line bg-paper px-4 text-lg no-underline hover:bg-surface">
                  <span className="text-base text-muted">{kindName[u.kind]}</span>
                  <span className="font-bold">{u.nameJa}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pending-title" className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pending-title" className="text-xl font-bold text-accent">
            {t`辞書の読み（確認待ち）`} <span className="text-lg text-muted tabular-nums">{pending.length}</span>
          </h2>
          <button type="button" disabled={busy} onClick={() => void refresh()} className={buttonStyle("secondary", "md", "inline-flex")}>
            {t`辞書で読み直す`}
          </button>
        </div>
        <p className="text-base text-muted">{t`サイトの文章を辞書が読んで、読みを考えたものです。人が確かめて承認するまで、訪れる人には表示されません。同じ字でも読み方が変わる言葉は、文に合う読みか確かめてください。1時間ごとにも読み直します。`}</p>
        {pending.length === 0 ? (
          <p className="text-lg">{t`確認待ちの読みはありません。`}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label className="tap-target inline-flex items-center gap-2 text-lg">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--color-brand)]"
                  checked={picked.size === pending.length}
                  onChange={() => setPicked(picked.size === pending.length ? new Set() : new Set(pending.map((p) => p.id)))}
                />
                {t`すべて選ぶ`}
              </label>
              <button type="button" disabled={busy || picked.size === 0} onClick={() => void approve([...picked])} className={buttonStyle("action", "md", "inline-flex")}>
                {t`選んだ読みを承認する（${picked.size}件）`}
              </button>
            </div>
            <ul className="divide-y divide-line/40 border-y border-line/40">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
                  <label className="tap-target flex min-w-0 flex-1 items-center gap-3">
                    <input type="checkbox" className="size-5 shrink-0 accent-[var(--color-brand)]" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                    <Preview word={p.word} reading={p.reading} />
                  </label>
                  <button type="button" disabled={busy} onClick={() => void approve([p.id])} className={buttonStyle("secondary", "sm", "inline-flex")}>
                    {t`承認`}
                  </button>
                  <Link href={`/admin/furigana/${p.id}`} className={buttonStyle("secondary", "sm", "inline-flex")}>
                    {t`直す`}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
