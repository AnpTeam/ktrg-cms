import { useLingui } from "@lingui/react/macro";
import { StampFace, tilt, type StampState } from "./StampFace";

/** First slot not yet stamped, or undefined when all are. */
export function nextStamp(stamped: ReadonlySet<number>, total: number) {
  for (let n = 1; n <= total; n++) if (!stamped.has(n)) return n;
  return undefined;
}

/**
 * The stamps of one rally. By default two big round seals to a row, each with its number and, when the names
 * are given, the name of the place, so a seal says what it is without opening anything. `columns={4}` is the
 * small version (the example on the home page). Never by colour alone: stamped is a filled seal, the next one
 * a thick ring with the word つぎ, the rest a dashed outline.
 */
export function StampGrid({
  total,
  stamped,
  showNext = true,
  names,
  columns = 2,
  art = false,
  className = "",
}: {
  total: number;
  stamped: ReadonlySet<number>;
  showNext?: boolean;
  /** The place name for each number; left out, the seal shows only the number. */
  names?: ReadonlyMap<number, string>;
  columns?: 2 | 4;
  /** Draw the sutra mound artwork (public/stamps) instead of the plain seal, with the number under it (and the name, in the big grid). */
  art?: boolean;
  className?: string;
}) {
  const { t } = useLingui();
  const next = showNext ? nextStamp(stamped, total) : undefined; // signed out: no personal "next"
  const big = columns === 2;

  return (
    <ol className={`grid ${big ? "grid-cols-2 gap-4 lg:grid-cols-3" : "grid-cols-4 gap-2"} ${className}`}>
      {Array.from({ length: total }, (_, i) => i + 1).map((number) => {
        const state: StampState = stamped.has(number) ? "stamped" : number === next ? "next" : "empty";
        const name = names?.get(number);
        // Spoken by screen readers; the visual slot is hidden from them.
        const status =
          state === "stamped"
            ? t`${number}番 スタンプ済み`
            : state === "next"
              ? t`${number}番 つぎのスタンプ`
              : t`${number}番 まだ押していません`;
        if (art) {
          // The state is still the shape, never the colour alone: pressed art, a thick ring with つぎ, or the dashed outline.
          return (
            <li key={number} className={`flex flex-col items-center ${big ? "gap-2" : "gap-1"}`}>
              <div aria-hidden="true" className={`aspect-square w-full ${state === "next" ? "rounded-full border-4 border-accent p-1" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed artwork from /public, already the right size */}
                <img
                  src={state === "stamped" ? "/stamps/stamp-earned.svg" : "/stamps/stamp-not-earned.svg"}
                  alt=""
                  className="size-full"
                  style={state === "stamped" ? { transform: `rotate(${tilt(number)}deg)` } : undefined}
                />
              </div>
              <p aria-hidden="true" className="text-center leading-snug">
                <span className={`${big ? "text-2xl" : "text-xl"} font-bold tabular-nums`}>{number}</span>
                {big && name ? <span className="mt-1 line-clamp-2 break-all text-lg font-bold [text-wrap:balance]">{name}</span> : null}
                {state === "next" ? <span className="block text-base font-bold text-accent">{t`つぎ`}</span> : null}
              </p>
              <span className="sr-only">{name ? `${status} ${name}` : status}</span>
            </li>
          );
        }
        return (
          <li key={number} className="aspect-square">
            <StampFace state={state} number={number} rough={big} className={`h-full w-full ${big ? "rounded-full! p-4 text-center" : ""}`}>
              <span className={`${big ? "text-4xl" : "text-3xl"} font-bold leading-none tabular-nums`}>{number}</span>
              {big && name ? <span className="mt-2 line-clamp-3 break-all text-lg font-bold leading-snug [text-wrap:balance]">{name}</span> : null}
              {state === "next" ? <span className="mt-1 text-base font-bold">{t`つぎ`}</span> : null}
            </StampFace>
            <span className="sr-only">{name ? `${status} ${name}` : status}</span>
          </li>
        );
      })}
    </ol>
  );
}
