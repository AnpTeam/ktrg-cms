import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Prefecture } from "@/lib/content";
import { PrefectureIcon } from "./PrefectureIcon";
import { PrefectureName } from "./PrefectureName";

/**
 * Filter chips as plain links (`?pref=nara`): they work without scripts, can be
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

  // A softer chip: a thin line, fully rounded, never squeezed (it keeps its width and the row scrolls instead).
  const chip = (selected: boolean) =>
    `tap-target inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-lg font-bold md:gap-1 md:px-1.5 md:text-base ${
      selected ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink hover:bg-surface"
    }`;

  return (
    <nav aria-label={t`地域でしぼる`}>
      {/* One line. On a phone it scrolls sideways (the edges bleed to the screen's edge); from a tablet up it simply fits. */}
      <ul className="flex flex-nowrap gap-1.5 overflow-x-auto md:gap-1 px-4 pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
        <li>
          <Link href={base} aria-current={active ? undefined : "true"} className={chip(!active)}>
            <PrefectureIcon value="all" />
            <Trans>すべて</Trans>
          </Link>
        </li>
        {available.map((prefecture) => (
          <li key={prefecture}>
            <Link
              href={`${base}?pref=${prefecture}`}
              aria-current={active === prefecture ? "true" : undefined}
              className={chip(active === prefecture)}
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
