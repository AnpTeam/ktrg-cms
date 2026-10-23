import { useLingui } from "@lingui/react/macro";
import { accessColor, accessIconSvg, type AccessPoint, type AccessType } from "@/lib/access-points";
import { pickText } from "@/lib/pick-text";
import { Localized } from "./Localized";

/** The words for each kind of way to get there. */
export function useAccessTypeNames(): Record<AccessType, string> {
  const { t } = useLingui();
  return { train: t`電車`, bus: t`バス`, ferry: t`フェリー`, car: t`車`, walk: t`徒歩`, other: t`その他` };
}

/** A white disc with the kind's picture, the way the map's pins carry theirs. */
export function AccessIcon({ type, size = 28 }: { type: AccessType; size?: number }) {
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-full bg-white" style={{ width: size, height: size }}>
      {/* The picture is fixed markup from lib/access-points.ts, never user input. */}
      <svg viewBox="0 0 24 24" width={size * 0.72} height={size * 0.72} dangerouslySetInnerHTML={{ __html: accessIconSvg[type] }} />
    </span>
  );
}

/**
 * How to get there, one row for each way: a badge in the kind's colour (the same badge as Start and Goal, with the kind's
 * picture), then the place's name and a short note. The badge words are the kind, so the colour is never the only cue.
 */
export function AccessList({ points, locale }: { points: AccessPoint[]; locale: string }) {
  const names = useAccessTypeNames();
  const { t } = useLingui();
  const externalLabel = t`（外部サイトが新しいタブで開きます）`;
  return (
    <ul className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      {points.map((p, i) => {
        const name = pickText(locale, p.nameJa, p.nameEn);
        const note = pickText(locale, p.noteJa, p.noteEn);
        return (
          <li key={i} className="flex items-start gap-3">
            <span className="badge-ruri w-[9.5rem] shrink-0 justify-start" style={{ backgroundColor: accessColor[p.type] }}>
              <AccessIcon type={p.type} />
              {names[p.type]}
            </span>
            <span className="min-w-0 pt-1">
              <span className="block text-xl font-bold leading-snug">
                {p.url && /^https:\/\//.test(p.url) ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="break-words underline decoration-2 underline-offset-4">
                    <Localized value={name} />
                    <span aria-hidden="true"> ↗</span>
                    <span className="sr-only"> {externalLabel}</span>
                  </a>
                ) : (
                  <Localized value={name} />
                )}
              </span>
              {note ? (
                <span className="block text-lg leading-snug text-muted">
                  <Localized value={note} tag={false} />
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
