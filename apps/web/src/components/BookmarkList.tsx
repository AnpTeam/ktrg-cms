"use client";

import Link from "next/link";
import { useLingui } from "@lingui/react/macro";
import { pickText } from "@/lib/pick-text";
import { BookmarkIcon, ChevronIcon } from "./icons";
import { EmptyState } from "./EmptyState";
import { useBookmarks } from "./useBookmarks";

/** The routes and rallies saved with the bookmark button, each a link with its stamp progress, and a button to remove it. */
export function BookmarkList({
  locale,
  routes,
  rallies = [],
}: {
  locale: string;
  routes: { id: string; nameJa: string; nameEn: string | null; status: "ready" | "soon"; stampedCount: number | null; spotCount: number }[];
  /** The rallies that can be saved too (same list as the routes). */
  rallies?: { id: string; nameJa: string; nameEn: string | null; total: number; stamped: number | null }[];
}) {
  const { t } = useLingui();
  const { list, toggle } = useBookmarks();
  // The saved ids in saved order; a route or rally that is no longer published is left out.
  const saved = list.flatMap((id) => {
    const route = routes.find((r) => r.id === id);
    if (route) {
      const soon = route.status === "soon" || route.spotCount === 0;
      return [{ id, href: `/routes/${id}`, name: pickText(locale, route.nameJa, route.nameEn)?.text ?? route.nameJa, soon, stamped: route.stampedCount ?? 0, total: route.spotCount, rally: false }];
    }
    const rally = rallies.find((r) => r.id === id);
    if (rally) return [{ id, href: `/rallies/${id}`, name: pickText(locale, rally.nameJa, rally.nameEn)?.text ?? rally.nameJa, soon: rally.total === 0, stamped: rally.stamped ?? 0, total: rally.total, rally: true }];
    return [];
  });
  if (saved.length === 0) {
    return (
      <EmptyState title={t`ブックマークは、まだありません。`}>
        {t`ルートやラリーのページで、しおりのボタンを押すと、ここに保存されます。ログインしていれば、アカウントに保存されます。`}
      </EmptyState>
    );
  }
  return (
    <ul className="mx-4 flex flex-col gap-3">
      {saved.map((b) => (
        <li key={b.id} className="flex items-center gap-2 rounded-2xl bg-surface">
          <Link href={b.href} className="tap-target flex min-w-0 flex-1 items-center justify-between gap-3 px-5 py-3 text-xl font-bold text-accent">
            <span className="min-w-0">
              <span className="block text-base font-normal text-muted">{b.rally ? t`ラリー` : t`ルート`}</span>
              <span className="block break-words">{b.name}</span>
              <span className="block text-base font-normal text-muted">{b.soon ? t`準備中` : t`スタンプ ${b.stamped} / ${b.total}`}</span>
            </span>
            <ChevronIcon />
          </Link>
          <button type="button" onClick={() => toggle(b.id)} aria-label={t`${b.name}のブックマークをはずす`} className="tap-target flex size-12 shrink-0 items-center justify-center text-accent">
            <BookmarkIcon filled />
          </button>
        </li>
      ))}
    </ul>
  );
}
