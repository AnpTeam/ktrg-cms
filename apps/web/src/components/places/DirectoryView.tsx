"use client";

import Link from "next/link";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "@/components/button";
import { ChevronIcon } from "@/components/icons";
import { PlaceIcon } from "@/components/PlaceIcon";
import { useCategoryNames, useGroupNames, useStatusNames } from "@/components/map/PlacesPanel";
import { placeGroups, type PlaceCategory, type PlaceGroup, type PlaceStatus } from "@/lib/places";

export interface DirectoryRow {
  id: string;
  name: string;
  nameLang: "ja" | "en";
  category: PlaceCategory;
  icon?: string | null;
  status: PlaceStatus;
  /** The course numbers it serves. */
  routes: number[];
  hours: string | null;
}

const tab = (on: boolean) =>
  `tap-target inline-flex shrink-0 items-center whitespace-nowrap border-b-[3px] px-4 text-lg no-underline ${on ? "border-brand font-bold text-ink" : "border-transparent text-muted hover:text-ink"}`;

const href = (group?: PlaceGroup, route?: number) => {
  const q = new URLSearchParams();
  if (group) q.set("group", group);
  if (route !== undefined) q.set("route", String(route));
  const s = q.toString();
  return s ? `/places?${s}` : "/places";
};

/**
 * The shops and facilities along the courses: a tab per group (only groups with places), a course filter that works
 * without JavaScript (a plain GET form), then one row per place linking to its page.
 */
export function DirectoryView({
  rows,
  counts,
  group,
  route,
  routes,
}: {
  rows: DirectoryRow[];
  counts: Partial<Record<PlaceGroup, number>>;
  group?: PlaceGroup;
  route?: number;
  /** Every course for the filter: number and name in the visitor's language. */
  routes: { order: number; name: string }[];
}) {
  const { t } = useLingui();
  const groupNames = useGroupNames();
  const categoryNames = useCategoryNames();
  const statusNames = useStatusNames();
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label={t`種類`} className="overflow-x-auto border-b border-line">
        <ul className="flex">
          <li>
            <Link href={href(undefined, route)} aria-current={group ? undefined : "page"} className={tab(!group)}>
              {t`すべて`}
            </Link>
          </li>
          {placeGroups
            .filter((g) => counts[g])
            .map((g) => (
              <li key={g}>
                <Link href={href(g, route)} aria-current={g === group ? "page" : undefined} className={tab(g === group)}>
                  {groupNames[g]}
                </Link>
              </li>
            ))}
        </ul>
      </nav>

      {routes.length > 0 ? (
        <form action="/places" method="get" autoComplete="off" className="flex flex-wrap items-end gap-3 px-4 wide:px-0">
          {group ? <input type="hidden" name="group" value={group} /> : null}
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-lg font-bold">
            {t`ルート`}
            {/* key, and autoComplete off on the form: after Back the browser would put the old choice back in the box while the list shows the new address */}
            <select key={route ?? "all"} name="route" defaultValue={route ?? ""} className="tap-target w-full rounded-xl border-2 border-line bg-paper px-4 text-lg font-normal text-ink">
              <option value="">{t`すべてのルート`}</option>
              {routes.map((r) => (
                <option key={r.order} value={r.order}>
                  {r.order}. {r.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonStyle("secondary", "md", "inline-flex")}>
            {t`絞り込む`}
          </button>
        </form>
      ) : null}

      <p className="px-4 text-lg text-muted wide:px-0" aria-live="polite">
        {t`${rows.length}件`}
      </p>

      {rows.length === 0 ? (
        <p className="mx-4 rounded-2xl bg-surface p-5 text-lg wide:mx-0">{t`この条件に合う場所はありません。`}</p>
      ) : (
        <ul className="mx-4 divide-y divide-line/30 rounded-3xl bg-surface px-4 wide:mx-0">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/places/${p.id}`} className="flex items-center gap-3 py-3 no-underline">
                <PlaceIcon category={p.category} icon={p.icon} />
                <span className="min-w-0 flex-1">
                  <span lang={p.nameLang} className="block text-lg font-bold leading-snug">
                    {p.name}
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-base text-muted">
                    <span>{categoryNames[p.category]}</span>
                    {p.routes.length > 0 ? <span>{t`ルート${p.routes.join("、")}`}</span> : null}
                    {p.status === "closed" || p.status === "seasonal" ? <span className="font-bold text-ink">{statusNames[p.status]}</span> : null}
                  </span>
                  {p.hours ? <span className="block text-base">{p.hours}</span> : null}
                </span>
                <ChevronIcon />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
