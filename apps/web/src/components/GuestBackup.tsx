"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "@/components/button";

type State = "idle" | "copied" | "empty" | "failed";

/**
 * For someone with no account: copies a link that brings their stamps back if the browser's data is lost (open it in the
 * browser to restore, see /restore). It is the stamps themselves, so it is not for other people.
 */
export function GuestBackup() {
  const { t } = useLingui();
  const [state, setState] = useState<State>("idle");

  async function copy() {
    try {
      const body = (await (await fetch("/api/v1/guest/backup", { credentials: "same-origin" })).json()) as { ok?: boolean; code?: string };
      if (!body.ok) return setState("failed");
      if (!body.code) return setState("empty");
      const link = `${window.location.origin}/restore#${body.code}`;
      if (typeof navigator.share === "function") await navigator.share({ url: link, title: t`スタンプのバックアップ` });
      else await navigator.clipboard.writeText(link);
      setState("copied");
    } catch {
      setState("failed"); // also when the share sheet is closed: nothing was saved
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={copy} className={buttonStyle("secondary", "md", "inline-flex self-start")}>
        {t`スタンプのバックアップリンク`}
      </button>
      {state === "copied" ? <p role="status" className="text-base leading-7">{t`自分に送っておくと、ブラウザのデータが消えても、このリンクからスタンプをもどせます。ほかの人には見せないでください。`}</p> : null}
      {state === "empty" ? <p role="status" className="text-base">{t`まだスタンプがありません。`}</p> : null}
      {state === "failed" ? <p role="alert" className="text-base text-danger">{t`リンクを作れませんでした。もう一度お試しください。`}</p> : null}
    </div>
  );
}
