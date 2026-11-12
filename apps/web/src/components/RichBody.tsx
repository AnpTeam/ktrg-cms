import { Zoomable } from "@/components/Zoomable";
import Image from "next/image";
import type { ReactNode } from "react";
import { parseBlocks, type Block } from "@/lib/rich-text";
import { FaqCard, StepCard } from "./pages/Cards";
import { PlaceInline, type InlinePlace } from "./places/PlaceInline";
import { Inlines } from "./RichText";

/**
 * A long text with its headings, bullet lists, photos, links and footnotes (see lib/rich-text.ts). Used by the blog and
 * the site's text pages; route and place text keeps the shorter `RichText`. Everything is a React element, never HTML, so nothing an editor
 * types can run as script.
 *
 * `anchor` makes the footnote ids unique on the page (the post's id), so the links work without a hook and the
 * addresses stay the same between renders — a footnote can be linked to from outside.
 *
 * `places`: the directory places a ::place line may name, by id. A place not in it (a draft, or one taken off) is left out.
 */
export function RichBody({ text, lang, anchor, places = {} }: { text: string; lang?: string; anchor: string; places?: Record<string, InlinePlace> }) {
  const { blocks, notes } = parseBlocks(text);
  return (
    <div lang={lang} className="flex flex-col gap-5">
      <Blocks blocks={blocks} anchor={anchor} places={places} />
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

function Blocks({ blocks, anchor, places }: { blocks: Block[]; anchor: string; places: Record<string, InlinePlace> }) {
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
              <Inside blocks={step.blocks} anchor={anchor} places={places} />
            </StepCard>
          ))}
        </ol>,
      );
      i += run.length - 1;
    } else out.push(<OneBlock key={i} block={block} anchor={anchor} places={places} />);
  }
  return out;
}

const Inside = ({ blocks, anchor, places }: { blocks: Block[]; anchor: string; places: Record<string, InlinePlace> }) => (
  <div className="flex flex-col gap-3">
    <Blocks blocks={blocks} anchor={anchor} places={places} />
  </div>
);

function OneBlock({ block, anchor, places }: { block: Block; anchor: string; places: Record<string, InlinePlace> }) {
  if (block.kind === "place") {
    const place = places[block.id];
    return place ? <PlaceInline place={place} /> : null;
  }
  if (block.kind === "table") {
    return (
      // A wide table scrolls sideways on a phone instead of squeezing its words; the box can take the focus so a keyboard can scroll it.
      <div tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-lg leading-7">
          {block.head.length ? (
            <thead className="bg-surface">
              <tr>
                {block.head.map((cell, j) => (
                  <th key={j} scope="col" className="border-b-2 border-line px-3 py-2 text-left font-bold">
                    <Inlines parts={cell} ids={anchor} />
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r} className="border-t border-line/40">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 align-top">
                    <Inlines parts={cell} ids={anchor} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.kind === "card") {
    if (block.style === "faq") {
      return (
        <FaqCard question={block.title}>
          <Inside blocks={block.blocks} anchor={anchor} places={places} />
        </FaqCard>
      );
    }
    return (
      <section className="flex flex-col gap-1 rounded-[1.75rem] bg-surface p-5">
        {block.title ? <h3 className="text-xl font-bold leading-snug text-accent">{block.title}</h3> : null}
        <Inside blocks={block.blocks} anchor={anchor} places={places} />
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
        <Zoomable src={block.src} alt={block.alt}>
          <Image src={block.src} alt={block.alt} fill sizes="(min-width: 768px) 36rem, 100vw" className="object-cover" unoptimized />
        </Zoomable>
      </figure>
    );
  }
  return (
    <p className="max-w-prose whitespace-pre-line text-lg leading-8">
      <Inlines parts={block.parts} ids={anchor} />
    </p>
  );
}
