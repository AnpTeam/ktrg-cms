"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChevronIcon, WarningIcon } from "@/components/icons";
import { ExpandableText } from "@/components/ExpandableText";
import { ElevationProfile } from "@/components/ElevationProfile";
import { PrefectureName } from "@/components/PrefectureName";
import { RouteStats } from "@/components/RouteStats";
import { StampHere } from "@/components/StampHere";
import { NavigationStart } from "@/components/navigation/NavigationHud";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { StampFace } from "@/components/StampFace";
import { StatusWord } from "@/components/StatusWord";
import { formatUpdated } from "@/lib/format";
import { sheetHeightPx, type MapScreenRoute, type MapScreenStop, type SheetSnap } from "@/lib/map-screen";
import type { MapSettings } from "@/lib/map-settings";
import type { StampMock } from "@/lib/stamp-flow";
import { MapScreenCanvasLoader } from "./MapScreenCanvasLoader";
import { MapSheet } from "./MapSheet";
import { Gallery, SheetHero } from "./SheetHero";

// The map tab (WBS 3.2.10): a map of the whole trail with a bottom sheet that never hides it. Nothing is
// chosen at first: the sheet offers the 19 courses. Choose a course (on the map or in the
// sheet) and the other areas fold away while its path and stops appear; choose a stop and the sheet shows it, with
// the stamp button for someone who is signed in. Anyone may look around; navigation and stamps are for accounts.

const linkButton = "tap-target flex min-h-12 w-full items-center justify-center rounded-xl border border-ink px-5 text-lg font-bold text-ink hover:bg-surface";
const primaryLink = "tap-target flex min-h-12 w-full items-center justify-center rounded-xl bg-ink px-5 text-lg font-bold text-paper";
// Room kept under the sheet for the floating tab bar (a rail on wide screens).
const TAB_ROOM_REM = 5.5;
// From this width (a desktop) the map fills the whole area beside the sidebar, and what a phone shows in a bottom sheet
// (the courses, the chosen course or stop) is a panel floating at the left of the map.
const WIDE_QUERY = "(min-width: 1024px)";
const PANEL_REM = 26; // the panel's width
const PANEL_MARGIN_REM = 0.75; // its gap to the map's edges

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
  locale,
  loginHref,
  registerHref,
  stampMock,
  initialRouteId = null,
  initialStopId = null,
}: {
  /** Open with this course (and stop) chosen, as when a place page links here with "show in the map". */
  initialRouteId?: string | null;
  initialStopId?: string | null;
  routes: MapScreenRoute[];
  settings: MapSettings;
  mergeStops: boolean;
  signedIn: boolean;
  locale: string;
  loginHref: string;
  registerHref: string;
  /** Development only: pretend answers for the stamp button. */
  stampMock?: StampMock;
}) {
  const { t } = useLingui();
  const wrap = useRef<HTMLDivElement>(null);
  const nav = useNavigation();
  // Coming back to the map during a navigation opens its course again.
  const [routeId, setRouteId] = useState<string | null>(initialRouteId ?? nav.session?.routeId ?? null);
  const [stopId, setStopId] = useState<string | null>(initialRouteId ? initialStopId : null);
  const [snap, setSnap] = useState<SheetSnap>(initialRouteId || nav.session ? "half" : "peek");
  const [available, setAvailable] = useState(520);
  // The room under the sheet taken by the tab bar (none on a wide screen, where it is a rail).
  const [tabPx, setTabPx] = useState(88);
  // On a desktop: how much of the map's left side the panel covers.
  const [panelPx, setPanelPx] = useState(0);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
  // When a navigation starts, the sheet steps down on a phone so the map and the navigation toast are in view.
  // Adjusted while rendering (the pattern React recommends for state that follows another value).
  const navRouteId = nav.session?.routeId ?? null;
  const [seenNavRouteId, setSeenNavRouteId] = useState(navRouteId);
  if (seenNavRouteId !== navRouteId) {
    setSeenNavRouteId(navRouteId);
    if (navRouteId && !wide) setSnap("peek");
  }

  // Below the sheet: the tab bar, and the navigation toast while one runs (on a desktop the toast is beside the panel).
  const bottomPx = tabPx + (wide ? 0 : nav.toastPx);

  const route = routes.find((r) => r.id === routeId) ?? null;
  const stop = route?.stops?.find((s) => s.id === stopId) ?? null;

  // At its top resting place the sheet covers the whole page, so the site's own top bar steps aside.
  useEffect(() => {
    const covered = snap === "full" && !wide;
    document.body.classList.toggle("map-sheet-full", covered);
    return () => document.body.classList.remove("map-sheet-full");
  }, [snap, wide]);

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
      setPanelPx(window.matchMedia(WIDE_QUERY).matches ? (PANEL_REM + 2 * PANEL_MARGIN_REM) * rem : 0);
      setAvailable(Math.max(240, el.clientHeight - tab));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // On a narrow screen the sheet rises to show what was chosen; on a desktop the panel just shows it.
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

  const homeHeader = (
    <div>
      <h1 className="font-serif text-2xl font-bold leading-snug text-accent">{t`マップ`}</h1>
      <p className="text-lg leading-snug">{t`区間を選ぶと、道とスタンプの場所が見えます。`}</p>
      <RouteChips routes={routes} onChoose={chooseRoute} selectedId={routeId} />
    </div>
  );

  // The banner at the top of the chosen course or stop: its photo (a stop without one shows its course's) with the
  // name written over it. It scrolls away with the rest, so reading on reveals the history and the gallery.
  const photo = stop?.photo ?? route?.photo ?? null;
  const hero = route ? (
    <SheetHero
      photo={photo}
      title={stop ? `${stop.order}. ${stop.name}` : `${route.order}. ${route.name}`}
      lang={stop ? stop.nameLang : route.nameLang}
      eyebrow={
        stop ? (
          <span lang={route.nameLang}>{routeName}</span>
        ) : route.prefecture || route.municipality ? (
          <>
            {route.prefecture ? <PrefectureName value={route.prefecture} /> : null}
            {route.prefecture && route.municipality ? " " : null}
            {route.municipality}
          </>
        ) : null
      }
      backLabel={stop ? routeName : t`全体の地図`}
      backLang={stop ? route.nameLang : undefined}
      onBack={back}
    />
  ) : null;

  const detailBody =
    stop && route ? (
      <StopPanel route={route} stop={stop} signedIn={signedIn} locale={locale} loginHref={loginHref} registerHref={registerHref} stampMock={stampMock} />
    ) : route ? (
      <RoutePanel route={route} signedIn={signedIn} loginHref={loginHref} registerHref={registerHref} onChooseStop={(id) => chooseStop(route.id, id)} />
    ) : null;
  const hasDetail = route !== null;

  const homeBody = (
    <div className="flex flex-col gap-5 px-4 pb-4">
      <CourseList routes={routes} onChoose={chooseRoute} />
      {signedIn ? null : <LockedNote loginHref={loginHref} registerHref={registerHref} />}
    </div>
  );

  // The sheet (a bottom sheet on a phone, a panel at the left on a desktop) shows the home content, or the chosen course
  // or stop.
  const showDetailInSheet = hasDetail;

  return (
    <div className="relative md:-mt-6 lg:mt-0">
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
        coveredPx={wide ? 0 : sheetHeightPx(snap, available) + bottomPx}
        coveredLeftPx={panelPx}
        settings={settings}
        mergeStops={mergeStops}
        user={nav.session?.snapshot.position ?? null}
        guide={nav.session?.snapshot.pathLine ?? null}
      />
      <MapSheet panel={wide} snap={snap} onSnap={setSnap} available={available} tabPx={bottomPx} header={showDetailInSheet ? null : homeHeader}>
        {showDetailInSheet ? (
          <div className="flex flex-col gap-4">
            {hero}
            {detailBody}
          </div>
        ) : (
          homeBody
        )}
      </MapSheet>
    </div>

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
  signedIn,
  loginHref,
  registerHref,
  onChooseStop,
}: {
  route: MapScreenRoute;
  signedIn: boolean;
  loginHref: string;
  registerHref: string;
  onChooseStop: (id: string) => void;
}) {
  const { t } = useLingui();
  const { stampedCount, spotCount } = route;
  return (
    <div className="flex flex-col gap-5 px-4">
      {route.status === "soon" ? <p className="rounded-2xl bg-surface p-4 text-lg font-bold">{t`この区間は、準備中です。`}</p> : null}

      {route.description ? (
        <ExpandableText text={route.description} className="whitespace-pre-line text-lg leading-8">
          {route.description}
        </ExpandableText>
      ) : null}

      <RouteStats route={route} />

      {signedIn && route.status === "ready" ? <NavigationStart route={route} /> : null}

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

      {route.history ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xl font-bold">{t`歴史・由来`}</h3>
          <ExpandableText text={route.history} className="whitespace-pre-line text-lg leading-8">
            {route.history}
          </ExpandableText>
        </section>
      ) : null}

      {route.access ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xl font-bold">{t`アクセス・交通`}</h3>
          <ExpandableText text={route.access} className="whitespace-pre-line text-lg leading-8">
            {route.access}
          </ExpandableText>
        </section>
      ) : null}

      {route.gallery.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xl font-bold">{t`写真`}</h3>
          <Gallery photos={route.gallery} label={t`この区間の写真`} />
        </section>
      ) : null}

      {signedIn ? null : <LockedNote loginHref={loginHref} registerHref={registerHref} />}
    </div>
  );
}

function StopPanel({
  route,
  stop,
  signedIn,
  locale,
  loginHref,
  registerHref,
  stampMock,
}: {
  route: MapScreenRoute;
  stop: MapScreenStop;
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
