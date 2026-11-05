"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { WarningIcon } from "@/components/icons";
import { Pager } from "@/components/Pager";
import { PlaceGroupPicture, PlaceIcon } from "@/components/PlaceIcon";
import { RichText } from "@/components/RichText";
import { formatDay } from "@/lib/format";
import { pageCount, pageSlice } from "@/lib/pager";
import {
  distanceLabel,
  placeGroups,
  type MapPlace,
  type PlaceCategory,
  type PlaceGroup,
  type PlaceStatus,
} from "@/lib/places";
import { buttonStyle } from "@/components/button";

// The "places nearby" pieces of the trail map: group buttons, the list sorted by distance, and the
// card for one place. Plain words next to every picture; nothing here needs a gesture.

export function useGroupNames(): Record<PlaceGroup, string> {
  const { t } = useLingui();
  return {
    rest: t`トイレ・休憩`,
    shops: t`お店・食事`,
    vending: t`自動販売機`,
    transport: t`駅・バス・駐車場`,
    other: t`その他`,
  };
}

export function useCategoryNames(): Record<PlaceCategory, string> {
  const { t } = useLingui();
  return {
    souvenir_shop: t`お土産店`,
    restaurant: t`飲食店`,
    cafe: t`カフェ・喫茶`,
    convenience_store: t`コンビニ・商店`,
    toilet: t`トイレ`,
    rest_area: t`休憩所・東屋`,
    drinking_water: t`水場`,
    vending_machine: t`自動販売機`,
    station: t`駅`,
    bus_stop: t`バス停`,
    parking: t`駐車場`,
    other: t`その他`,
  };
}

export function useStatusNames(): Record<PlaceStatus, string> {
  const { t } = useLingui();
  return {
    open: t`営業中・利用可`,
    closed: t`休業中`,
    seasonal: t`季節営業`,
    gone: t`閉店・撤去`,
    unknown: t`状態は未確認`,
  };
}

/** "300 m" / "1.2 km", always "about": a straight line, not the walking distance. */
export function useDistanceText() {
  const { t } = useLingui();
  return (meters: number) => {
    const { amount, unit } = distanceLabel(meters);
    return unit === "m" ? t`約${amount}m` : t`約${amount}km`;
  };
}

/** The buttons that turn a kind of place on or off. A group with no places is not offered. */
export function PlaceChips({
  counts,
  active,
  onToggle,
  label,
}: {
  counts: Partial<Record<PlaceGroup, number>>;
  active: ReadonlySet<PlaceGroup>;
  onToggle: (group: PlaceGroup) => void;
  /** What the group of buttons is for, read out by screen readers (by default: showing the places on the map). */
  label?: string;
}) {
  const { t } = useLingui();
  const names = useGroupNames();
  const offered = placeGroups.filter((g) => (counts[g] ?? 0) > 0);
  if (offered.length === 0) return null;
  return (
    <div role="group" aria-label={label ?? t`まわりの場所を地図に出す`} className="grid grid-cols-2 gap-2">
      {offered.map((group) => {
        const on = active.has(group);
        return (
          <button
            key={group}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(group)}
            className={`tap-target flex items-center gap-2 rounded-xl border border-ink px-3 py-1 text-left text-lg font-bold leading-tight ${
              on ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-surface"
            }`}
          >
            <PlaceGroupPicture group={group} size={24} />
            <span className="min-w-0 flex-1">{names[group]}</span>
            <span className="tabular-nums">{counts[group]}</span>
          </button>
        );
      })}
    </div>
  );
}

const FIRST_ROWS = 5;

/** The places turned on, nearest first. Picking one shows it on the map. */
export function PlaceList({
  items,
  fromLabel,
  selectedId,
  onSelect,
}: {
  items: readonly (MapPlace & { meters: number })[];
  /** What the distances are measured from, in words. */
  fromLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useLingui();
  const categoryNames = useCategoryNames();
  const distanceText = useDistanceText();
  const [page, setPage] = useState(1);
  const pages = pageCount(items.length, FIRST_ROWS);
  const here = Math.min(page, pages);
  const shown = pageSlice(items, here, FIRST_ROWS);
  return (
    <section aria-label={t`まわりの場所`}>
      <h3 className="text-xl font-bold">{t`まわりの場所`}</h3>
      <p className="mt-1 text-base text-muted">{fromLabel}</p>
      <ul className="mt-2 border-t-2 border-line">
        {shown.map((place) => (
          <li key={place.id} className="border-b-2 border-line">
            <button
              type="button"
              onClick={() => onSelect(place.id)}
              aria-pressed={place.id === selectedId}
              className={`tap-target flex w-full items-center gap-3 py-2 text-left ${place.id === selectedId ? "bg-surface" : ""}`}
            >
              <span className="shrink-0 text-accent">
                <PlaceIcon category={place.category} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-snug" lang={place.nameLang}>
                  {place.name}
                </span>
                <span className="block text-base text-muted">{categoryNames[place.category]}</span>
              </span>
              <span className="shrink-0 text-lg font-bold tabular-nums">{distanceText(place.meters)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <Pager page={here} pages={pages} onPage={setPage} hideWhenSingle />
      </div>
    </section>
  );
}

function PlaceRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-x-3 py-2 text-lg leading-7">
      <dt className="text-muted">{term}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** One place, in full: what it is, when it is open, and how sure we are. */
export function PlaceCard({
  place,
  meters,
  onClose,
}: {
  place: MapPlace;
  meters: number | null;
  onClose: () => void;
}) {
  const { t, i18n } = useLingui();
  const categoryNames = useCategoryNames();
  const statusNames = useStatusNames();
  const distanceText = useDistanceText();
  const checkedOn = place.lastVerified ? formatDay(i18n.locale, place.lastVerified) : "";
  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-line bg-paper p-4" role="status">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-start gap-3 text-xl font-bold leading-snug">
          <span className="mt-0.5 shrink-0 text-accent">
            <PlaceIcon category={place.category} />
          </span>
          <span lang={place.nameLang}>{place.name}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          className={buttonStyle("secondary", "sm", "inline-flex shrink-0")}
        >
          {t`閉じる`}
        </button>
      </div>
      <p className="text-lg">
        {categoryNames[place.category]}
        {meters !== null ? <span className="text-muted">　{distanceText(meters)}</span> : null}
      </p>
      <p className="text-lg font-bold">{statusNames[place.status]}</p>
      {place.address || place.phone || place.website || place.hours || place.closedDays ? (
        <dl className="mt-1 divide-y divide-line/40 border-y border-line/40">
          {place.address ? <PlaceRow term={t`住所`}>{place.address}</PlaceRow> : null}
          {place.phone ? (
            <PlaceRow term={t`電話`}>
              <a href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-4">
                {place.phone}
              </a>
            </PlaceRow>
          ) : null}
          {place.website && /^https:\/\//.test(place.website) ? (
            <PlaceRow term={t`サイト`}>
              <a href={place.website} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">
                {place.website}
              </a>
            </PlaceRow>
          ) : null}
          {place.hours ? <PlaceRow term={t`時間`}>{place.hours}</PlaceRow> : null}
          {place.closedDays ? <PlaceRow term={t`休み`}>{place.closedDays}</PlaceRow> : null}
        </dl>
      ) : null}
      {place.description ? (
        <div className="whitespace-pre-line text-lg leading-8">
          <RichText text={place.description} />
        </div>
      ) : null}
      {place.lastVerified ? (
        <p className="text-base text-muted">{t`確認した日：${checkedOn}`}</p>
      ) : null}
      {place.verified ? null : (
        <p className="flex items-start gap-2 text-base text-muted">
          <span className="shrink-0 text-caution">
            <WarningIcon />
          </span>
          {t`この場所の位置は仮のもので、まだ確認されていません。`}
        </p>
      )}
    </div>
  );
}
