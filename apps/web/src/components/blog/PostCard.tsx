import Link from "next/link";
import { Localized } from "@/components/Localized";
import { RoutePhoto } from "@/components/RoutePhoto";
import { formatDay } from "@/lib/format";
import { pickText } from "@/lib/pick-text";
import type { BlogPost } from "@/lib/posts";
import { plainBody } from "@/lib/rich-text";
import { Avatar } from "./Avatar";

/** How much of a post a card shows under its title. */
const EXCERPT_CHARS = 90;

/** A post as a card: its photo on top, then the date, title, a few lines of text and who wrote it. */
export function PostCard({ post, locale, size = "card" }: { post: BlogPost; locale: string; size?: "card" | "feature" }) {
  const title = pickText(locale, post.titleJa, post.titleEn);
  const body = pickText(locale, post.bodyJa, post.bodyEn);
  const author = pickText(locale, post.authorNameJa, post.authorNameEn);
  const excerpt = body ? plainBody(body.text).slice(0, size === "feature" ? 200 : EXCERPT_CHARS) : "";
  const feature = size === "feature";
  return (
    <Link href={`/blog/${post.id}`} className={`group flex overflow-hidden rounded-3xl bg-surface hover:bg-paper ${feature ? "flex-col md:flex-row" : "h-full flex-col"}`}>
      <span className={`relative block shrink-0 overflow-hidden ${feature ? "aspect-[16/10] md:aspect-auto md:min-h-72 md:w-3/5" : "aspect-[16/10]"}`}>
        <RoutePhoto src={post.coverPhotoUrl} alt={title?.text ?? ""} />
      </span>
      <span className={`flex min-w-0 flex-1 flex-col gap-2 p-5 ${feature ? "md:justify-center md:p-8" : ""}`}>
        <time dateTime={post.publishedOn} className="text-base text-muted">
          {formatDay(locale, post.publishedOn)}
        </time>
        <span className={`font-bold leading-snug text-accent group-hover:underline ${feature ? "text-2xl md:text-3xl" : "text-xl"}`}>
          <Localized value={title} />
        </span>
        {excerpt ? <span className={`text-lg leading-8 ${feature ? "line-clamp-4" : "line-clamp-3"}`}>{excerpt}</span> : null}
        {author ? (
          <span className="mt-auto flex items-center gap-2 pt-2 text-base text-muted">
            <Avatar src={post.authorPhotoUrl} name={author.text} size={28} />
            <Localized value={author} />
          </span>
        ) : null}
      </span>
    </Link>
  );
}
