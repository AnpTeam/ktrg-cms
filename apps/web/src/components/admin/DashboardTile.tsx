import type { ReactNode } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { progressPercent, sparkPoints } from "@/lib/admin/dashboard";

/**
 * One headline number: the total, how far it is toward the goal (a bar and the words), what the chosen range added, and a
 * small daily line. The line is a picture of the numbers under "daily numbers", so nothing depends on seeing it.
 */
export async function DashboardTile({ title, total, goal, added, addedLabel, daily, children }: { title: string; total: number; goal: number | null; added: number; addedLabel: string; daily?: { day: string; n: number }[]; children?: ReactNode }) {
  const i18n = await initLingui();
  const pct = progressPercent(total, goal);
  const goalText = goal === null ? "" : goal.toLocaleString();
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-4xl font-bold tabular-nums">{total.toLocaleString()}</p>
      {goal !== null && pct !== null ? (
        <div className="flex flex-col gap-1">
          <div role="progressbar" aria-label={i18n._(msg`目標までの進み具合`)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)} className="h-3 rounded-full bg-paper">
            <div className="h-3 rounded-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="text-base">
            <Trans>
              目標 {goalText} の {pct}%
            </Trans>
            {pct >= 100 ? (
              <span className="font-bold">
                {" "}
                <Trans>（達成）</Trans>
              </span>
            ) : null}
          </p>
        </div>
      ) : null}
      <p className="text-lg font-bold">
        +{added.toLocaleString()} <span className="text-base font-normal text-muted">{addedLabel}</span>
      </p>
      {daily && daily.length > 1 ? (
        <>
          <svg role="img" aria-label={i18n._(msg`日ごとの数の推移`)} viewBox="0 0 200 40" className="h-12 w-full text-brand" preserveAspectRatio="none">
            <polyline points={sparkPoints(daily.map((d) => d.n), 200, 40)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <details className="text-base">
            <summary className="tap-target flex w-fit cursor-pointer items-center font-bold text-accent">
              <Trans>日ごとの数</Trans>
            </summary>
            <table className="mt-1 w-full text-left">
              <tbody>
                {daily
                  .slice()
                  .reverse()
                  .map((d) => (
                    <tr key={d.day} className="border-t border-line">
                      <th scope="row" className="py-1 pr-3 font-normal">
                        {d.day}
                      </th>
                      <td className="py-1 text-right tabular-nums">{d.n.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        </>
      ) : null}
      {children}
    </section>
  );
}
