import { useId } from "react";
import { parseRich, type Inline } from "@/lib/rich-text";

const LINK = "font-bold text-accent underline underline-offset-4";

/** Links and note marks as React nodes (never HTML). `linkClass` lets a dark overlay use its own colours. */
export function Inlines({ parts, ids, linkClass = LINK }: { parts: Inline[]; ids?: string; linkClass?: string }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          p
        ) : "href" in p ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {p.label}
          </a>
        ) : "bold" in p ? (
          <strong key={i}>
            <Inlines parts={p.bold} ids={ids} linkClass={linkClass} />
          </strong>
        ) : "italic" in p ? (
          <em key={i}>
            <Inlines parts={p.italic} ids={ids} linkClass={linkClass} />
          </em>
        ) : "underline" in p ? (
          <u key={i}>
            <Inlines parts={p.underline} ids={ids} linkClass={linkClass} />
          </u>
        ) : (
          <sup key={i} className="mx-0.5">
            <a href={`#${ids}-fn-${p.note}`} aria-label={`${p.note}`} className={LINK}>
              {p.note}
            </a>
          </sup>
        ),
      )}
    </>
  );
}

/**
 * An editor's text with its links and footnotes (see lib/rich-text.ts). The notes are listed under the text.
 * Line breaks are kept by the caller (`whitespace-pre-line`).
 */
export function RichText({ text, lang }: { text: string; lang?: string }) {
  const ids = useId();
  const { body, notes } = parseRich(text);
  return (
    <div lang={lang}>
      <Inlines parts={body} ids={ids} />
      {notes.length > 0 ? (
        <ol className="mt-3 list-decimal space-y-1 pl-6 text-base text-muted">
          {notes.map((n) => (
            <li key={n.n} id={`${ids}-fn-${n.n}`}>
              <Inlines parts={n.parts} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
