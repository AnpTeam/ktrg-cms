"use client";

import Link from "next/link";
import { useLingui } from "@lingui/react/macro";
import { formatDay } from "@/lib/format";
import { pickText } from "@/lib/pick-text";
import { BookmarkIcon, ChevronIcon } from "./icons";
import { EmptyState } from "./EmptyState";
import { useBookmarks } from "./useBookmarks";

type Saved = { id: string; href: string; name: string; soon: boolean; stamped: number; total: number; kind: "route" | "rally" | "post"; detail: string | null };

/** The routes, rallies and blog posts saved with the bookmark button, each a link (with its stamp progress, or a post's date), and a button to remove it. */
export function BookmarkList({
  locale,
  routes,
  rallies = [],
  posts = [],
}: {
  locale: string;
  routes: { id: string; nameJa: string; nameEn: string | null; status: "ready" | "soon"; stampedCount: number | null; spotCount: number }[];
  /** The rallies that can be saved too (same list as the routes). */
  rallies?: { id: string; nameJa: string; nameEn: string | null; total: number; stamped: number | null }[];
  /** The blog posts that can be saved too (same list again). */
  posts?: { id: string; titleJa: string; titleEn: string | null; publishedOn: string }[];
}) {
  const { t } = useLingui();
  const { list, toggle } = useBookmarks();
  // The saved ids in saved order; a route or rally that is no longer published is left out.
  const saved = list.flatMap((id): Saved[] => {
    const route = routes.find((r) => r.id === id);
    if (route) {
      const soon = route.status === "soon" || route.spotCount === 0;
      return [{ id, href: `/routes/${id}`, name: pickText(locale, route.nameJa, route.nameEn)?.text ?? route.nameJa, soon, stamped: route.stampedCount ?? 0, total: route.spotCount, kind: "route", detail: null }];
    }
    const rally = rallies.find((r) => r.id === id);
    if (rally) return [{ id, href: `/rallies/${id}`, name: pickText(locale, rally.nameJa, rally.nameEn)?.text ?? rally.nameJa, soon: rally.total === 0, stamped: rally.stamped ?? 0, total: rally.total, kind: "rally", detail: null }];
    const post = posts.find((p) => p.id === id);
    if (post) return [{ id, href: `/blog/${id}`, name: pickText(locale, post.titleJa, post.titleEn)?.text ?? post.titleJa, soon: false, stamped: 0, total: 0, kind: "post", detail: formatDay(locale, post.publishedOn) }];
    return [];
  });
  if (saved.length === 0) {
    return (
      <EmptyState title={t`ブックマークは、まだありません。`}>
        {t`ルートやラリー、ブログの記事で、しおりのボタンを押すと、ここに保存されます。ログインしていれば、アカウントに保存されます。`}
      </EmptyState>
    );
  }
  return (
    <ul className="mx-4 flex flex-col gap-3">
      {saved.map((b) => (
        <li key={b.id} className="flex items-center gap-2 rounded-[1.75rem] bg-surface">
          <Link href={b.href} className="tap-target flex min-w-0 flex-1 items-center justify-between gap-3 px-5 py-3 text-xl font-bold text-accent">
            <span className="min-w-0">
              <span className="block text-base font-normal text-muted">{b.kind === "rally" ? t`ラリー` : b.kind === "post" ? t`ブログ` : t`ルート`}</span>
              <span className="block break-words">{b.name}</span>
              <span className="block text-base font-normal text-muted">{b.detail ?? (b.soon ? t`準備中` : t`スタンプ ${b.stamped} / ${b.total}`)}</span>
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
