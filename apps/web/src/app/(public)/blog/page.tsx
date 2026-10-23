import Link from "next/link";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { Localized } from "@/components/Localized";
import { RoutePhoto } from "@/components/RoutePhoto";
import { initLingui } from "@/i18n/server";
import { formatDay } from "@/lib/format";
import { pickText } from "@/lib/pick-text";
import { listPosts } from "@/lib/posts";
import { plainBody } from "@/lib/rich-text";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ブログ`) };
}

/** How much of a post the list shows under its heading. */
const EXCERPT_CHARS = 120;

// The blog: posts written in the admin (/admin/posts). The API sends only what a visitor may read, so this page
// never decides about drafts or posts dated ahead.
export default async function BlogPage() {
  const i18n = await initLingui();
  const posts = await listPosts();

  return (
    <div className="page-narrow flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold">
          <Trans>ブログ</Trans>
        </h1>
        <p className="max-w-prose text-lg leading-8">
          <Trans>葛城修験の道のことや、歩いた日のことをお知らせします。</Trans>
        </p>
      </div>

      {posts.length === 0 ? (
        <EmptyState title={<Trans>記事は、まだありません。</Trans>}>
          <Trans>書けたら、ここに表示されます。</Trans>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3 px-4">
          {posts.map((post) => {
            const title = pickText(i18n.locale, post.titleJa, post.titleEn);
            const body = pickText(i18n.locale, post.bodyJa, post.bodyEn);
            const excerpt = body ? plainBody(body.text).slice(0, EXCERPT_CHARS) : "";
            return (
              <li key={post.id}>
                <Link href={`/blog/${post.id}`} className="tap-target flex flex-col gap-3 rounded-xl bg-surface p-4 hover:bg-paper">
                  <div className="flex items-start gap-4">
                    <span className="relative size-24 shrink-0 overflow-hidden rounded-lg">
                      <RoutePhoto src={post.coverPhotoUrl} alt={title?.text ?? ""} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-xl font-bold text-accent">
                        <Localized value={title} />
                      </span>
                      <time dateTime={post.publishedOn} className="text-base text-muted">
                        {formatDay(i18n.locale, post.publishedOn)}
                      </time>
                      {excerpt ? <span className="line-clamp-2 text-lg leading-8">{excerpt}</span> : null}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
