"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "@/components/button";

type State = { name: "working" } | { name: "done"; restored: number; total: number } | { name: "failed" };

/** Reads the backup code from the address (after the #), asks the server to put its stamps in this browser, and says how it went. */
export function RestoreStamps() {
  const { t } = useLingui();
  const [state, setState] = useState<State>({ name: "working" });

  useEffect(() => {
    const code = window.location.hash.slice(1);
    (async () => {
      try {
        const res = await fetch("/api/v1/guest/restore", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const body = (await res.json()) as { ok?: boolean; restored?: number; total?: number };
        setState(res.ok && body.ok ? { name: "done", restored: body.restored ?? 0, total: body.total ?? 0 } : { name: "failed" });
      } catch {
        setState({ name: "failed" });
      }
    })();
  }, []);

  return (
    <div className="flex flex-col gap-4 px-4">
      {state.name === "working" ? <p className="text-xl">{t`もどしています…`}</p> : null}
      {state.name === "done" ? (
        <p role="status" className="text-xl font-bold leading-snug">
          {state.restored > 0 ? t`スタンプを${state.restored}個、もどしました。（いま ${state.total}個）` : t`もどすスタンプは、ありませんでした。（いま ${state.total}個）`}
        </p>
      ) : null}
      {state.name === "failed" ? <p role="alert" className="text-xl font-bold text-danger">{t`このリンクからは、スタンプをもどせませんでした。リンクが途中で切れていないか、確かめてください。`}</p> : null}
      {state.name !== "working" ? (
        <Link href="/rallies" className={buttonStyle("primary", "lg", "flex")}>
          {t`ラリーを見る`}
        </Link>
      ) : null}
    </div>
  );
}
