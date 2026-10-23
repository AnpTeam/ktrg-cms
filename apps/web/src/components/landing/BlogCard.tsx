import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { ChevronIcon } from "@/components/icons";
import { Localized } from "@/components/Localized";
import { formatDay } from "@/lib/format";
import { pickText } from "@/lib/pick-text";
import type { BlogPost } from "@/lib/posts";

/** How many of the newest posts the home page shows. */
export const HOME_POSTS = 3;

/**
 * The newest blog posts on the home page, with a link to the rest. Renders nothing when there are no posts, so a
 * blog that has not started yet leaves no empty box; unlike the notices card, this one does not depend on anything
 * else being there, so the blog is always reachable once a post exists.
 */
export function BlogCard({ posts, locale }: { posts: BlogPost[]; locale: string }) {
  if (posts.length === 0) return null;
  return (
    <section className="mx-4 rounded-3xl bg-surface p-5">
      <h2 className="text-2xl font-bold text-accent">
        <Trans>ブログ</Trans>
      </h2>
      <ul className="mt-2 divide-y divide-line/30">
        {posts.slice(0, HOME_POSTS).map((post) => (
          <li key={post.id}>
            <Link href={`/blog/${post.id}`} className="tap-target flex items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="text-xl font-bold leading-snug">
                  <Localized value={pickText(locale, post.titleJa, post.titleEn)} />
                </span>
                <time dateTime={post.publishedOn} className="mt-1 text-base text-muted">
                  {formatDay(locale, post.publishedOn)}
                </time>
              </span>
              <ChevronIcon />
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/blog" className="tap-target mt-2 flex items-center justify-between gap-3 rounded-2xl bg-paper px-5 text-xl font-bold text-accent">
        <Trans>ブログをすべて見る</Trans>
        <ChevronIcon />
      </Link>
    </section>
  );
}
