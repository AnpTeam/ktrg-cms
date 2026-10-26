import Link from "next/link";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { TOTAL_STAMPS } from "@/lib/rally";
import { ChevronIcon } from "./icons";
import { SectionBanner } from "./SectionBanner";

/**
 * How far along the visitor is: a ring with the count in it, one plain sentence, and where to go next (the next place to
 * stamp, a link to its page). The ring is drawn, so the numbers carry the meaning and `role="progressbar"` says it too.
 */
export function ProgressSummary({
  stamped,
  total = TOTAL_STAMPS,
  next,
  children,
}: {
  stamped: number;
  total?: number;
  /** The next place to stamp (its name and the course it is on); left out when there is none. */
  next?: { id: string; name: string; routeName: string } | null;
  children?: ReactNode;
}) {
  const { t } = useLingui();
  const remaining = total - stamped;
  const share = total > 0 ? Math.min(1, stamped / total) : 0;
  const R = 52;
  const circumference = 2 * Math.PI * R;
  const sentence =
    stamped === 0
      ? t`まだスタンプはありません。`
      : remaining === 0
        ? t`すべてそろいました。`
        : t`あと${remaining}か所`;

  return (
    <section className="px-4">
      <SectionBanner>{t`スタンプ`}</SectionBanner>
      <div className="mt-4 flex items-center gap-5">
        <div
          role="progressbar"
          aria-label={t`スタンプの進み具合`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={stamped}
          className="relative size-36 shrink-0"
        >
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" className="stroke-line/30" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - share)}
              className="stroke-moss motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
            />
          </svg>
          <p className="absolute inset-0 flex flex-col items-center justify-center tabular-nums">
            <span className="text-4xl font-bold leading-none text-accent">{stamped}</span>
            <span className="mt-1 text-lg text-muted">/ {total}</span>
          </p>
        </div>
        <p className="text-2xl font-bold leading-snug">{sentence}</p>
      </div>
      {next ? (
        <Link href={`/spots/${next.id}`} className="tap-target mt-5 flex items-center justify-between gap-3 rounded-2xl bg-paper px-5 py-3">
          <span className="min-w-0">
            <span className="block text-base text-muted">{t`つぎの場所`}</span>
            <span className="block text-xl font-bold leading-snug text-accent">{next.name}</span>
            <span className="block text-base text-muted">{next.routeName}</span>
          </span>
          <span className="shrink-0 text-muted">
            <ChevronIcon />
          </span>
        </Link>
      ) : null}
      {children ? <div className="mt-6 flex flex-col gap-3">{children}</div> : null}
    </section>
  );
}
