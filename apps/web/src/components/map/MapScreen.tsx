"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChevronIcon, ChevronLeftIcon, WarningIcon } from "@/components/icons";
import { ElevationProfile } from "@/components/ElevationProfile";
import { HeroPhoto } from "./HeroPhoto";
import { PrefectureName } from "@/components/PrefectureName";
import { RouteStats } from "@/components/RouteStats";
import { StampHere } from "@/components/StampHere";
import { StampFace } from "@/components/StampFace";
import { StatusWord } from "@/components/StatusWord";
import { formatUpdated } from "@/lib/format";
import { sheetHeightPx, type MapScreenRoute, type MapScreenStop, type SheetSnap } from "@/lib/map-screen";
import type { MapSettings } from "@/lib/map-settings";
import type { StampMock } from "@/lib/stamp-flow";
import { MapScreenCanvasLoader } from "./MapScreenCanvasLoader";
import { MapSheet } from "./MapSheet";

// The map tab (WBS 3.2.10): a map of the whole trail with a bottom sheet that never hides it. Nothing is
// chosen at first: the sheet offers the 19 courses. Choose a course (on the map or in the
// sheet) and the other areas fold away while its path and stops appear; choose a stop and the sheet shows it, with
// the stamp button for someone who is signed in. Anyone may look around; navigation and stamps are for accounts.

const linkButton = "tap-target flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-ink px-5 text-lg font-bold text-ink hover:bg-surface";
const primaryLink = "tap-target flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-on-brand";
// Room kept under the sheet for the floating tab bar (a rail on wide screens).
const TAB_ROOM_REM = 5.5;
// From this width the free space at the right of the page holds the detail of the chosen course or stop.
const WIDE_QUERY = "(min-width: 1280px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function MapScreen({
  routes,
  settings,
  mergeStops,
  signedIn,
  photoPlaceholder,
  locale,
  loginHref,
  registerHref,
  stampMock,
}: {
  routes: MapScreenRoute[];
  settings: MapSettings;
  mergeStops: boolean;
  signedIn: boolean;
  /** Show a "photo coming" frame where a course or place has no photo (development only). */
  photoPlaceholder: boolean;
  locale: string;
  loginHref: string;
  registerHref: string;
  /** Development only: pretend answers for the stamp button. */
  stampMock?: StampMock;
}) {
  const { t } = useLingui();
  const wrap = useRef<HTMLDivElement>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const [available, setAvailable] = useState(520);
  // The room under the sheet taken by the tab bar (none on a wide screen, where it is a rail).
  const [tabPx, setTabPx] = useState(88);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);

  const route = routes.find((r) => r.id === routeId) ?? null;
  const stop = route?.stops?.find((s) => s.id === stopId) ?? null;

  // The page behind does not scroll: the map and the sheet are the screen.
  useEffect(() => {
    document.body.classList.add("map-screen-active");
    return () => document.body.classList.remove("map-screen-active");
  }, []);

  // The room the sheet may use: the screen's height minus the tab bar.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const wide = window.matchMedia("(min-width: 768px)").matches;
      const tab = wide ? 0 : TAB_ROOM_REM * rem;
      setTabPx(tab);
      setAvailable(Math.max(240, el.clientHeight - tab));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // On a narrow screen the sheet rises to show what was chosen; on a wide one the detail has its own panel at the
  // right and the sheet stays as it is.
  const chooseRoute = useCallback(
    (id: string) => {
      setRouteId(id);
      setStopId(null);
      if (!wide) setSnap("half");
    },
    [wide],
  );
  const chooseStop = useCallback(
    (routeId: string, id: string) => {
      setRouteId(routeId);
      setStopId(id);
      if (!wide) setSnap((s) => (s === "peek" ? "half" : s));
    },
    [wide],
  );
  const back = useCallback(() => {
    if (stopId) setStopId(null);
    else {
      setRouteId(null);
      if (!wide) setSnap("peek");
    }
  }, [stopId, wide]);

  useEffect(() => {
    if (!routeId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && back();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [routeId, back]);

  const routeName = route?.name ?? "";
  const detailHeader = stop ? (
    <SheetTitle back={back} backLabel={routeName} title={`${stop.order}. ${stop.name}`} lang={stop.nameLang} />
  ) : route ? (
    <SheetTitle back={back} backLabel={t`全体の地図`} title={`${route.order}. ${route.name}`} lang={route.nameLang} />
  ) : null;

  const homeHeader = (
    <div>
      <h1 className="font-serif text-2xl font-bold leading-snug text-accent">{t`マップ`}</h1>
      <p className="text-lg leading-snug">{t`区間を選ぶと、道とスタンプの場所が見えます。`}</p>
      <RouteChips routes={routes} onChoose={chooseRoute} selectedId={routeId} />
    </div>
  );

  // The photo at the top of the chosen course or stop (a stop without its own photo shows its course's).
  const photo = stop?.photo ?? route?.photo ?? null;

  // In the sheet the photo is the first thing in the scrolling part; at the right it sits above the title.
  const detailBody = (withPhoto: boolean) =>
    stop && route ? (
      <StopPanel route={route} stop={stop} photo={withPhoto ? <HeroPhoto photo={photo} placeholder={photoPlaceholder} /> : null} signedIn={signedIn} locale={locale} loginHref={loginHref} registerHref={registerHref} stampMock={stampMock} />
    ) : route ? (
      <RoutePanel route={route} photo={withPhoto ? <HeroPhoto photo={photo} placeholder={photoPlaceholder} /> : null} signedIn={signedIn} loginHref={loginHref} registerHref={registerHref} onChooseStop={(id) => chooseStop(route.id, id)} />
    ) : null;
  const hasDetail = route !== null;

  const homeBody = (
    <div className="flex flex-col gap-5 px-4 pb-4">
      <CourseList routes={routes} onChoose={chooseRoute} />
      {signedIn ? null : <LockedNote loginHref={loginHref} registerHref={registerHref} />}
    </div>
  );

  // Narrow: one sheet that shows the home content or the chosen course or stop. Wide: the sheet is always the
  // home content, and the chosen course or stop is shown in the panel at the right.
  const showDetailInSheet = !wide && hasDetail;

  return (
    <div className="relative md:-mt-6">
    <div
      ref={wrap}
      data-dark={settings.dark}
      className="trail-map relative h-dvh w-full overflow-hidden [--tab-room:5.5rem] md:[--tab-room:0rem]"
    >
      <MapScreenCanvasLoader
        routes={routes}
        routeId={routeId}
        stopId={stopId}
        onSelectRoute={chooseRoute}
        onSelectStop={chooseStop}
        coveredPx={sheetHeightPx(snap, available) + tabPx}
        settings={settings}
        mergeStops={mergeStops}
      />
      <MapSheet snap={snap} onSnap={setSnap} available={available} tabPx={tabPx} header={showDetailInSheet ? detailHeader : homeHeader}>
        {showDetailInSheet ? detailBody(true) : homeBody}
      </MapSheet>
    </div>

    {wide && hasDetail ? (
      <aside aria-label={t`くわしい情報`} className="absolute left-full top-0 ml-10 h-dvh w-[21rem] border-l border-surface">
        <div className="h-full overflow-y-auto overscroll-contain px-6 py-5">
          <HeroPhoto photo={photo} placeholder={photoPlaceholder} />
          <div className="pt-3">{detailHeader}</div>
          <div className="-mx-4 pb-6 pt-3">{detailBody(false)}</div>
        </div>
      </aside>
    ) : null}
    </div>
  );
}

function SheetTitle({ back, backLabel, title, lang }: { back: () => void; backLabel: string; title: string; lang: "ja" | "en" }) {
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={back} className="tap-target inline-flex items-center gap-1 self-start text-lg font-bold text-accent underline underline-offset-4">
        <ChevronLeftIcon />
        <span lang={lang} className="max-w-[16rem] truncate">
          {backLabel}
        </span>
      </button>
      <h2 lang={lang} className="text-2xl font-bold leading-snug">
        {title}
      </h2>
    </div>
  );
}

/** The 19 courses as numbered buttons, so a course can be chosen without finding its area on the map. */
function RouteChips({ routes, onChoose, selectedId }: { routes: MapScreenRoute[]; onChoose: (id: string) => void; selectedId: string | null }) {
  const { t } = useLingui();
  const ordered = [...routes].sort((a, b) => a.order - b.order);
  return (
    <div role="group" aria-label={t`区間をえらぶ`} className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-2">
      {ordered.map((r) => {
        const order = r.order;
        const name = r.name;
        const label = t`${order}. ${name}`;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChoose(r.id)}
            aria-label={label}
            aria-pressed={r.id === selectedId}
            className={`tap-target grid min-w-12 shrink-0 place-items-center rounded-full border-[3px] px-3 text-lg font-bold tabular-nums ${
              r.id === selectedId ? "bg-brand text-on-brand" : "bg-paper text-ink hover:bg-surface"
            } ${r.status === "soon" ? "border-dashed border-line" : "border-brand"}`}
          >
            {r.order}
          </button>
        );
      })}
    </div>
  );
}

/** Every course as a row, so a course can be chosen by its name without finding it on the map. */
function CourseList({ routes, onChoose }: { routes: MapScreenRoute[]; onChoose: (id: string) => void }) {
  const { t } = useLingui();
  const ordered = [...routes].sort((a, b) => a.order - b.order);
  return (
    <ol className="flex flex-col">
      {ordered.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onChoose(r.id)}
            className="tap-target flex w-full items-center gap-3 border-t border-line/30 py-3 text-left hover:bg-surface"
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full border-[3px] text-lg font-bold tabular-nums ${r.status === "soon" ? "border-dashed border-line text-muted" : "border-brand"}`}
            >
              {r.order}
            </span>
            <span className="min-w-0 flex-1">
              <span lang={r.nameLang} className={`block text-xl font-bold leading-snug ${r.status === "soon" ? "text-muted" : ""}`}>
                {r.name}
              </span>
              {r.prefecture || r.municipality ? (
                <span className="block text-lg text-muted">
                  {r.prefecture ? <PrefectureName value={r.prefecture} /> : null}
                  {r.prefecture && r.municipality ? " " : null}
                  {r.municipality}
                </span>
              ) : null}
              {r.status === "soon" ? <span className="block text-base font-bold text-muted">{t`準備中`}</span> : null}
            </span>
            <ChevronIcon />
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Navigation and stamps need an account: a visitor who is not signed in is told so, and offered the way in. */
function LockedNote({ loginHref, registerHref }: { loginHref: string; registerHref: string }) {
  const { t } = useLingui();
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4">
      <p className="text-lg font-bold leading-snug">{t`ログインすると、ルート案内とスタンプが使えます。見るだけなら、このままどうぞ。`}</p>
      <Link href={registerHref} className={primaryLink}>
        {t`新規登録`}
      </Link>
      <Link href={loginHref} className={linkButton}>
        {t`ログイン`}
      </Link>
    </section>
  );
}

function RoutePanel({
  route,
  photo,
  signedIn,
  loginHref,
  registerHref,
  onChooseStop,
}: {
  route: MapScreenRoute;
  /** The photo frame, when it belongs in this part of the page (in the sheet; at the right it sits above the title). */
  photo: ReactNode;
  signedIn: boolean;
  loginHref: string;
  registerHref: string;
  onChooseStop: (id: string) => void;
}) {
  const { t } = useLingui();
  const { stampedCount, spotCount } = route;
  return (
    <div className="flex flex-col gap-5 px-4">
      {photo}
      {route.prefecture || route.municipality ? (
        <p className="text-lg text-muted">
          {route.prefecture ? <PrefectureName value={route.prefecture} /> : null}
          {route.prefecture && route.municipality ? " " : null}
          {route.municipality}
        </p>
      ) : null}

      {route.status === "soon" ? <p className="rounded-2xl bg-surface p-4 text-lg font-bold">{t`この区間は、準備中です。`}</p> : null}

      {route.description ? <p className="whitespace-pre-line text-lg leading-8">{route.description}</p> : null}

      <RouteStats route={route} />

      {stampedCount !== null && spotCount > 0 ? (
        <p className="text-xl font-bold tabular-nums">{t`スタンプ ${stampedCount} / ${spotCount}`}</p>
      ) : null}

      {route.status === "ready" ? (
        <Link href={route.href} className={primaryLink}>
          {t`この区間のページを開く`}
        </Link>
      ) : null}

      {route.elevations ? <ElevationProfile elevations={route.elevations} distanceKm={route.distanceKm} /> : null}

      {route.spots.length > 0 ? (
        <section>
          <h3 className="pb-2 text-xl font-bold">{t`スタンプの場所`}</h3>
          <ol className="flex flex-col">
            {route.spots.map((spot) => {
              const onMap = route.stops?.some((x) => x.id === spot.id) ?? false;
              const row = (
                <>
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full border-[3px] text-lg font-bold tabular-nums ${spot.stamped ? "border-shu bg-shu text-on-shu" : "border-ink"}`}
                  >
                    {spot.order}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span lang={spot.nameLang} className="block text-xl font-bold leading-snug">
                      {spot.name}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 text-lg">
                      <StatusWord status={spot.status} />
                      {spot.stamped === true ? <span className="font-bold">{t`押した`}</span> : null}
                    </span>
                  </span>
                  <ChevronIcon />
                </>
              );
              const rowClass = "tap-target flex w-full items-center gap-3 border-t border-line/30 py-3 text-left hover:bg-surface";
              return (
                <li key={spot.id}>
                  {onMap ? (
                    <button type="button" onClick={() => onChooseStop(spot.id)} className={rowClass}>
                      {row}
                    </button>
                  ) : (
                    <Link href={spot.href} className={rowClass}>
                      {row}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
          {route.stops ? null : <p className="pt-2 text-base text-muted">{t`地図の上の場所は、準備中です。`}</p>}
        </section>
      ) : route.status === "ready" ? (
        <p className="rounded-2xl bg-surface p-4 text-lg">{t`スタンプの場所は、まだ準備中です。`}</p>
      ) : null}

      {signedIn ? null : <LockedNote loginHref={loginHref} registerHref={registerHref} />}
    </div>
  );
}

function StopPanel({
  route,
  stop,
  photo,
  signedIn,
  locale,
  loginHref,
  registerHref,
  stampMock,
}: {
  route: MapScreenRoute;
  stop: MapScreenStop;
  /** The photo frame, when it belongs in this part of the page. */
  photo: ReactNode;
  signedIn: boolean;
  locale: string;
  loginHref: string;
  registerHref: string;
  stampMock?: StampMock;
}) {
  const { t } = useLingui();
  const updated = stop.statusUpdatedAt ? formatUpdated(locale, stop.statusUpdatedAt) : "";
  return (
    <div className="flex flex-col gap-5 px-4">
      {photo}
      <p className="text-xl">
        <StatusWord status={stop.status} />
      </p>

      {stop.statusNote ? (
        <p className="rounded-2xl border-2 border-line p-3 text-lg leading-7">
          {stop.statusNote}
          {stop.statusUpdatedAt ? <span className="block text-base text-muted">{t`${updated} 更新`}</span> : null}
        </p>
      ) : null}

      {route.draft ? (
        <p className="flex items-start gap-2 text-base text-muted">
          <span className="shrink-0 text-caution">
            <WarningIcon />
          </span>
          {t`この場所の位置は仮のもので、まだ確認されていません。`}
        </p>
      ) : null}

      {stop.description ? <p className="whitespace-pre-line text-lg leading-8">{stop.description}</p> : null}

      {stop.stamped === true ? (
        <div className="flex items-center gap-4">
          <StampFace state="stamped" number={stop.order} rough className="h-14 w-14 shrink-0" />
          <p className="text-xl font-bold">{t`スタンプを押しました`}</p>
        </div>
      ) : null}

      {signedIn && stop.stamped !== null ? (
        <StampHere spotId={stop.id} status={stop.status} alreadyStamped={stop.stamped} loginHref={loginHref} mock={stampMock} inSheet />
      ) : (
        <LockedNote loginHref={loginHref} registerHref={registerHref} />
      )}

      <Link href={stop.href} className={linkButton}>
        {t`この場所のページを開く`}
      </Link>
    </div>
  );
}
