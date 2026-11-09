"use client";

import Link from "next/link";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Avatar } from "./Avatar";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode } from "@/lib/api-error";
import { formatDay, japanDay } from "@/lib/format";
import type { PostComment } from "@/lib/posts";
import { buttonStyle } from "@/components/button";
import { TickIcon } from "@/components/icons";

const MAX = 1000;

/**
 * The comments under a post and the box to write one. Only a signed-in reader can write; a comment from anyone but the staff
 * waits to be approved, and the page says so instead of showing it. The list is the approved comments, oldest first.
 */
export function CommentSection({ postId, comments, signedIn, locale, loginHref }: { postId: string; comments: PostComment[]; signedIn: boolean; locale: string; loginHref: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [list, setList] = useState(comments);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  // A held comment: the thanks takes the box's place, so it shows where the reader is already looking.
  const [held, setHeld] = useState(false);

  async function send() {
    if (busy || text.trim() === "") return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/v1/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; held?: boolean; comment?: PostComment | null } | null;
      if (res.ok && json?.ok === true) {
        setText("");
        if (json.held) setHeld(true);
        else if (json.comment) setList((now) => [...now, json.comment!]);
      } else {
        setNote({ kind: "error", text: messages[json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json)] });
      }
    } catch {
      setNote({ kind: "error", text: messages.network });
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="comments-title" className="flex flex-col gap-4">
      <h2 id="comments-title" className="text-2xl font-bold">
        {t`コメント`}
        {list.length > 0 ? <span className="ml-2 text-lg text-muted">{list.length}</span> : null}
      </h2>

      {list.length === 0 ? <p className="text-lg text-muted">{t`まだコメントはありません。`}</p> : null}
      <ul className="flex flex-col gap-3">
        {list.map((c) => (
          <li key={c.id} className="flex gap-3 rounded-2xl bg-surface p-4">
            <Avatar src={null} name={c.authorName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-3 text-base">
                <span className="font-bold">{c.authorName ?? t`名前なし`}</span>
                <time dateTime={c.createdAt} className="text-muted">
                  {formatDay(locale, japanDay(c.createdAt))}
                </time>
              </p>
              <p className="mt-1 whitespace-pre-line break-words text-lg leading-8">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>

      {signedIn && held ? (
        <div role="status" className="flex flex-col gap-3 rounded-2xl border-2 border-moss bg-paper p-4">
          <p className="flex items-center gap-3 text-lg font-bold text-moss">
            <TickIcon size={28} />
            {t`コメントを受け付けました`}
          </p>
          <p className="text-lg leading-8">{t`スタッフが確認すると、ここに表示されます。`}</p>
          <button type="button" onClick={() => setHeld(false)} className={buttonStyle("secondary", "md", "inline-flex w-fit")}>
            {t`もう一つ書く`}
          </button>
        </div>
      ) : signedIn ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="comment-body" className="text-lg font-bold">
            {t`コメントを書く`}
          </label>
          <textarea
            id="comment-body"
            rows={4}
            maxLength={MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-xl border-2 border-line bg-paper p-3 text-lg leading-8"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || text.trim() === ""} className={buttonStyle("action", "md", "inline-flex")}>
              {busy ? t`送っています…` : t`コメントする`}
            </button>
            <span className="text-base text-muted tabular-nums">{text.length} / {MAX}</span>
          </div>
          {note ? (
            <p role={note.kind === "error" ? "alert" : "status"} className={`text-lg font-bold ${note.kind === "error" ? "text-danger" : "text-moss"}`}>
              {note.text}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="rounded-2xl bg-surface p-4 text-lg leading-8">
          {t`コメントを書くには、ログインが必要です。`}{" "}
          <Link href={loginHref} className="font-bold text-accent underline underline-offset-4">
            {t`ログイン`}
          </Link>
        </p>
      )}
    </section>
  );
}
