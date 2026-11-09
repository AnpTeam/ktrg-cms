import Link from "next/link";
import { Localized } from "@/components/Localized";
import { pickText } from "@/lib/pick-text";
import type { PostTag } from "@/lib/posts";

/** Tags as round links to the posts of each (`/blog?tag=…`); the one being shown is filled in. */
export function TagChips({ tags, locale, current, label }: { tags: PostTag[]; locale: string; current?: string; label: string }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag.id}>
          <Link
            href={`/blog?tag=${tag.id}`}
            aria-current={tag.id === current ? "page" : undefined}
            className={`tap-target inline-flex items-center rounded-full border border-ink px-4 text-base font-bold no-underline ${tag.id === current ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-surface"}`}
          >
            <Localized value={pickText(locale, tag.nameJa, tag.nameEn)} tag={false} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
