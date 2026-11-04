"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode } from "@/lib/api-error";

/** 管理 > サイト全体の設定 > ホームページ: which optional sections visitors see. Each one is off until it is turned on here. */
export function HomeSectionsForm({ initial }: { initial: { tourism: boolean } }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [saved, setSaved] = useState(initial);
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const dirty = s.tourism !== saved.tourism;

  async function save() {
    if (!window.confirm(t`この設定は、本番のサイトにすぐ反映されます。保存しますか？`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/admin/settings/home-sections", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tourism: s.tourism }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null;
      if (res.ok && json?.ok === true) {
        setSaved(s);
        setNotice({ kind: "saved", text: t`保存しました。` });
      } else {
        setNotice({ kind: "error", text: messages[json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json)] });
      }
    } catch {
      setNotice({ kind: "error", text: messages.network });
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="home-sections" className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
      <h2 id="home-sections" className="text-2xl font-bold">
        {t`ホームページの表示`}
      </h2>
      <label className="tap-target flex items-start gap-3 text-lg">
        <input type="checkbox" checked={s.tourism} onChange={(e) => { setNotice(null); setS({ tourism: e.target.checked }); }} className="mt-1.5 size-6 accent-[var(--color-brand)]" />
        <span>
          <span className="block font-bold">{t`観光情報（観光・グルメ・お土産・体験・宿泊）を表示する`}</span>
          <span className="block text-base text-muted">{t`リンク先のページが用意できてから、オンにしてください。オフの間は、ホームページに出ません。`}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !dirty} onClick={save} className="tap-target rounded-xl bg-ink px-6 text-lg font-bold text-paper disabled:opacity-50">
          {busy ? t`保存しています…` : t`保存する`}
        </button>
        {dirty ? <span className="text-base text-muted">{t`まだ保存していません。`}</span> : null}
      </div>
      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-xl bg-paper p-4 text-lg font-bold ${notice.kind === "error" ? "text-danger" : "text-moss"}`}>
          {notice.text}
        </p>
      ) : null}
    </section>
  );
}
