"use client";

import { useLingui } from "@lingui/react/macro";
import { clampPage } from "@/lib/pager";

/** Previous / next and "page [ 3 ] of 12": type a page number and press Enter (or leave the box) to go there. With one page it stays, greyed out, unless `hideWhenSingle`. */
export function Pager({ page, pages, onPage, disabled = false, hideWhenSingle = false }: { page: number; pages: number; onPage: (page: number) => void; disabled?: boolean; hideWhenSingle?: boolean }) {
  const { t } = useLingui();
  if (pages <= 1 && hideWhenSingle) return null;

  // The box is not controlled: it starts from the page (a new page gives it a new key) and is read when committed.
  const go = (box: HTMLInputElement) => {
    const n = clampPage(box.value, pages);
    if (n === null || n === page) box.value = String(page);
    else onPage(n);
  };
  const button = "tap-target rounded-xl border-2 border-line px-5 text-lg font-bold disabled:opacity-50";
  return (
    <nav aria-label={t`ページ`} className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)} className={button}>
        {t`前へ`}
      </button>
      <label className="flex items-center gap-2 text-lg font-bold">
        <span className="sr-only">{t`ページ番号`}</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          key={page}
          defaultValue={page}
          disabled={disabled || pages <= 1}
          onBlur={(e) => go(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go(e.currentTarget);
            }
          }}
          className="tap-target w-20 rounded-xl border-2 border-line bg-paper px-2 text-center text-lg font-bold tabular-nums text-ink"
        />
        <span className="tabular-nums">/ {pages}</span>
      </label>
      <button type="button" disabled={disabled || page >= pages} onClick={() => onPage(page + 1)} className={button}>
        {t`次へ`}
      </button>
    </nav>
  );
}
