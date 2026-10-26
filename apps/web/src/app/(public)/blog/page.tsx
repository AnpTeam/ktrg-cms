import Link from "next/link";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { PostCard } from "@/components/blog/PostCard";
import { initLingui } from "@/i18n/server";
import { listPosts } from "@/lib/posts";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ブログ`) };
}

/** Posts on a page after the big first one. */
const PER_PAGE = 9;

// The blog, as a magazine: the newest post large, then the rest as cards, a few pages of them. The API sends only what a
// visitor may read, so this page never decides about drafts or posts dated ahead.
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const i18n = await initLingui();
  const posts = await listPosts();
  const [feature, ...rest] = posts;
  const pages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number((await searchParams).page)) || 1));
  const shown = rest.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const href = (n: number) => (n === 1 ? "/blog" : `/blog?page=${n}`);
  const pager = "tap-target inline-flex items-center rounded-xl border-2 border-ink px-5 text-lg font-bold hover:bg-surface";

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-4 px-4 lg:px-0">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <div className="flex flex-col gap-2 border-b-2 border-ink pb-4">
          <h1 className="font-serif text-4xl font-bold">
            <Trans>ブログ</Trans>
          </h1>
          <p className="max-w-prose text-lg leading-8 text-muted">
            <Trans>葛城修験の道のことや、歩いた日のことをお知らせします。</Trans>
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState title={<Trans>記事は、まだありません。</Trans>}>
          <Trans>書けたら、ここに表示されます。</Trans>
        </EmptyState>
      ) : (
        <>
          {page === 1 && feature ? (
            <div className="px-4 lg:px-0">
              <PostCard post={feature} locale={i18n.locale} size="feature" />
            </div>
          ) : null}

          {shown.length > 0 ? (
            <section className="flex flex-col gap-4 px-4 lg:px-0">
              <h2 className="text-2xl font-bold">
                <Trans>新しい記事</Trans>
              </h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((post) => (
                  <li key={post.id}>
                    <PostCard post={post} locale={i18n.locale} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pages > 1 ? (
            <nav aria-label={i18n._(msg`ページ`)} className="flex items-center justify-between gap-3 px-4 lg:px-0">
              {page > 1 ? (
                <Link href={href(page - 1)} className={pager}>
                  <Trans>← 前へ</Trans>
                </Link>
              ) : (
                <span />
              )}
              <span className="text-lg tabular-nums text-muted">
                {page} / {pages}
              </span>
              {page < pages ? (
                <Link href={href(page + 1)} className={pager}>
                  <Trans>次へ →</Trans>
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
