"use client";

import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Pager } from "@/components/Pager";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode, type ErrorKey } from "@/lib/api-error";
import { pageCount, pageSlice } from "@/lib/pager";
import { fileName, filterPhotos, formatSize, sortPhotos, type LibraryPhoto, type SortDir, type SortKey } from "@/lib/admin/photo-library";
import { inputClass } from "./fields";

const PAGE = 30;

type Loaded = { state: "loading" } | { state: "ready"; photos: LibraryPhoto[] } | { state: "error"; key: ErrorKey };

/** GET /admin/uploads: every photo uploaded so far, newest first. */
async function fetchLibrary(): Promise<Loaded> {
  try {
    const res = await fetch("/api/v1/admin/uploads", { credentials: "same-origin" });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; photos?: unknown } | null;
    if (res.ok && json?.ok === true && Array.isArray(json.photos)) return { state: "ready", photos: json.photos as LibraryPhoto[] };
    return { state: "error", key: json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json) };
  } catch {
    return { state: "error", key: "network" };
  }
}

/**
 * A button that opens the photo library: the photos already uploaded to the site, so an editor can pick one again
 * instead of uploading it twice. `onPicked` gets the photo's https link, the same as an upload does.
 */
export function PhotoLibraryButton({ onPicked, disabled = false }: { onPicked: (url: string) => void; disabled?: boolean }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="tap-target inline-flex w-fit items-center rounded-xl border-2 border-line px-5 text-lg font-bold disabled:opacity-40"
      >
        {t`アップロード済みの写真から選ぶ`}
      </button>
      {open ? (
        <PhotoLibraryDialog
          onClose={() => setOpen(false)}
          onPick={(url) => {
            setOpen(false);
            onPicked(url);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * A native <dialog> (focus, Escape and the backdrop come for free), mounted only while open so the list is read fresh. It
 * works like a file picker: a search box, a table sorted by date, name or size (click a heading), or tiles; one click selects
 * a photo, a double click or 「この写真を使う」 chooses it.
 */
function PhotoLibraryDialog({ onClose, onPick }: { onClose: () => void; onPick: (url: string) => void }) {
  const { t, i18n } = useLingui();
  const messages = useErrorMessages();
  const ref = useRef<HTMLDialogElement>(null);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "desc" });
  const [view, setView] = useState<"table" | "tiles">("table");
  const [selected, setSelected] = useState<string | null>(null);
  // The photos are full-size files, so only a page of them is drawn at a time (a long list would pull a lot of data).
  const [page, setPage] = useState(1);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    let current = true;
    void fetchLibrary().then((result) => {
      if (current) setLoaded(result);
    });
    return () => {
      current = false;
    };
  }, []);

  const day = new Intl.DateTimeFormat(i18n.locale === "en" ? "en-GB" : "ja-JP", { dateStyle: "medium" });
  const all = loaded.state === "ready" ? loaded.photos : [];
  const rows = sortPhotos(filterPhotos(all, query), sort.key, sort.dir);
  const pages = pageCount(rows.length, PAGE);
  const here = Math.min(page, pages); // a search or a deletion can leave fewer pages than the one we were on
  const chosen = all.find((p) => p.key === selected) ?? null;

  const heading = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2 text-left">
      <button
        type="button"
        onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }))}
        className="inline-flex items-center gap-1 text-base font-bold"
      >
        {label}
        <span aria-hidden="true">{sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
  // A second click on the chosen photo clears the choice.
  const select = (p: LibraryPhoto) => setSelected((cur) => (cur === p.key ? null : p.key));
  const thumb = (p: LibraryPhoto, className: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- a thumbnail of a file in the photo bucket
    <img src={p.url} alt="" loading="lazy" referrerPolicy="no-referrer" className={className} />
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby="photo-library-title"
      onClose={onClose}
      className="m-auto flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden rounded-xl border-2 border-ink bg-paper p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="photo-library-title" className="text-xl font-bold">
              {t`写真ライブラリ`}
            </h2>
            <p className="text-base text-muted">{t`アップロード済みの写真です。選んで「この写真を使う」を押すと、その写真のリンクが入ります。`}</p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="tap-target rounded-xl border-2 border-line px-5 text-lg font-bold">
            {t`閉じる`}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="search" value={query} onChange={(e) => (setQuery(e.target.value), setPage(1))} placeholder={t`名前でさがす`} aria-label={t`名前でさがす`} className={`${inputClass} min-w-48 flex-1`} />
          <label className="flex items-center gap-2 text-base font-bold">
            {t`並べ方`}
            <select
              value={`${sort.key}-${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split("-") as [SortKey, SortDir];
                setSort({ key, dir });
              }}
              className={`${inputClass} w-auto`}
            >
              <option value="date-desc">{t`新しい順`}</option>
              <option value="date-asc">{t`古い順`}</option>
              <option value="name-asc">{t`名前順`}</option>
              <option value="size-desc">{t`大きい順`}</option>
              <option value="size-asc">{t`小さい順`}</option>
            </select>
          </label>
          <div role="group" aria-label={t`表示`} className="flex gap-1">
            {(["table", "tiles"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`tap-target rounded-xl border-2 px-4 text-base font-bold ${view === v ? "border-ink bg-ink text-paper" : "border-line"}`}>
                {v === "table" ? t`一覧` : t`タイル`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-48 flex-1 overflow-y-auto p-4">
        {loaded.state === "loading" ? <p className="text-lg">{t`読み込んでいます…`}</p> : null}
        {loaded.state === "error" ? (
          <p role="alert" className="text-base font-bold text-danger">
            {messages[loaded.key]}
          </p>
        ) : null}
        {loaded.state === "ready" && all.length === 0 ? <p className="text-lg">{t`まだ写真がありません。`}</p> : null}
        {loaded.state === "ready" && all.length > 0 && rows.length === 0 ? <p className="text-lg">{t`見つかりませんでした。`}</p> : null}
        {rows.length > 0 && view === "table" ? (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-paper">
              <tr className="border-b-2 border-line">
                {heading("name", t`名前`)}
                {heading("date", t`日付`)}
                {heading("size", t`サイズ`)}
              </tr>
            </thead>
            <tbody>
              {pageSlice(rows, here, PAGE).map((p) => (
                <tr
                  key={p.key}
                  aria-selected={selected === p.key}
                  onClick={() => select(p)}
                  onDoubleClick={() => onPick(p.url)}
                  className={`cursor-pointer border-b border-line ${selected === p.key ? "bg-surface outline outline-2 -outline-offset-2 outline-accent" : "hover:bg-surface"}`}
                >
                  <td className="px-3 py-2">
                    <button type="button" aria-pressed={selected === p.key} onFocus={(e) => e.currentTarget.matches(":focus-visible") && setSelected(p.key)} className="flex w-full items-center gap-3 text-left text-lg font-bold">
                      {thumb(p, "h-12 w-16 shrink-0 rounded-lg bg-surface object-cover")}
                      <span className="min-w-0 break-all">{fileName(p.key)}</span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-base text-muted">{day.format(new Date(p.uploadedAt))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-base text-muted tabular-nums">{formatSize(p.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {rows.length > 0 && view === "tiles" ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {pageSlice(rows, here, PAGE).map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  aria-pressed={selected === p.key}
                  onClick={() => select(p)}
                  onDoubleClick={() => onPick(p.url)}
                  className={`block w-full overflow-hidden rounded-xl border-2 text-left ${selected === p.key ? "border-accent outline outline-2 outline-accent" : "border-line"}`}
                >
                  {thumb(p, "aspect-video w-full object-cover")}
                  <span className="block truncate px-2 py-1 text-base">{fileName(p.key)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4">
          <Pager page={here} pages={pages} onPage={setPage} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
        <p className="min-w-0 break-all text-base text-muted">{chosen ? `${fileName(chosen.key)}（${formatSize(chosen.size)}）` : t`写真を選んでください。`}</p>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => chosen && onPick(chosen.url)}
          className="tap-target rounded-xl bg-ink px-6 text-lg font-bold text-paper disabled:opacity-40"
        >
          {t`この写真を使う`}
        </button>
      </div>
    </dialog>
  );
}
