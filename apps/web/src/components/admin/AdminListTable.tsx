"use client";

import Link from "next/link";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { inputClass } from "./fields";
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
  // What the list is narrowed by: the search words and "field value" choices (as typed, and as last applied).
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState("");
  const filterFields = config.fields.filter((f) => f.kind === "select" || f.kind === "boolean" || f.kind === "route");
  const base = `/admin/${config.key}`;
  const name = (item: (typeof items)[number]) => itemName(config, item, locale);
  const title = pick(config.title, locale);

  const queryOf = (words: string, choices: Record<string, string>) => {
    const params = new URLSearchParams();
    if (words.trim()) params.set("q", words.trim());
    for (const [name, value] of Object.entries(choices)) if (value !== "") params.append("filter", `${name}:${value}`);
    return params.toString();
  };

  /** Read the first page again with the search words and choices. */
  async function search(words: string, choices: Record<string, string>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const query = queryOf(words, choices);
    const res = await listRequest<ListPage>("GET", query ? `${config.key}?${query}` : config.key);
    setBusy(false);
    if (!res.ok) return setError(messages[res.key]);
    setItems(res.data.items);
    setNext(res.data.next);
    setApplied(query);
  }

  async function more() {
    if (!next || busy) return;
    setBusy(true);
    setError(null);
    const res = await listRequest<ListPage>("GET", `${config.key}?${applied ? `${applied}&` : ""}cursor=${encodeURIComponent(next)}`);
    setBusy(false);
    if (!res.ok) return setError(messages[res.key]);
    setItems((now) => [...now, ...res.data.items]);
    setNext(res.data.next);
  }

  return (
    <div className="flex flex-col gap-4">
      {config.ops.create && config.newLabel ? (
        <Link href={`${base}/new`} className="tap-target inline-flex w-fit items-center rounded-xl bg-ink px-5 text-lg font-bold text-paper">
          {pick(config.newLabel, locale)}
        </Link>
      ) : null}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q, picked);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-base font-bold">
          {t`さがす`}
          <input type="search" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} className={inputClass} />
        </label>
        {filterFields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1 text-base font-bold">
            {pick(f.label, locale)}
            <select
              value={picked[f.name] ?? ""}
              onChange={(e) => {
                const next = { ...picked, [f.name]: e.target.value };
                setPicked(next);
                void search(q, next);
              }}
              className={`${inputClass} min-w-36`}
            >
              <option value="">{t`すべて`}</option>
              {f.kind === "boolean" ? (
                <>
                  <option value="true">{t`はい`}</option>
                  <option value="false">{t`いいえ`}</option>
                </>
              ) : f.kind === "select" ? (
                (f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {pick(o.label, locale)}
                  </option>
                ))
              ) : (
                Object.entries(routeNames).map(([id, routeName]) => (
                  <option key={id} value={id}>
                    {routeName}
                  </option>
                ))
              )}
            </select>
          </label>
        ))}
        <button type="submit" disabled={busy} className="tap-target rounded-xl border-2 border-line px-5 text-lg font-bold disabled:opacity-50">
          {t`探す`}
        </button>
        {applied ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setQ("");
              setPicked({});
              void search("", {});
            }}
            className="tap-target rounded-xl px-3 text-lg font-bold text-accent underline underline-offset-4"
          >
            {t`条件をやめる`}
          </button>
        ) : null}
      </form>
      {error ? (
        <p role="alert" className="rounded-xl bg-surface p-4 text-lg font-bold text-danger">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">{applied ? t`条件に合う${title}はありません。` : t`${title}はまだありません。`}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {items.map((item) => {
            const href = itemHref(config, item);
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
