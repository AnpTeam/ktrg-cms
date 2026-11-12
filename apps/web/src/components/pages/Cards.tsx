import type { ReactNode } from "react";
import { ChevronIcon } from "@/components/icons";

// The cards of the how-to-play page and the FAQ, and of the card blocks in a post or a made page. The block editor draws the
// same look over its document (LOOK and CARD_BLOCK in components/admin/BlockEditor.tsx): a change here belongs there too.

/** A numbered step. Goes inside an <ol>; the number is drawn here, so screen readers are told it once by the list. */
export function StepCard({ n, title, heading: Heading = "h2", children }: { n: number; title: string; heading?: "h2" | "h3"; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-[1.75rem] bg-surface p-5">
      <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-on-brand">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <Heading className="text-xl font-bold leading-snug text-accent">{title}</Heading>
        <div className="mt-1 whitespace-pre-line text-lg leading-8">{children}</div>
      </div>
    </li>
  );
}

/** A question that opens to its answer (a native <details>, so it works with the keyboard and without scripts). */
export function FaqCard({ question, open = false, children }: { question: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="group rounded-[1.75rem] bg-surface" open={open}>
      <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-xl font-bold leading-snug [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span className="shrink-0 transition-transform group-open:rotate-90">
          <ChevronIcon />
        </span>
      </summary>
      <div className="whitespace-pre-line px-5 pb-5 text-lg leading-8">{children}</div>
    </details>
  );
}
