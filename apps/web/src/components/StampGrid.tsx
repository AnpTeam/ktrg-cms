import { useLingui } from "@lingui/react/macro";
import { TOTAL_STAMPS } from "@/lib/rally";
import { StampFace, type StampState } from "./StampFace";

/** First slot not yet stamped, or undefined when all are. */
export function nextStamp(stamped: ReadonlySet<number>) {
  for (let n = 1; n <= TOTAL_STAMPS; n++) if (!stamped.has(n)) return n;
  return undefined;
}

// 4 columns by 7 rows. Each slot is at least 76px square at 360px wide.
export function StampGrid({ stamped }: { stamped: ReadonlySet<number> }) {
  const { t } = useLingui();
  const next = nextStamp(stamped);

  return (
    <ol className="grid grid-cols-4 gap-2 px-4">
      {Array.from({ length: TOTAL_STAMPS }, (_, i) => i + 1).map((number) => {
        const state: StampState = stamped.has(number)
          ? "stamped"
          : number === next
            ? "next"
            : "empty";
        // Spoken by screen readers; the visual slot is hidden from them.
        const status =
          state === "stamped"
            ? t`${number}番 スタンプ済み`
            : state === "next"
              ? t`${number}番 つぎのスタンプ`
              : t`${number}番 まだ押していません`;
        return (
          <li key={number} className="aspect-square">
            <StampFace state={state} number={number} className="h-full w-full">
              <span className="text-3xl font-bold leading-none tabular-nums">{number}</span>
              {state === "next" ? <span className="mt-1 text-base font-bold">{t`つぎ`}</span> : null}
            </StampFace>
            <span className="sr-only">{status}</span>
          </li>
        );
      })}
    </ol>
  );
}
