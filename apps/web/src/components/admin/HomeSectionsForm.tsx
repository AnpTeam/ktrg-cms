"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode } from "@/lib/api-error";
import { confirmDialog } from "@/components/ConfirmDialog";
import { showToast } from "@/lib/admin/toast";

/** 管理 > 詳細設定 > ホームページ: which optional sections visitors see. Each one is off until it is turned on here. */
export function HomeSectionsForm({ initial }: { initial: { tourism: boolean } }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [saved, setSaved] = useState(initial);
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = s.tourism !== saved.tourism;
  useUnsavedGuard(dirty);

  async function save() {
    if (!(await confirmDialog({ title: t`サイトに反映しますか？`, body: t`この設定は、本番のサイトにすぐ反映されます。保存しますか？`, yes: t`保存する` }))) return;
    setBusy(true);
    showToast(null);
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
        showToast({ kind: "ok", text: t`保存しました。` });
      } else {
        showToast({ kind: "error", text: messages[json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json)] });
      }
    } catch {
      showToast({ kind: "error", text: messages.network });
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="home-sections" className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
      <h2 id="home-sections" className="text-2xl font-bold">
        {t`ホームページの表示`}
      </h2>
      <label className="tap-target flex items-start gap-3 text-lg">
        <input type="checkbox" checked={s.tourism} onChange={(e) => { showToast(null); setS({ tourism: e.target.checked }); }} className="mt-1.5 size-6 accent-[var(--color-brand)]" />
        <span>
          <span className="block font-bold">{t`観光情報（観光・グルメ・お土産・体験・宿泊）を表示する`}</span>
          <span className="block text-base text-muted">{t`リンク先のページが用意できてから、オンにしてください。オフの間は、ホームページに出ません。`}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !dirty} onClick={save} className="tap-target rounded-full bg-ink px-6 text-lg font-bold text-paper disabled:opacity-50">
          {busy ? t`保存しています…` : t`保存する`}
        </button>
        {dirty ? <span className="text-base text-muted">{t`まだ保存していません。`}</span> : null}
      </div>
    </section>
  );
}
