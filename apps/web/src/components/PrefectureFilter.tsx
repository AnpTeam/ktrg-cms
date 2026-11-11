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

  // A pill with the prefecture's mark (a white round badge) and its name. The chosen one lifts off the page: white with a soft
  // shadow on the light page, the panel tone with a faint ring on the dark one (the `lift` token). Never squeezed: the row scrolls.
  const tab = (selected: boolean) =>
    `tap-target inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 text-lg text-ink ${
      selected ? "bg-lift font-bold shadow-md ring-1 ring-line/30" : "hover:bg-lift/70"
    }`;

  return (
    <nav aria-label={t`地域でしぼる`}>
      {/* One line. On a phone it scrolls sideways (the edges bleed to the screen's edge); from a tablet up it simply fits. */}
      <ul className="flex flex-nowrap gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
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
