"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Pager } from "@/components/Pager";
import { useErrorMessages } from "@/components/useErrorMessages";
import { Chip } from "./Chip";
import { FilterGroup, SortHeader } from "./list-parts";
import { DuplicateFinder } from "./DuplicateFinder";
import { PlaceImport } from "./PlaceImport";
import { inputClass } from "./fields";
import { cellOf, itemHref, itemName, listColumns, nameIsFallback, pick, type FieldUi, type ListMeta } from "@/lib/admin/lists/config";
import { listRequest, type ListPage } from "@/lib/admin/lists/list-client";
import { nextSort, sortItems, type Sort } from "@/lib/admin/lists/sort";

// A soft shadow on the right edge while more columns wait to be scrolled to (the cover is `local`, so it moves away at the end).
const edgeShadow = { background: "linear-gradient(to left, var(--color-paper) 30%, transparent) right / 2.5rem 100% local no-repeat, linear-gradient(to left, rgb(0 0 0 / 0.18), transparent) right / 0.9rem 100% scroll no-repeat" };

// Any generic admin list, drawn from its description (GET /admin/lists) like the rally list: a button for a new row,
// then a table (a card per row on a phone) with each row's name (a link to its form) and one column per `inList` field.
// Newest first, 50 to a page; the pager goes to the next or previous page or to a page typed in.
export function AdminListTable({ meta: config, initial, locale, choices }: { meta: ListMeta; initial: ListPage; locale: string; choices: Record<string, { id: string; name: string; detail?: string }[]> }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page ?? 1);
  const [pages, setPages] = useState(initial.pages ?? 1);
  const [total, setTotal] = useState(initial.total ?? initial.items.length);
  const [capped, setCapped] = useState(initial.capped ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The rows ticked for deleting (only a list that can delete shows the boxes).
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  // What the list is narrowed by: the search words and "field value" choices (as typed, and as last applied).
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState("");
  const filterFields = config.fields.filter((f) => f.kind === "select" || f.kind === "boolean" || f.kind === "route" || f.kind === "relation");
  // The filters on a column are shown as buttons above the list; the rest wait behind "more filters".
  const shownFilters = filterFields.filter((f) => f.inList && f.kind !== "route" && f.kind !== "relation" && filterChoices(f, locale).length <= 6);
  const moreFilters = filterFields.filter((f) => !shownFilters.includes(f));
  // The order of the rows on the page: the list's own (newest first) until a column header is pressed.
  const [sort, setSort] = useState<Sort>(null);
  const base = `/admin/${config.key}`;
  const name = (item: (typeof items)[number]) => itemName(config, item, locale);
  const title = pick(config.title, locale);
  const columns = listColumns(config);
  const lookup = (id: string, field: string) => choices[field]?.find((c) => c.id === id)?.name ?? null;
  const rows = useMemo(() => sortItems(items, config, sort, locale, lookup), [items, config, sort, locale]); // eslint-disable-line react-hooks/exhaustive-deps -- lookup only reads `choices`

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
    setTicked(new Set()); // what was ticked may no longer be on the page
    const query = queryOf(words, choices);
    const res = await listRequest<ListPage>("GET", `${config.key}?${query ? `${query}&` : ""}page=1`);
    setBusy(false);
    if (!res.ok) return setError(messages[res.key]);
    show(res.data);
    setApplied(query);
  }

  /** Put a page the API sent on the screen. */
  function show(data: ListPage) {
    setItems(data.items);
    setPage(data.page ?? 1);
    setPages(data.pages ?? 1);
    setTotal(data.total ?? data.items.length);
    setCapped(data.capped ?? false);
  }

  /** Go to a page of the list as it is narrowed now. Returns false when it could not be read. */
  async function goTo(n: number): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    setTicked(new Set());
    const res = await listRequest<ListPage>("GET", `${config.key}?${applied ? `${applied}&` : ""}page=${n}`);
    setBusy(false);
    if (!res.ok) {
      setError(messages[res.key]);
      return false;
    }
    show(res.data);
    return true;
  }

  /** Delete rows one by one; the ones that went are dropped from the page, and what could not be deleted is reported. */
  async function removeRows(ids: string[]) {
    if (busy || ids.length === 0) return;
    const one = ids.length === 1 ? items.find((i) => i.id === ids[0]) : undefined;
    const ask = one ? (config.deleteWarning ? pick(config.deleteWarning, locale) : t`「${name(one)}」を削除します。元に戻せません。よろしいですか？`) : t`選んだ${ids.length}件を削除します。元に戻せません。よろしいですか？`;
    if (!window.confirm(ask)) return;
    setBusy(true);
    setError(null);
    const gone = new Set<string>();
    let failure: string | null = null;
    for (const id of ids) {
      const res = await listRequest("DELETE", `${config.key}/${id}`);
      if (res.ok) gone.add(id);
      else failure = messages[res.key];
    }
    setBusy(false);
    setTicked(new Set());
    if (gone.size > 0) await goTo(page); // the counts and the page change when rows go
    if (failure) setError(gone.size > 0 ? t`${gone.size}件を削除しました。残りは削除できませんでした：${failure}` : failure);
  }

  const canDelete = config.ops.delete;
  const allTicked = items.length > 0 && items.every((i) => ticked.has(i.id));
  const toggle = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const shownFilterGroups = shownFilters.map((f) => (
    <FilterGroup
      key={f.name}
      label={pick(f.label, locale)}
      options={filterChoices(f, locale)}
      value={picked[f.name] ?? ""}
      disabled={busy}
      onChange={(value) => {
        const next = { ...picked, [f.name]: value };
        setPicked(next);
        void search(q, next);
      }}
    />
  ));

  const moreGrid = (
    <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
      {moreFilters.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm font-bold">
          {pick(f.label, locale)}
          <select
            value={picked[f.name] ?? ""}
            onChange={(e) => {
              const next = { ...picked, [f.name]: e.target.value };
              setPicked(next);
              void search(q, next);
            }}
            className={inputClass}
          >
            <option value="">{t`すべて`}</option>
            {f.kind === "select" || f.kind === "boolean"
              ? filterChoices(f, locale).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.text}
                  </option>
                ))
              : (choices[f.name] ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
          </select>
        </label>
      ))}
    </div>
  );

  const pickedCount = [...shownFilters, ...moreFilters].filter((f) => (picked[f.name] ?? "") !== "").length;

  return (
    <div className="flex flex-col gap-4">
      {config.ops.create && config.newLabel ? (
        <Link href={`${base}/new`} className="tap-target inline-flex w-fit items-center rounded-xl bg-ink px-5 text-lg font-bold text-paper">
          {pick(config.newLabel, locale)}
        </Link>
      ) : null}
      {config.key === "directory" ? <PlaceImport onDone={() => void search(q, picked)} /> : null}
      {config.key === "directory" ? <DuplicateFinder meta={config} locale={locale} choices={choices} onChanged={() => void search(q, picked)} /> : null}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q, picked);
        }}
        className="flex flex-col gap-3 rounded-2xl bg-surface p-3"
      >
        <div className="flex flex-wrap items-center gap-3">
          <input type="search" aria-label={t`さがす`} placeholder={t`さがす`} value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} className={`${inputClass} min-w-48 flex-1`} />
          <button type="submit" disabled={busy} className="tap-target rounded-xl bg-ink px-5 text-lg font-bold text-paper disabled:opacity-50">
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
        </div>
        {shownFilters.length > 2 ? (
          // One fold for every filter: the buttons, then the lists.
          <details className="group" open={pickedCount > 0 || undefined}>
            <summary className="tap-target flex w-fit cursor-pointer list-none items-center gap-2 text-base font-bold text-accent [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
              {t`絞りこみ`}
              {pickedCount > 0 ? <span className="rounded-full bg-ink px-2 text-sm text-paper">{pickedCount}</span> : null}
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              {shownFilterGroups}
              {moreFilters.length > 0 ? moreGrid : null}
            </div>
          </details>
        ) : (
          <>
            {shownFilterGroups}
            {moreFilters.length > 0 ? (
              <details className="group" open={moreFilters.some((f) => (picked[f.name] ?? "") !== "") || undefined}>
                <summary className="tap-target flex w-fit cursor-pointer list-none items-center gap-2 text-base font-bold text-accent [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
                  {t`ほかの絞りこみ`}
                  {moreFilters.filter((f) => (picked[f.name] ?? "") !== "").length > 0 ? <span className="rounded-full bg-ink px-2 text-sm text-paper">{moreFilters.filter((f) => (picked[f.name] ?? "") !== "").length}</span> : null}
                </summary>
                {moreGrid}
              </details>
            ) : null}
          </>
        )}
      </form>
      {error ? (
        <p role="alert" className="rounded-xl bg-surface p-4 text-lg font-bold text-danger">
          {error}
        </p>
      ) : null}
      {canDelete && items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="tap-target flex items-center gap-2 text-base font-bold">
            <input type="checkbox" checked={allTicked} onChange={() => setTicked(allTicked ? new Set() : new Set(items.map((i) => i.id)))} className="size-5" />
            {t`このページをすべて選ぶ`}
          </label>
          {ticked.size > 0 ? (
            <button type="button" disabled={busy} onClick={() => void removeRows([...ticked])} className="tap-target rounded-xl border-2 border-danger px-4 text-base font-bold text-danger disabled:opacity-50">
              {t`選んだ${ticked.size}件を削除`}
            </button>
          ) : null}
        </div>
      ) : null}
      {items.length > 0 ? (
        <p className="text-base font-bold text-muted" aria-live="polite">
          {capped ? t`先頭の${total}件を表示しています。` : t`${total}件`}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">{applied ? t`条件に合う${title}はありません。` : t`${title}はまだありません。`}</p>
      ) : (
        <>
          {/* A table on a wide screen: one column per fact, so a column can be read from top to bottom. */}
          <div className="relative hidden overflow-x-auto rounded-2xl border border-line md:block" style={edgeShadow}>
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface text-base">
                <tr>
                  {canDelete ? <th scope="col" className="w-12 p-3"><span className="sr-only">{t`選ぶ`}</span></th> : null}
                  <SortHeader label={t`名前`} sortKey="name" sort={sort} onSort={(key) => setSort(nextSort(sort, key))} />
                  {columns.map((f) => (
                    <SortHeader key={f.name} label={pick(f.label, locale)} sortKey={f.name} sort={sort} onSort={(key) => setSort(nextSort(sort, key))} />
                  ))}
                  {canDelete ? <th scope="col" className="w-24 p-3"><span className="sr-only">{t`削除`}</span></th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((item) => {
                  const href = itemHref(config, item);
                  return (
                    <tr key={item.id} className="align-top hover:bg-surface/60">
                      {canDelete ? (
                        <td className="p-3">
                          <input type="checkbox" aria-label={t`${name(item)}を選ぶ`} checked={ticked.has(item.id)} onChange={() => toggle(item.id)} className="size-5" />
                        </td>
                      ) : null}
                      <td className="max-w-80 p-3">
                        {href ? (
                          <Link href={href} className="break-words text-lg font-bold text-accent underline underline-offset-4">
                            {name(item) || "—"}
                          </Link>
                        ) : (
                          <p className="break-words text-lg font-bold">{name(item) || "—"}</p>
                        )}
                        {nameIsFallback(config, item) ? <p className="text-base text-muted">{String(item[config.titleField] ?? "")}</p> : null}
                      </td>
                      {columns.map((f) => {
                        const cell = cellOf(f, item, locale, lookup);
                        return (
                          <td key={f.name} className="p-3 text-lg">
                            {cell.chip ? cell.text ? <Chip tone={cell.tone}>{cell.text}</Chip> : null : <span className={cell.text === "—" ? "text-muted" : undefined}>{cell.text}</span>}
                          </td>
                        );
                      })}
                      {canDelete ? (
                        <td className="p-3 text-right">
                          <button type="button" disabled={busy} onClick={() => void removeRows([item.id])} className="tap-target rounded-xl border-2 border-line px-3 text-base font-bold text-danger disabled:opacity-50">
                            {t`削除`}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <label className="flex items-center gap-2 text-base font-bold md:hidden">
            {t`並べかえ`}
            <select
              value={sort ? `${sort.key}:${sort.dir}` : ""}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setSort(key ? { key, dir: dir === "desc" ? "desc" : "asc" } : null);
              }}
              className={`${inputClass} max-w-64`}
            >
              <option value="">{t`新しい順`}</option>
              {[{ key: "name", label: t`名前` }, ...columns.map((f) => ({ key: f.name, label: pick(f.label, locale) }))].flatMap((c) => [
                <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{`${c.label} ↑`}</option>,
                <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{`${c.label} ↓`}</option>,
              ])}
            </select>
          </label>
          {/* A card per row on a phone: the name, then the facts as labelled chips and lines. */}
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line md:hidden">
            {rows.map((item) => {
              const href = itemHref(config, item);
              return (
                <li key={item.id} className="flex items-start gap-3 p-3">
                  {canDelete ? <input type="checkbox" aria-label={t`${name(item)}を選ぶ`} checked={ticked.has(item.id)} onChange={() => toggle(item.id)} className="mt-2 size-5 shrink-0" /> : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div>
                      {href ? (
                        <Link href={href} className="break-words text-xl font-bold text-accent underline underline-offset-4">
                          {name(item) || "—"}
                        </Link>
                      ) : (
                        <p className="break-words text-xl font-bold">{name(item) || "—"}</p>
                      )}
                      {nameIsFallback(config, item) ? <p className="text-base text-muted">{String(item[config.titleField] ?? "")}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      {columns.map((f) => {
                        const cell = cellOf(f, item, locale, lookup);
                        if (cell.text === "") return null;
                        return cell.chip ? (
                          <Chip key={f.name} tone={cell.tone}>
                            {cell.text}
                          </Chip>
                        ) : cell.text === "—" ? null : (
                          <span key={f.name} className="text-base">
                            <span className="text-muted">{pick(f.label, locale)}: </span>
                            {cell.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {canDelete ? (
                    <button type="button" disabled={busy} onClick={() => void removeRows([item.id])} className="tap-target shrink-0 rounded-xl border-2 border-line px-3 text-base font-bold text-danger disabled:opacity-50">
                      {t`削除`}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Pager page={page} pages={pages} disabled={busy} onPage={(n) => void goTo(n)} />
    </div>
  );
}

/** The choices of a select or yes/no field, as buttons or options: its own words, a yes/no by the words the list uses. */
function filterChoices(f: FieldUi, locale: string): { value: string; text: string }[] {
  if (f.kind === "boolean") return [{ value: "true", text: f.inList?.yes ? pick(f.inList.yes, locale) : pick({ ja: "はい", en: "Yes" }, locale) }, { value: "false", text: f.inList?.no ? pick(f.inList.no, locale) : pick({ ja: "いいえ", en: "No" }, locale) }];
  return (f.options ?? []).map((o) => ({ value: o.value, text: pick(o.label, locale) }));
}
