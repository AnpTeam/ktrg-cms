import Image from "next/image";
import { parseBlocks } from "@/lib/rich-text";
import { Inlines } from "./RichText";

/**
 * A long text with its headings, bullet lists, photos, links and footnotes (see lib/rich-text.ts). Used by the blog;
 * route and place text keeps the shorter `RichText`. Everything is a React element, never HTML, so nothing an editor
 * types can run as script.
 *
 * `anchor` makes the footnote ids unique on the page (the post's id), so the links work without a hook and the
 * addresses stay the same between renders — a footnote can be linked to from outside.
 */
export function RichBody({ text, lang, anchor }: { text: string; lang?: string; anchor: string }) {
  const { blocks, notes } = parseBlocks(text);
  return (
    <div lang={lang} className="flex flex-col gap-5">
      {blocks.map((block, i) => {
        if (block.kind === "h") {
          const Tag = block.level === 2 ? "h2" : "h3";
          return (
            <Tag key={i} className={block.level === 2 ? "mt-3 text-2xl font-bold" : "mt-2 text-xl font-bold"}>
              <Inlines parts={block.parts} ids={anchor} />
            </Tag>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul key={i} className="max-w-prose list-disc space-y-2 pl-6 text-lg leading-8">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inlines parts={item} ids={anchor} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === "photo") {
          return (
            <figure key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface">
              <Image src={block.src} alt={block.alt} fill sizes="(min-width: 768px) 36rem, 100vw" className="object-cover" unoptimized />
            </figure>
          );
        }
        return (
          <p key={i} className="max-w-prose whitespace-pre-line text-lg leading-8">
            <Inlines parts={block.parts} ids={anchor} />
          </p>
        );
      })}
      {notes.length > 0 ? (
        <ol className="mt-2 max-w-prose list-decimal space-y-1 pl-6 text-base text-muted">
          {notes.map((n) => (
            <li key={n.n} id={`${anchor}-fn-${n.n}`}>
              <Inlines parts={n.parts} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
