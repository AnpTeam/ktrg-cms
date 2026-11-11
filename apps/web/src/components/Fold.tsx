import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

/**
 * A section that folds: a ruled heading row you tap to open or close (native <details>, so it needs no script, works with
 * the keyboard and a screen reader says open or closed). From a wide box (@4xl, the two-column page) it is always open
 * and the heading is not a button (`.fold` in globals.css), so a desktop page still shows everything at once.
 * `aside` is a small note at the right of the heading ("スタンプ 3 / 14").
 */
export function Fold({ title, aside, open = false, className = "", children }: { title: ReactNode; aside?: ReactNode; open?: boolean; className?: string; children: ReactNode }) {
  return (
    <details open={open} className={`fold group border-b border-line ${className}`}>
      <summary className="fold-summary tap-target flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="min-w-0 flex-1 text-xl font-bold">{title}</h2>
        {aside ? <span className="shrink-0 text-lg font-bold tabular-nums">{aside}</span> : null}
        <span aria-hidden="true" className="fold-chevron shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none">
          <ChevronDownIcon />
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}
