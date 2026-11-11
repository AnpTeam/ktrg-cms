import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Prefecture } from "@/lib/content";
import { PrefectureIcon } from "./PrefectureIcon";
import { PrefectureName } from "./PrefectureName";

/**
 * Filter tabs as plain links (`?pref=nara`): they work without scripts, can be
 * shared, and the current choice is announced with aria-current.
 */
export function PrefectureFilter({
  base,
  available,
  active,
}: {
  base: string;
  available: Prefecture[];
  active: Prefecture | undefined;
}) {
  const { t } = useLingui();
  if (available.length < 2) return null;

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
          <Link href={base} aria-current={active ? undefined : "true"} className={tab(!active)}>
            <PrefectureIcon value="all" />
            <Trans>すべて</Trans>
          </Link>
        </li>
        {available.map((prefecture) => (
          <li key={prefecture}>
            <Link
              href={`${base}?pref=${prefecture}`}
              aria-current={active === prefecture ? "true" : undefined}
              className={tab(active === prefecture)}
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
