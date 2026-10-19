import { useLingui } from "@lingui/react/macro";
import { StampFace, type StampState } from "./StampFace";

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
  className = "",
}: {
  total: number;
  stamped: ReadonlySet<number>;
  showNext?: boolean;
  /** The place name for each number; left out, the seal shows only the number. */
  names?: ReadonlyMap<number, string>;
  columns?: 2 | 4;
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
