"use client";

import Link from "next/link";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import { moveId } from "@/lib/admin/route-list";
import { showToast } from "@/lib/admin/toast";
import { Chip } from "./Chip";
import { MoveButtons, OrderBadge } from "./list-parts";

export type BannerItem = { id: string; imageUrl: string; altJa: string; altEn: string | null; published: boolean };

/** The banners from the top down, each with its photo: the arrows change the order at once. */
export function BannerOrder({ initial, locale }: { initial: BannerItem[]; locale: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function move(id: string, step: -1 | 1) {
    if (busy) return;
    const before = items;
    const ids = moveId(items.map((b) => b.id), id, step);
    const byId = new Map(items.map((b) => [b.id, b]));
    setItems(ids.map((i) => byId.get(i)!));
    setBusy(true);
    const res = await outcome(api.admin.banners.order.put({ ids }));
    if (!res.ok) {
      setItems(before); // the order on screen must be the order that was saved
      showToast({ kind: "error", text: messages[res.key] });
    }
    setBusy(false);
  }

  if (items.length === 0) return <p className="rounded-2xl bg-surface p-6 text-lg">{t`バナーがまだありません。「新しいバナー」から作ってください。`}</p>;
  return (
    <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line">
      {items.map((b, i) => {
        const name = locale === "en" && b.altEn ? b.altEn : b.altJa;
        return (
          <li key={b.id} className="flex flex-wrap items-center gap-3 p-3">
            <OrderBadge n={i + 1} />
            {/* eslint-disable-next-line @next/next/no-img-element -- an admin's own photo, on any allowed host */}
            <img src={b.imageUrl} alt="" className="h-20 w-32 shrink-0 rounded-md bg-surface object-cover" />
            <div className="flex min-w-40 flex-1 flex-col items-start gap-1">
              <Link href={`/admin/banners/${b.id}`} className="break-words text-lg font-bold text-accent underline underline-offset-4">
                {name}
              </Link>
              <Chip tone={b.published ? "good" : "neutral"}>{b.published ? t`公開中` : t`下書き`}</Chip>
            </div>
            <MoveButtons name={name} canEarlier={i > 0} canLater={i < items.length - 1} onMove={(step) => void move(b.id, step)} busy={busy} />
          </li>
        );
      })}
    </ol>
  );
}
