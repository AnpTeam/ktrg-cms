"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { listRequest } from "@/lib/admin/lists/list-client";

interface Counts {
  read: number;
  added: number;
  skipped: number;
  failed: { name: string; reason: string }[];
  remaining: number;
}

// Import the field team's places sheet (CSV) into the directory: choose it, see the counts, then import. Every place
// comes in as a draft (position not checked, not published).
export function PlaceImport({ onDone }: { onDone: () => void }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [csv, setCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<Counts | null>(null);
  const [done, setDone] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(text: string, apply: boolean) {
    setBusy(true);
    setError(null);
    if (!apply) {
      const res = await listRequest<Counts>("POST", "directory/import", { csv: text, apply });
      setBusy(false);
      return res.ok ? setPreview(res.data) : setError(messages[res.key]);
    }
    // The server adds a hundred places per request (one request must not outlast the host's time limit): ask again until
    // none are left. Places already added are skipped each time; the ones it refused stay at the front of its list, so
    // `skip` passes them by.
    const total: Counts = { read: 0, added: 0, skipped: 0, failed: [], remaining: 0 };
    for (;;) {
      const res = await listRequest<Counts>("POST", "directory/import", { csv: text, apply, skip: total.failed.length });
      if (!res.ok) {
        setBusy(false);
        setDone(total.added > 0 ? total : null);
        setPreview(null);
        onDone();
        return setError(messages[res.key]);
      }
      total.read = res.data.read;
      total.added += res.data.added;
      total.failed.push(...res.data.failed);
      if (res.data.remaining === 0 || res.data.added + res.data.failed.length === 0) break; // nothing moved: do not ask forever
    }
    setBusy(false);
    setDone(total);
    setPreview(null);
    setCsv(null);
    onDone();
  }

  async function choose(file: File | undefined) {
    setDone(null);
    setPreview(null);
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    await run(text, false);
  }

  return (
    <details className="rounded-2xl border-2 border-line p-4">
      <summary className="cursor-pointer text-lg font-bold">{t`シート（CSV）から取り込む`}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-base text-muted">{t`現地調査のシート（CSV）を選ぶと、まず件数を表示します。取り込んだ場所はすべて下書きで、位置は「未確認」のままです。すでにある場所は追加しません。`}</p>
        <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => void choose(e.target.files?.[0])} className="text-base" />
        {preview && csv ? (
          <div className="flex flex-col gap-2">
            <p className="text-lg font-bold">{t`${preview.read}件を読みました。新しい場所：${preview.added}件、すでにある場所：${preview.skipped}件`}</p>
            {preview.failed.length > 0 ? <Failed items={preview.failed} /> : null}
            <button type="button" disabled={busy || preview.added === 0} onClick={() => void run(csv, true)} className="tap-target w-fit rounded-xl bg-ink px-5 text-lg font-bold text-paper disabled:opacity-50">
              {t`${preview.added}件を取り込む`}
            </button>
          </div>
        ) : null}
        {done ? (
          <div role="status" className="flex flex-col gap-2">
            <p className="text-lg font-bold">{t`${done.added}件を取り込みました（下書き）。`}</p>
            {done.failed.length > 0 ? <Failed items={done.failed} /> : null}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-lg font-bold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function Failed({ items }: { items: Counts["failed"] }) {
  const { t } = useLingui();
  return (
    <div role="alert" className="text-base text-danger">
      <p className="font-bold">{t`取り込めなかった場所（${items.length}件）`}</p>
      <ul className="list-disc pl-6">
        {items.slice(0, 20).map((f, i) => (
          <li key={i}>
            {f.name}（{f.reason}）
          </li>
        ))}
      </ul>
    </div>
  );
}
