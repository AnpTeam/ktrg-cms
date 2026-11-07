"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { goalFromText, type Goals } from "@/lib/admin/dashboard";
import { Field, inputClass } from "./fields";
import { showToast } from "@/lib/admin/toast";

const KEYS = ["visits", "stamps", "signups", "completions"] as const;

/** The goals the dashboard's four numbers are measured against. An empty box means no goal. Saved by an admin only (the API checks). */
export function GoalsForm({ initial }: { initial: Goals }) {
  const { t } = useLingui();
  const [text, setText] = useState<Record<(typeof KEYS)[number], string>>({ visits: String(initial.visits ?? ""), stamps: String(initial.stamps ?? ""), signups: String(initial.signups ?? ""), completions: String(initial.completions ?? "") });
  const [saving, setSaving] = useState(false);
  const labels = { visits: t`アクセス数`, stamps: t`スタンプ数`, signups: t`登録した人`, completions: t`ラリーを達成した人・回数` };

  async function save() {
    const goals = Object.fromEntries(KEYS.map((k) => [k, goalFromText(text[k])])) as Record<(typeof KEYS)[number], number | null>;
    if (KEYS.some((k) => Number.isNaN(goals[k]))) return showToast({ kind: "error", text: t`1以上の整数を入れてください。` });
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/dashboard/goals", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(goals) });
      showToast(res.ok ? { kind: "ok", text: t`保存しました。` } : { kind: "error", text: t`保存できませんでした。` });
    } catch {
      showToast({ kind: "error", text: t`保存できませんでした。` });
    }
    setSaving(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4"
    >
      <p className="text-base text-muted">{t`数字を空にすると、その目標はなしになります。保存すると、ページを開き直したときに反映されます。`}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {KEYS.map((k) => (
          <Field key={k} label={labels[k]} htmlFor={`goal-${k}`}>
            <input id={`goal-${k}`} inputMode="numeric" value={text[k]} onChange={(e) => setText({ ...text, [k]: e.target.value })} className={inputClass} />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="tap-target rounded-full bg-ink px-6 text-lg font-bold text-paper disabled:opacity-50">
          {t`目標を保存`}
        </button>
      </div>
    </form>
  );
}
