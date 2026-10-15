import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { TOTAL_STAMPS } from "@/lib/rally";

/** Big count, one plain sentence, and a bar. The bar is a bonus: the numbers say it all. */
export function ProgressSummary({ stamped, children }: { stamped: number; children?: ReactNode }) {
  const { t } = useLingui();
  const remaining = TOTAL_STAMPS - stamped;
  const sentence =
    stamped === 0
      ? t`まだスタンプはありません。`
      : remaining === 0
        ? t`すべてそろいました。`
        : t`あと${remaining}か所`;

  return (
    <section className="px-4">
      <h2 className="text-xl font-bold">{t`スタンプ`}</h2>
      <p className="mt-1 text-6xl font-bold leading-none tabular-nums">
        {stamped}
        <span className="ml-2 text-3xl text-muted">/ {TOTAL_STAMPS}</span>
      </p>
      <p className="mt-2 text-xl">{sentence}</p>
      <div
        role="progressbar"
        aria-label={t`スタンプの進み具合`}
        aria-valuemin={0}
        aria-valuemax={TOTAL_STAMPS}
        aria-valuenow={stamped}
        className="mt-4 h-5 overflow-hidden rounded-full border-2 border-line bg-surface"
      >
        <div className="h-full bg-moss" style={{ width: `${(stamped / TOTAL_STAMPS) * 100}%` }} />
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
