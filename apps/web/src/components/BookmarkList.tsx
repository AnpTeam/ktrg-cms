"use client";

import Link from "next/link";
import { useLingui } from "@lingui/react/macro";
import { pickText } from "@/lib/pick-text";
import { BookmarkIcon, ChevronIcon } from "./icons";
import { EmptyState } from "./EmptyState";
import { useBookmarks } from "./useBookmarks";

/** The routes saved with the bookmark button on a route page, each a link, with a button to remove it. */
export function BookmarkList({ locale }: { locale: string }) {
  const { t } = useLingui();
  const { list, toggle } = useBookmarks();
  if (list.length === 0) {
    return (
      <EmptyState title={t`ブックマークは、まだありません。`}>
        {t`ルートのページで、しおりのボタンを押すと、ここに保存されます。この端末だけに保存されます。`}
      </EmptyState>
    );
  }
  return (
    <ul className="mx-4 flex flex-col gap-3">
      {list.map((b) => {
        const name = pickText(locale, b.nameJa, b.nameEn)?.text ?? b.nameJa;
        return (
          <li key={b.id} className="flex items-center gap-2 rounded-2xl bg-surface">
            <Link href={`/routes/${b.id}`} className="tap-target flex min-w-0 flex-1 items-center justify-between gap-3 px-5 py-3 text-xl font-bold text-accent">
              <span className="min-w-0 break-words">{name}</span>
              <ChevronIcon />
            </Link>
            <button type="button" onClick={() => toggle(b)} aria-label={t`${name}のブックマークをはずす`} className="tap-target flex size-12 shrink-0 items-center justify-center text-accent">
              <BookmarkIcon filled />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
