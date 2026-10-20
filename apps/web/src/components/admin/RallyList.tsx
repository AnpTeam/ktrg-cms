"use client";

import Link from "next/link";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import { moveId } from "@/lib/admin/route-list";
import type { AdminRally } from "@/lib/admin/types";

// Every rally in the order visitors see them: its type, whether it is public, how much is in it, how many finished.
// 前へ / 後ろへ save the order at once; 新しいラリー opens the form that picks places or courses.
export function RallyList({ initial, locale }: { initial: AdminRally[]; locale: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [rallies, setRallies] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (r: AdminRally) => (locale === "en" && r.nameEn ? r.nameEn : r.nameJa);

  async function move(id: string, step: -1 | 1) {
    if (busy) return;
    const before = rallies;
    const ids = moveId(rallies.map((r) => r.id), id, step);
    const byId = new Map(rallies.map((r) => [r.id, r]));
    setRallies(ids.map((i) => byId.get(i)!));
    setBusy(true);
    setError(null);
    const res = await outcome(api.admin.rallies.order.put({ ids }));
    if (!res.ok) {
      setRallies(before); // the order on screen must be the order that was saved
      setError(messages[res.key]);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/rallies/new" className="tap-target inline-flex w-fit items-center rounded-xl bg-brand px-5 text-lg font-bold text-on-brand">
        {t`新しいラリー`}
      </Link>
      {error ? (
        <p role="alert" className="rounded-xl bg-surface p-4 text-lg font-bold text-danger">
          {error}
        </p>
      ) : null}
      {rallies.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">{t`ラリーがまだありません。「新しいラリー」から作ってください。`}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {rallies.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-on-brand">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/rallies/${r.id}`} className="text-xl font-bold text-accent underline underline-offset-4">
                  {name(r)}
                </Link>
                <p className="text-base text-muted">
                  {r.kind === "places" ? t`場所 ${r.memberCount}` : t`コース ${r.memberCount}`}
                  {" ・ "}
                  {r.published ? t`公開中` : t`下書き`}
                  {" ・ "}
                  {t`達成した人 ${r.completionCount}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy || i === 0} onClick={() => move(r.id, -1)} aria-label={t`${name(r)} を1つ前へ`} className="tap-target min-w-14 rounded-xl border-2 border-line px-3 text-base font-bold disabled:opacity-40">
                  {t`前へ`}
                </button>
                <button type="button" disabled={busy || i === rallies.length - 1} onClick={() => move(r.id, 1)} aria-label={t`${name(r)} を1つ後ろへ`} className="tap-target min-w-14 rounded-xl border-2 border-line px-3 text-base font-bold disabled:opacity-40">
                  {t`後ろへ`}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
