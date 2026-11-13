"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ClosedIcon, TickIcon, TrashIcon } from "@/components/icons";
import { RoutePhoto } from "@/components/RoutePhoto";
import { useErrorMessages } from "@/components/useErrorMessages";
import { afterChange, COMMENT_TABS, commentPageOf, inboxQuery, initialOf, type CommentItem, type CommentPage, type CommentStatus, type CommentTab } from "@/lib/admin/comment-inbox";
import { formatMoment } from "@/lib/admin/lists/config";
import { listRequest, type ListPage, type OneItem } from "@/lib/admin/lists/list-client";
import { showToast } from "@/lib/admin/toast";

const action = "tap-target inline-flex items-center gap-2 rounded-full border border-line px-4 text-base font-bold hover:bg-surface disabled:opacity-50";

/**
 * The comments as an inbox, the way a video site's studio shows them: one row per comment with who wrote it, when, the
 * whole text and its post, and the buttons right there (show, hide, delete). No form to open. Opens on 確認待ち, so what
 * needs a look comes first; a comment that is dealt with leaves that tab, and the message offers to undo it.
 */
export function CommentInbox({ initial, locale }: { initial: CommentPage; locale: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [tab, setTab] = useState<CommentTab>("pending");
  const [words, setWords] = useState("");
  const [data, setData] = useState<CommentPage>(initial);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const tabName: Record<CommentTab, string> = { pending: t`確認待ち`, approved: t`公開中`, hidden: t`非表示`, all: t`すべて` };
  const statusName: Record<CommentStatus, string> = { pending: t`確認待ち`, approved: t`公開中`, hidden: t`非表示` };

  async function load(nextTab: CommentTab, page: number, search = words) {
    setBusy(true);
    const res = await listRequest<ListPage>("GET", `comments?${inboxQuery(nextTab, search, page)}`);
    setBusy(false);
    if (!res.ok) return showToast({ kind: "error", text: messages[res.key] });
    setTab(nextTab);
    setData(commentPageOf(res.data));
    setTicked(new Set());
  }

  /** Sets one comment's status; returns the saved comment, or null after saying what went wrong. */
  async function setStatus(c: CommentItem, status: CommentStatus): Promise<CommentItem | null> {
    const res = await listRequest<OneItem>("PATCH", `comments/${c.id}`, { updatedAt: c.updatedAt, status });
    if (!res.ok) {
      showToast({ kind: "error", text: messages[res.key] });
      return null;
    }
    return res.data.item as CommentItem;
  }

  async function change(list: CommentItem[], status: CommentStatus) {
    setBusy(true);
    const saved: CommentItem[] = [];
    for (const c of list) {
      const s = await setStatus(c, status);
      if (s) saved.push(s);
    }
    setBusy(false);
    if (saved.length === 0) return;
    setData((d) => ({ ...d, items: saved.reduce((items, s) => afterChange(items, s, tab), d.items) }));
    setTicked(new Set());
    const before = new Map(list.map((c) => [c.id, c.status]));
    const text = status === "approved" ? t`${saved.length}件を公開しました。` : status === "hidden" ? t`${saved.length}件を非表示にしました。` : t`${saved.length}件を確認待ちに戻しました。`;
    showToast({
      kind: "ok",
      text,
      action: {
        label: t`元に戻す`,
        run: async () => {
          showToast(null);
          for (const s of saved) await setStatus(s, before.get(s.id) ?? "pending");
          await load(tab, data.page);
        },
      },
    });
  }

  async function remove(list: CommentItem[]) {
    const body = list.length === 1 ? t`このコメントを削除します。元に戻せません。` : t`${list.length}件のコメントを削除します。元に戻せません。`;
    if (!(await confirmDialog({ title: t`削除しますか？`, body, yes: t`削除する` }))) return;
    setBusy(true);
    const gone: string[] = [];
    for (const c of list) {
      const res = await listRequest("DELETE", `comments/${c.id}`);
      if (res.ok) gone.push(c.id);
      else showToast({ kind: "error", text: messages[res.key] });
    }
    setBusy(false);
    setData((d) => ({ ...d, items: d.items.filter((c) => !gone.includes(c.id)), total: d.total - gone.length }));
    setTicked(new Set());
    if (gone.length > 0) showToast({ kind: "ok", text: t`${gone.length}件を削除しました。` });
  }

  const picked = data.items.filter((c) => ticked.has(c.id));
  const allTicked = data.items.length > 0 && picked.length === data.items.length;
  const toggle = (id: string) => setTicked((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t`いまの状態`} className="flex flex-wrap gap-2 border-b border-line pb-3">
        {COMMENT_TABS.map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} disabled={busy} onClick={() => void load(k, 1)} className={`tap-target rounded-full px-5 text-lg font-bold ${tab === k ? "bg-ink text-paper" : "hover:bg-surface"}`}>
            {tabName[k]}
          </button>
        ))}
      </div>

      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load(tab, 1);
        }}
      >
        <input type="search" value={words} onChange={(e) => setWords(e.target.value)} aria-label={t`コメントをさがす`} placeholder={t`コメントをさがす`} className="tap-target min-w-0 flex-1 rounded-full border border-line bg-paper px-4 text-lg" />
        <button type="submit" disabled={busy} className="tap-target rounded-full bg-ink px-5 text-lg font-bold text-paper">
          {t`探す`}
        </button>
      </form>

      {/* What to do with the ticked ones; it takes the place of the count while any are ticked. */}
      <div className="flex min-h-12 flex-wrap items-center gap-3">
        <label className="tap-target inline-flex items-center gap-2 text-base">
          <input type="checkbox" className="size-5" checked={allTicked} disabled={data.items.length === 0} onChange={() => setTicked(allTicked ? new Set() : new Set(data.items.map((c) => c.id)))} />
          {t`すべて選ぶ`}
        </label>
        {picked.length > 0 ? (
          <>
            <span className="text-base font-bold">{t`${picked.length}件を選択中`}</span>
            <button type="button" disabled={busy} onClick={() => void change(picked, "approved")} className={action}>
              <TickIcon size={20} />
              {t`公開する`}
            </button>
            <button type="button" disabled={busy} onClick={() => void change(picked, "hidden")} className={action}>
              <ClosedIcon size={20} />
              {t`非表示にする`}
            </button>
            <button type="button" disabled={busy} onClick={() => void remove(picked)} className={`${action} text-danger`}>
              <TrashIcon />
              {t`削除`}
            </button>
          </>
        ) : (
          <span className="text-base text-muted">{t`${data.total}件`}</span>
        )}
      </div>

      {data.items.length === 0 ? (
        <p className="rounded-lg bg-surface p-6 text-lg">{tab === "pending" ? t`確認待ちのコメントはありません。` : t`コメントはありません。`}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {data.items.map((c) => (
            <li key={c.id} className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 py-4 md:grid-cols-[auto_1fr_16rem] ${ticked.has(c.id) ? "bg-surface" : ""}`}>
              <input type="checkbox" className="mt-3 size-5" aria-label={t`${c.authorName ?? t`名前なし`}さんのコメントを選ぶ`} checked={ticked.has(c.id)} onChange={() => toggle(c.id)} />
              <div className="flex min-w-0 gap-3">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-lg font-bold text-paper">
                  {initialOf(c.authorName)}
                </span>
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="flex flex-wrap items-center gap-x-2 text-base">
                    <span className="font-bold">{c.authorName ?? t`名前なし`}</span>
                    <span className="text-muted">{formatMoment(locale, c.createdAt)}</span>
                    {tab === "all" || c.status !== tab ? <span className={`rounded-full border px-2 text-base font-bold ${c.status === "pending" ? "border-ink" : "border-line text-muted"}`}>{statusName[c.status]}</span> : null}
                  </p>
                  <p className="whitespace-pre-line text-lg leading-7 [overflow-wrap:anywhere]">{c.body}</p>
                  <div className="flex flex-wrap gap-2">
                    {c.status !== "approved" ? (
                      <button type="button" disabled={busy} onClick={() => void change([c], "approved")} className={action}>
                        <TickIcon size={20} />
                        {t`公開する`}
                      </button>
                    ) : null}
                    {c.status !== "hidden" ? (
                      <button type="button" disabled={busy} onClick={() => void change([c], "hidden")} className={action}>
                        <ClosedIcon size={20} />
                        {t`非表示にする`}
                      </button>
                    ) : null}
                    <button type="button" disabled={busy} onClick={() => void remove([c])} className={`${action} text-danger`}>
                      <TrashIcon />
                      {t`削除`}
                    </button>
                  </div>
                </div>
              </div>
              {/* The post it is under: a small photo and the title, opening the post on the site in a new tab. */}
              <a href={`/blog/${c.postId}`} target="_blank" rel="noreferrer" className="col-start-2 flex items-start gap-3 rounded-lg p-1 hover:bg-surface md:col-start-3">
                <span className="relative block aspect-[4/3] w-24 shrink-0 overflow-hidden rounded">
                  <RoutePhoto src={c.postPhotoUrl} alt="" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-base font-bold leading-snug">{c.postTitle || t`（題名なし）`}</span>
                  <span className="text-base text-muted underline underline-offset-4">
                    {t`記事を見る`}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {data.pages > 1 ? (
        <div className="flex items-center gap-3">
          <button type="button" disabled={busy || data.page <= 1} onClick={() => void load(tab, data.page - 1)} className={action}>
            {t`前へ`}
          </button>
          <span className="text-base">{`${data.page} / ${data.pages}`}</span>
          <button type="button" disabled={busy || data.page >= data.pages} onClick={() => void load(tab, data.page + 1)} className={action}>
            {t`次へ`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
