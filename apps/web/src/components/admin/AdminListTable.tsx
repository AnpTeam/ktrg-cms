"use client";

import Link from "next/link";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { itemFacts, itemHref, itemName, pick, type ListMeta } from "@/lib/admin/lists/config";
import { listRequest, type ListPage } from "@/lib/admin/lists/list-client";

// Any generic admin list, drawn from its description (GET /admin/lists) like the rally list: a button for a new row,
// then each row's name (a link to its form) with a short line of facts. Newest first; "もっと見る" loads the next 50.
export function AdminListTable({ meta: config, initial, locale, routeNames }: { meta: ListMeta; initial: ListPage; locale: string; routeNames: Record<string, string> }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/${locale}/admin/${config.key}`;
  const name = (item: (typeof items)[number]) => itemName(config, item, locale);
  const title = pick(config.title, locale);

  async function more() {
    if (!next || busy) return;
    setBusy(true);
    setError(null);
    const res = await listRequest<ListPage>("GET", `${config.key}?cursor=${encodeURIComponent(next)}`);
    setBusy(false);
    if (!res.ok) return setError(messages[res.key]);
    setItems((now) => [...now, ...res.data.items]);
    setNext(res.data.next);
  }

  return (
    <div className="flex flex-col gap-4">
      {config.ops.create && config.newLabel ? (
        <Link href={`${base}/new`} className="tap-target inline-flex w-fit items-center rounded-xl bg-brand px-5 text-lg font-bold text-on-brand">
          {pick(config.newLabel, locale)}
        </Link>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-surface p-4 text-lg font-bold text-danger">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">{t`${title}はまだありません。`}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {items.map((item) => {
            const href = itemHref(config, item, locale);
            return (
            <li key={item.id} className="p-3">
              {href ? (
                <Link href={href} className="text-xl font-bold text-accent underline underline-offset-4">
                  {name(item)}
                </Link>
              ) : (
                <p className="text-xl font-bold">{name(item)}</p>
              )}
              <p className="text-base text-muted">{itemFacts(config, item, locale, (id) => routeNames[id] ?? null).join(" ・ ")}</p>
            </li>
            );
          })}
        </ul>
      )}
      {next ? (
        <button type="button" onClick={more} disabled={busy} className="tap-target w-fit rounded-xl border-2 border-line px-6 text-lg font-bold disabled:opacity-50">
          {t`もっと見る`}
        </button>
      ) : null}
    </div>
  );
}
