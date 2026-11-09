import Link from "next/link";
import { Localized } from "@/components/Localized";
import { pickText } from "@/lib/pick-text";
import type { PostTag } from "@/lib/posts";

/** The blog's topics as a strip of tabs, as a news site has: すべて, then each tag. It scrolls sideways when it runs long. */
export function TagTabs({ tags, locale, current, label, allLabel }: { tags: PostTag[]; locale: string; current?: string; label: string; allLabel: string }) {
  const tab = (on: boolean) =>
    `tap-target inline-flex shrink-0 items-center whitespace-nowrap border-b-[3px] px-4 text-lg no-underline ${on ? "border-brand font-bold text-ink" : "border-transparent text-muted hover:text-ink"}`;
  return (
    <nav aria-label={label} className="overflow-x-auto border-b border-line">
      <ul className="flex">
        <li>
          <Link href="/blog" aria-current={current ? undefined : "page"} className={tab(!current)}>
            {allLabel}
          </Link>
        </li>
        {tags.map((tag) => (
          <li key={tag.id}>
            <Link href={`/blog?tag=${tag.id}`} aria-current={tag.id === current ? "page" : undefined} className={tab(tag.id === current)}>
              <Localized value={pickText(locale, tag.nameJa, tag.nameEn)} tag={false} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
