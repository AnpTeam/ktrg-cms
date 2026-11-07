import Image from "next/image";
import type { ReactNode } from "react";
import { parseBlocks, type Block } from "@/lib/rich-text";
import { FaqCard, StepCard } from "./pages/Cards";
import { Inlines } from "./RichText";

/**
 * A long text with its headings, bullet lists, photos, links and footnotes (see lib/rich-text.ts). Used by the blog and
 * the site's text pages; route and place text keeps the shorter `RichText`. Everything is a React element, never HTML, so nothing an editor
 * types can run as script.
 *
 * `anchor` makes the footnote ids unique on the page (the post's id), so the links work without a hook and the
 * addresses stay the same between renders — a footnote can be linked to from outside.
 */
export function RichBody({ text, lang, anchor }: { text: string; lang?: string; anchor: string }) {
  const { blocks, notes } = parseBlocks(text);
  return (
    <div lang={lang} className="flex flex-col gap-5">
      <Blocks blocks={blocks} anchor={anchor} />
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

type CardBlock = Extract<Block, { kind: "card" }>;
const isStep = (b: Block | undefined): b is CardBlock => b?.kind === "card" && b.style === "step";

function Blocks({ blocks, anchor }: { blocks: Block[]; anchor: string }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (isStep(block)) {
      // Steps next to each other are one numbered list; any other block between them starts a new one.
      const run: CardBlock[] = [];
      for (let next: Block | undefined = block; isStep(next); next = blocks[i + run.length]) run.push(next);
      out.push(
        <ol key={i} className="flex flex-col gap-4">
          {run.map((step, n) => (
            <StepCard key={n} n={n + 1} title={step.title} heading="h3">
              <Inside blocks={step.blocks} anchor={anchor} />
            </StepCard>
          ))}
        </ol>,
      );
      i += run.length - 1;
    } else out.push(<OneBlock key={i} block={block} anchor={anchor} />);
  }
  return out;
}

const Inside = ({ blocks, anchor }: { blocks: Block[]; anchor: string }) => (
  <div className="flex flex-col gap-3">
    <Blocks blocks={blocks} anchor={anchor} />
  </div>
);

function OneBlock({ block, anchor }: { block: Block; anchor: string }) {
  if (block.kind === "card") {
    if (block.style === "faq") {
      return (
        <FaqCard question={block.title}>
          <Inside blocks={block.blocks} anchor={anchor} />
        </FaqCard>
      );
    }
    return (
      <section className="flex flex-col gap-1 rounded-3xl bg-surface p-5">
        {block.title ? <h3 className="text-xl font-bold leading-snug text-accent">{block.title}</h3> : null}
        <Inside blocks={block.blocks} anchor={anchor} />
      </section>
    );
  }
  if (block.kind === "h") {
    const Tag = block.level === 2 ? "h2" : "h3";
    return (
      <Tag className={block.level === 2 ? "mt-4 border-l-[6px] border-accent pl-3 text-2xl font-bold leading-snug" : "mt-2 text-xl font-bold"}>
        <Inlines parts={block.parts} ids={anchor} />
      </Tag>
    );
  }
  if (block.kind === "rule") return <hr className="max-w-prose border-line" />;
  if (block.kind === "ul") {
    return (
      <ul className="max-w-prose list-disc space-y-2 pl-6 text-lg leading-8">
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
      <figure className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface">
        <Image src={block.src} alt={block.alt} fill sizes="(min-width: 768px) 36rem, 100vw" className="object-cover" unoptimized />
      </figure>
    );
  }
  return (
    <p className="max-w-prose whitespace-pre-line text-lg leading-8">
      <Inlines parts={block.parts} ids={anchor} />
    </p>
  );
}
