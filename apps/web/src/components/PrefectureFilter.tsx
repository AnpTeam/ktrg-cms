import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Prefecture } from "@/lib/content";
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

  const chip = (selected: boolean) =>
    `tap-target inline-flex items-center justify-center rounded-lg border-2 border-ink px-4 text-lg font-bold ${
      selected ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-surface"
    }`;

  return (
    <nav aria-label={t`地域でしぼる`} className="px-4">
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href={base} aria-current={active ? undefined : "true"} className={chip(!active)}>
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
              <PrefectureName value={prefecture} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
