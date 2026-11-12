import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Prefecture } from "@/lib/content";
import { PrefectureIcon } from "./PrefectureIcon";
import { PrefectureName } from "./PrefectureName";

/**
 * Filter tabs as plain links (`?pref=osaka,nara`): they work without scripts, can be shared, and the choice is announced
 * with aria-current. Each prefecture is a switch: choosing two (Osaka and Nara) shows the courses that pass through both.
 */
export function PrefectureFilter({
  base,
  available,
  active,
}: {
  base: string;
  available: Prefecture[];
  /** The chosen prefectures: a course must pass through all of them (none chosen: every course). */
  active: Prefecture[];
}) {
  const { t } = useLingui();
  if (available.length < 2) return null;
  // The address with this prefecture switched on or off.
  const toggled = (p: Prefecture) => {
    const next = active.includes(p) ? active.filter((x) => x !== p) : [...active, p];
    return next.length > 0 ? `${base}?pref=${next.join(",")}` : base;
  };

  // Tabs: the prefecture's mark and its name, a bar under the chosen one (no chips, no pills, no borders). Never squeezed: the
  // row scrolls instead. (The raised pill is the list's own prefecture heading.)
  const tab = (selected: boolean) =>
    `tap-target inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-4 px-1 text-lg ${
      selected ? "border-brand font-bold text-ink" : "border-transparent text-muted hover:text-ink"
    }`;

  return (
    <nav aria-label={t`地域でしぼる`}>
      {/* One line. On a phone it scrolls sideways (the edges bleed to the screen's edge); from a tablet up it simply fits. */}
      <ul className="flex flex-nowrap gap-5 overflow-x-auto px-4 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
        <li>
          <Link href={base} aria-current={active.length === 0 ? "true" : undefined} className={tab(active.length === 0)}>
            <PrefectureIcon value="all" />
            <Trans>すべて</Trans>
          </Link>
        </li>
        {available.map((prefecture) => (
          <li key={prefecture}>
            <Link
              href={toggled(prefecture)}
              aria-current={active.includes(prefecture) ? "true" : undefined}
              className={tab(active.includes(prefecture))}
            >
              <PrefectureIcon value={prefecture} />
              <PrefectureName value={prefecture} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
