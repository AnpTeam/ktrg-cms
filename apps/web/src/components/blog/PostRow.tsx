import Link from "next/link";
import { Localized } from "@/components/Localized";
import { RoutePhoto } from "@/components/RoutePhoto";
import { formatDay } from "@/lib/format";
import { pickText } from "@/lib/pick-text";
import type { BlogPost } from "@/lib/posts";

/**
 * A post as a news site lists it: the headline and its date (and writer) on the left, a small square photo on the right.
 * `lead` is the top story: the photo across the page, the headline large under it.
 */
export function PostRow({ post, locale, lead = false }: { post: BlogPost; locale: string; lead?: boolean }) {
  const title = pickText(locale, post.titleJa, post.titleEn);
  const author = pickText(locale, post.authorNameJa, post.authorNameEn);
  const meta = (
    <span className="flex flex-wrap gap-x-3 text-base text-muted">
      <time dateTime={post.publishedOn}>{formatDay(locale, post.publishedOn)}</time>
      {author ? <Localized value={author} /> : null}
    </span>
  );
  if (lead) {
    return (
      <Link href={`/blog/${post.id}`} className="group flex flex-col gap-3 no-underline">
        {post.coverPhotoUrl ? (
          <span className="relative block aspect-[16/9] overflow-hidden wide:aspect-[21/9] wide:rounded-lg">
            <RoutePhoto src={post.coverPhotoUrl} alt="" />
          </span>
        ) : null}
        <span className="flex flex-col gap-1 px-4 wide:px-0">
          <span className="text-2xl font-bold leading-snug text-ink group-hover:underline md:text-3xl">
            <Localized value={title} />
          </span>
          {meta}
        </span>
      </Link>
    );
  }
  return (
    <Link href={`/blog/${post.id}`} className="tap-target group flex items-start gap-4 py-4 no-underline">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-3 text-lg font-bold leading-snug text-ink group-hover:underline">
          <Localized value={title} />
        </span>
        {meta}
      </span>
      {post.coverPhotoUrl ? (
        <span className="relative block size-24 shrink-0 overflow-hidden rounded-md bg-surface">
          <RoutePhoto src={post.coverPhotoUrl} alt="" />
        </span>
      ) : null}
    </Link>
  );
}
