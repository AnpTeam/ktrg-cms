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
    // A capsule like the course list's: the words on the left, the photo fading in from the right.
    <Link href={`/blog/${post.id}`} className="tap-target group relative block overflow-hidden rounded-[1.75rem] bg-surface no-underline">
      {post.coverPhotoUrl ? (
        <span className="absolute inset-y-0 right-0 block w-2/5 overflow-hidden">
          <RoutePhoto src={post.coverPhotoUrl} alt="" />
          <span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-surface from-20% to-transparent to-85%" />
        </span>
      ) : null}
      <span className={`relative flex min-h-24 flex-col justify-center gap-1 py-3 pl-5 ${post.coverPhotoUrl ? "pr-[42%]" : "pr-5"}`}>
        <span className="line-clamp-3 text-lg font-bold leading-snug text-ink group-hover:underline">
          <Localized value={title} />
        </span>
        {meta}
      </span>
    </Link>
  );
}
