"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChevronUpIcon, WarningIcon } from "@/components/icons";
import { ElevationProfile } from "@/components/ElevationProfile";
import { PlaceLine } from "@/components/PlaceLine";
import { RichText } from "@/components/RichText";
import { RouteStats } from "@/components/RouteStats";
import { StampHere } from "@/components/StampHere";
import { useRouteLine } from "./useRouteLine";
import { NAV_HANDOFF_MS, NAV_RESUME_EVENT, NavigationResume, NavigationStart } from "@/components/navigation/NavigationHud";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { StampFace } from "@/components/StampFace";
import { StatusWord } from "@/components/StatusWord";
import { formatUpdated } from "@/lib/format";
import { sheetHeightPx, type MapScreenRoute, type MapScreenStop, type SheetSnap } from "@/lib/map-screen";
import type { MapSettings } from "@/lib/map-settings";
import type { StampMock } from "@/lib/stamp-flow";
import { MapScreenCanvasLoader } from "./MapScreenCanvasLoader";
import { MapSheet } from "./MapSheet";
import { SheetHero } from "./SheetHero";
import { RoutePhoto } from "@/components/RoutePhoto";
import { RoutePill } from "@/components/RoutePill";
import { buttonStyle } from "@/components/button";

// The map tab (WBS 3.2.10): a map of the whole trail with a bottom sheet that never hides it. Nothing is
// chosen at first: the sheet offers the 19 courses. Choose a course (on the map or in the
// sheet) and the other areas fold away while its path and stops appear; choose a stop and the sheet shows it, with
// the stamp button for someone who is signed in. Anyone may look around; navigation and stamps are for accounts.

const linkButton = buttonStyle("secondary", "md", "flex w-full");
// Room kept under the sheet for the floating tab bar (a rail on wide screens).
const TAB_ROOM_REM = 5.5;
// From this width (a desktop) the map fills the whole area beside the sidebar, and what a phone shows in a bottom sheet
// (the courses, the chosen course or stop) is a panel floating at the left of the map.
const WIDE_QUERY = "(min-width: 1024px)";
const PANEL_REM = 26; // the panel's width
const RAIL_REM = 4.5; // its width when folded
const SOON_CIRCLE = "border-transparent bg-line/25 text-muted"; // a course not ready yet: a plain grey disc
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
  locale,
  loginHref,
  stampMock,
  initialRouteId = null,
  initialStopId = null,
  initialPlaceId = null,
}: {
  /** Open with this course (and stop) chosen, as when a place page links here with "show in the map". */
  initialRouteId?: string | null;
  initialStopId?: string | null;
  /** A place of that course to bring into view (from a route page's "nearby places"). */
  initialPlaceId?: string | null;
  routes: MapScreenRoute[];
  settings: MapSettings;
  mergeStops: boolean;
  locale: string;
  loginHref: string;
  /** Development only: pretend answers for the stamp button. */
  stampMock?: StampMock;
}) {
  const { t } = useLingui();
  const wrap = useRef<HTMLDivElement>(null);
  const nav = useNavigation();
  const { toastPx: navToastPx, bannerPx: navBannerPx, setSheetUp } = nav;
  // Coming back to the map during a navigation opens its course again.
  const [routeId, setRouteId] = useState<string | null>(initialRouteId ?? nav.session?.routeId ?? null);
  const [stopId, setStopId] = useState<string | null>(initialRouteId ? initialStopId : null);
  // The stop was opened from the sutra mound pins, not from its course: it is then shown without the course's numbering.
  const [viaMounds, setViaMounds] = useState(false);
  // Coming back to the map during a navigation: the navigation has the bottom of the screen; the sheet waits below.
  const [snap, setSnap] = useState<SheetSnap>(initialRouteId ? "half" : nav.session ? "hidden" : "peek");
  const [available, setAvailable] = useState(520);
  // The room under the sheet taken by the tab bar (none on a wide screen, where it is a rail).
  const [tabPx, setTabPx] = useState(88);
  // On a desktop: how much of the map's left side the panel covers.
  const [panelPx, setPanelPx] = useState(0);
  // On a desktop: the panel folded to a narrow rail, for more map. Choosing something opens it again.
  const [folded, setFolded] = useState(false);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
  // When a navigation starts, the sheet steps down on a phone so the map and the navigation toast are in view.
  // Adjusted while rendering (the pattern React recommends for state that follows another value).
  const navRouteId = nav.session?.routeId ?? null;
  const [seenNavRouteId, setSeenNavRouteId] = useState(navRouteId);
  // Where the sheet was when the navigation began, so ending it puts the screen back as it was.
  const [snapBeforeNav, setSnapBeforeNav] = useState<SheetSnap | null>(null);
  if (seenNavRouteId !== navRouteId) {
    setSeenNavRouteId(navRouteId);
    if (navRouteId && !seenNavRouteId && !wide) {
      setSnapBeforeNav(snap);
      setSnap("hidden");
    } else if (navRouteId && !wide) setSnap("hidden");
    else if (!navRouteId && snapBeforeNav !== null) {
      // Only if the visitor has not moved the sheet since: the start put it away.
      if (snap === "hidden") setSnap(snapBeforeNav);
      setSnapBeforeNav(null);
    }
  }

  // Below the sheet: the tab bar, and the navigation toast while one runs (on a desktop the toast is beside the panel).
  const bottomPx = tabPx + (wide ? 0 : nav.toastPx);

  // During a navigation on a phone the bottom of the screen holds one thing at a time: the navigation controls or the sheet.
  // Opening the sheet first sends the controls away, then raises the sheet; putting the sheet away brings them back.
  const navigating = nav.session !== null && !wide;
  useEffect(() => {
    setSheetUp(navigating && snap !== "hidden");
  }, [navigating, snap, setSheetUp]);
  useEffect(() => () => setSheetUp(false), [setSheetUp]);
  const handoff = useRef({ navigating, snap });
  useEffect(() => {
    handoff.current = { navigating, snap };
  }, [navigating, snap]);
  const openSheet = useCallback(
    (next: SheetSnap | ((s: SheetSnap) => SheetSnap)) => {
      const { navigating: on, snap: now } = handoff.current;
      if (!on || now !== "hidden") return setSnap(next);
      setSheetUp(true);
      window.setTimeout(() => setSnap(next), NAV_HANDOFF_MS);
    },
    [setSheetUp],
  );
  // 「ナビにもどる」 on the navigation banner.
  const [resumeTick, setResumeTick] = useState(0);
  useEffect(() => {
    const resume = () => {
      setSnap("hidden");
      setStopId(null);
      if (navRouteId) setRouteId(navRouteId); // the visitor may have been looking at another course
      setResumeTick((n) => n + 1);
    };
    window.addEventListener(NAV_RESUME_EVENT, resume);
    return () => window.removeEventListener(NAV_RESUME_EVENT, resume);
  }, [navRouteId]);

  const route = routes.find((r) => r.id === routeId) ?? null;
  const chosen = route !== null;
  const stop = route?.stops?.find((s) => s.id === stopId) ?? null;

  // At its top resting place the sheet covers the whole page, so the site's own top bar steps aside.
  useEffect(() => {
    const covered = snap === "full" && !wide;
    document.body.classList.toggle("map-sheet-full", covered);
    return () => document.body.classList.remove("map-sheet-full");
  }, [snap, wide]);

  // With a course or stop chosen, a phone's tab bar steps aside (see globals.css).
  useEffect(() => {
    document.body.classList.toggle("map-tabs-hidden", chosen);
    return () => document.body.classList.remove("map-tabs-hidden");
  }, [chosen]);

  // The page behind does not scroll: the map and the sheet are the screen.
  useEffect(() => {
    document.body.classList.add("map-screen-active");
    window.scrollTo(0, 0); // a swipe while it was loading may have scrolled the page; the lock above keeps it from being scrolled back
    return () => document.body.classList.remove("map-screen-active");
  }, []);

  // The room the sheet may use: the screen's height minus the tab bar.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const wide = window.matchMedia("(min-width: 768px)").matches;
      const tab = wide || chosen ? 0 : TAB_ROOM_REM * rem;
      setTabPx(tab);
      // A navigation on a phone: the bottom strip and the top banner are drawn over the map, and the sheet fits between them
      // (its handle must stay in view, or it cannot be pulled back down).
      const navRoom = !window.matchMedia(WIDE_QUERY).matches ? navToastPx + navBannerPx : 0;
      setPanelPx(window.matchMedia(WIDE_QUERY).matches ? ((folded ? RAIL_REM : PANEL_REM) + 2 * PANEL_MARGIN_REM) * rem : 0);
      setAvailable(Math.max(240, el.clientHeight - tab - navRoom));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [chosen, folded, navToastPx, navBannerPx]);

  // On a narrow screen the sheet rises to show what was chosen; on a desktop the panel just shows it.
  const chooseRoute = useCallback(
    (id: string) => {
      setRouteId(id);
      setStopId(null);
      setViaMounds(false);
      setFolded(false);
      if (!wide) openSheet("half");
    },
    [wide, openSheet],
  );
  const chooseStop = useCallback(
    (routeId: string, id: string, fromMounds = false) => {
      setRouteId(routeId);
      setStopId(id);
      setViaMounds(fromMounds);
      setFolded(false);
      if (!wide) openSheet((s) => (s === "peek" || s === "hidden" ? "half" : s));
    },
    [wide, openSheet],
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
      <h1 className="sr-only font-serif text-2xl font-bold leading-snug text-accent lg:not-sr-only">{t`区間の一覧`}</h1>
      <div className="lg:hidden">
        <RouteChips routes={routes} onChoose={chooseRoute} selectedId={routeId} />
      </div>
    </div>
  );

  // The banner at the top of the chosen course or stop: its photo (a stop without one shows its course's) with the
  // name written over it. A course's is lower, so its buttons are in view with the sheet at half height.
  const photo = stop?.photo ?? route?.photo ?? null;
  const hero = route ? (
    <SheetHero
      short={!stop}
      photo={photo}
      title={stop ? `${stop.order === null || viaMounds ? "" : `${stop.order}. `}${stop.name}` : `${route.order}. ${route.name}`}
      lang={stop ? stop.nameLang : route.nameLang}
      eyebrow={
        stop ? (
          <span lang={route.nameLang}>{routeName}</span>
        ) : route.prefecture || route.municipality ? (
          <>
            <PlaceLine prefecture={route.prefecture} place={route.municipality} locale={locale} />
          </>
        ) : null
      }
      backLabel={stop ? t`戻る` : t`全体の地図`}
      onBack={back}
    />
  ) : null;

  const detailBody =
    stop && route ? (
      <StopPanel route={route} stop={stop} showNumber={!viaMounds} locale={locale} loginHref={loginHref} stampMock={stampMock} />
    ) : route ? (
      <RoutePanel route={route} onChooseStop={(id) => chooseStop(route.id, id)} />
    ) : null;
  const hasDetail = route !== null;

  const homeBody = (
    <div className="flex flex-col gap-5 px-4 pb-4">
      <CourseList routes={routes} onChoose={chooseRoute} locale={locale} />
    </div>
  );

  // The sheet (a bottom sheet on a phone, a panel at the left on a desktop) shows the home content, or the chosen course
  // or stop.
  const showDetailInSheet = hasDetail;

  return (
    <div className="relative md:-mt-6 lg:mt-0">
    <div
      ref={wrap}
      className={`trail-map map-screen relative h-dvh w-full overflow-hidden md:[--tab-room:0rem] ${chosen ? "[--tab-room:0rem]" : "[--tab-room:calc(5.5rem+env(safe-area-inset-bottom))]"}`}
    >
      <NavigationResume routes={routes} onResume={setRouteId} />
      <MapScreenCanvasLoader
        routes={routes}
        routeId={routeId}
        stopId={stopId}
        onSelectRoute={chooseRoute}
        onSelectStop={chooseStop}
        onSelectMound={(routeId, id) => chooseStop(routeId, id, true)}
        focusPlaceId={initialPlaceId}
        coveredPx={wide ? 0 : sheetHeightPx(snap, available) + bottomPx}
        coveredLeftPx={panelPx}
        controlsTopPx={wide ? 0 : navBannerPx}
        settings={settings}
        mergeStops={mergeStops}
        user={nav.session?.snapshot.position ?? null}
        towardsDeg={nav.session?.snapshot.state.bearingDeg ?? null}
        far={nav.session?.snapshot.state.far ?? false}
        resumeTick={resumeTick}
        guide={nav.session?.snapshot.pathLine ?? null}
      />
      {!wide && snap === "hidden" ? (
        <button
          type="button"
          onClick={() => openSheet(route ? "half" : "peek")}
          // Measured from the screen, as the tab bar is, so it stays put when the tab bar steps aside for a chosen course.
          className="tap-target fixed bottom-[calc(5rem+var(--nav-toast,0px)+env(safe-area-inset-bottom))] left-3 z-[6] flex items-center gap-2 rounded-full bg-paper px-4 text-lg font-bold text-ink shadow-[0_4px_16px_rgb(0_0_0/0.28)]"
        >
          <ChevronUpIcon size={22} />
          {route ? t`区間の情報を見る` : t`区間の一覧を見る`}
        </button>
      ) : null}
      <MapSheet panel={wide} folded={wide && folded} onFold={() => setFolded(!folded)} rail={<RouteChips column routes={routes} onChoose={chooseRoute} selectedId={routeId} />} snap={snap} onSnap={setSnap} available={available} tabPx={bottomPx} header={showDetailInSheet ? null : homeHeader} contentKey={`${routeId ?? ""}/${stopId ?? ""}`}>
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
function RouteChips({ routes, onChoose, selectedId, column = false }: { routes: MapScreenRoute[]; onChoose: (id: string) => void; selectedId: string | null; column?: boolean }) {
  const { t } = useLingui();
  const ordered = [...routes].sort((a, b) => a.order - b.order);
  return (
    <div role="group" aria-label={t`区間をえらぶ`} className={column ? "mt-2 flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto pb-3 [scrollbar-width:thin]" : "-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-2"}>
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
            className={`tap-target grid size-12 shrink-0 place-items-center rounded-full border-[3px] text-lg font-bold tabular-nums ${
              r.id === selectedId ? "bg-brand text-on-brand" : r.status === "soon" ? "hover:bg-line/40" : "bg-paper text-ink hover:bg-surface"
            } ${r.status === "soon" ? SOON_CIRCLE : "border-brand"}`}
          >
            {r.order}
          </button>
        );
      })}
    </div>
  );
}

/** Every course as a row, so a course can be chosen by its name without finding it on the map. */
function CourseList({ routes, onChoose, locale }: { routes: MapScreenRoute[]; onChoose: (id: string) => void; locale: string }) {
  const ordered = [...routes].sort((a, b) => a.order - b.order);
  return (
    <ol className="flex flex-col gap-2">
      {ordered.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onChoose(r.id)} className="tap-target block w-full rounded-[1.75rem] text-left hover:opacity-95">
            <RoutePill
              route={r}
              brief
              name={<span lang={r.nameLang}>{r.name}</span>}
              place={r.prefecture || r.municipality ? <PlaceLine prefecture={r.prefecture} place={r.municipality} locale={locale} /> : null}
              photo={r.photo?.src ?? null}
            />
          </button>
        </li>
      ))}
    </ol>
  );
}

/** How many stops show before 「すべて見る」: the sheet stays short. */
const STOPS_SHOWN = 4;

/** The stamp places of a course: a photo, the name, and how long the walk from the place before takes. */
function StopRows({ route, onChooseStop }: { route: MapScreenRoute; onChooseStop: (id: string) => void }) {
  const { t } = useLingui();
  const [all, setAll] = useState(false);
  const shown = all ? route.spots : route.spots.slice(0, STOPS_SHOWN);
  const rides = { ferry: (n: number) => t`船で約${n}分`, bus: (n: number) => t`バスで約${n}分`, train: (n: number) => t`電車で約${n}分`, other: (n: number) => t`乗り物で約${n}分` };
  return (
    <section>
      <h3 className="pb-2 text-xl font-bold">{t`スタンプの場所`}</h3>
      <ol className="flex flex-col gap-2">
        {shown.map((spot) => {
          const onMap = route.stops?.some((x) => x.id === spot.id) ?? false;
          const leg = spot.fromPrev;
          // The look of a course in the list: the photo at the right, fading into the card.
          const row = (
            <>
              <span className="absolute inset-y-0 right-0 block w-2/5 overflow-hidden">
                <RoutePhoto src={spot.photo?.src ?? null} alt="" />
                <span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-surface from-20% to-transparent to-85%" />
              </span>
              <span className="relative flex min-h-24 flex-col justify-center py-3 pl-4 pr-[34%]">
                <span lang={spot.nameLang} className="block text-xl font-bold leading-snug">
                  {spot.name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-base leading-snug">
                  <StatusWord status={spot.status} />
                  {spot.stamped === true ? <span className="font-bold">{t`押した`}</span> : null}
                  {leg ? <span className="tabular-nums">{leg.mode ? rides[leg.mode](leg.minutes) : t`歩いて約${leg.minutes}分`}</span> : null}
                </span>
              </span>
              <span className={`absolute right-3 top-3 grid size-8 place-items-center rounded-full text-lg font-bold tabular-nums ${spot.stamped ? "bg-shu text-on-shu" : "badge-pattern bg-brand text-on-brand"}`}>{spot.order}</span>
            </>
          );
          const rowClass = "tap-target relative block w-full overflow-hidden rounded-[1.75rem] bg-surface text-left";
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
      {route.spots.length > STOPS_SHOWN ? (
        <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className={buttonStyle("secondary", "md", "mt-2 flex w-full")}>
          {all ? t`少なく見る` : t`すべて見る（${route.spots.length}か所）`}
        </button>
      ) : null}
      {route.spots.some((s) => s.fromPrev) ? <p className="pt-2 text-base leading-snug text-muted">{t`時間は、前の場所から休まず歩いたときの目安です。実際とは違うことがあります。`}</p> : null}
      {route.stops ? null : <p className="pt-2 text-base text-muted">{t`地図の上の場所は、準備中です。`}</p>}
    </section>
  );
}

function RoutePanel({
  route,
  onChooseStop,
}: {
  route: MapScreenRoute;
  onChooseStop: (id: string) => void;
}) {
  const { t } = useLingui();
  const { stampedCount, spotCount } = route;
  // With a graph on show, the course's own line is loaded now (not left for later), so the graph is the interactive one.
  const fetched = useRouteLine(route.elevations && route.hasLine && !route.line ? route.id : null);
  const more = (
    <Link href={route.href} className={linkButton}>
      {t`詳しく見る`}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4 px-4">
      {route.status === "soon" ? <p className="rounded-2xl bg-surface p-4 text-lg font-bold">{t`この区間は、準備中です。`}</p> : null}

      <RouteStats route={route} compact />

      {stampedCount !== null && spotCount > 0 ? (
        <p className="text-lg font-bold tabular-nums">{t`スタンプ ${stampedCount} / ${spotCount}`}</p>
      ) : null}

      {/* What can be done from the map comes first, so it is seen at half height. The reading is on the course's own page. */}
      {route.status === "ready" ? <NavigationStart route={route} more={more} /> : more}

      {route.spots.length > 0 ? (
        <StopRows key={route.id} route={route} onChooseStop={onChooseStop} />
      ) : route.status === "ready" ? (
        <p className="rounded-2xl bg-surface p-4 text-lg">{t`スタンプの場所は、まだ準備中です。`}</p>
      ) : null}

      {route.elevations ? <ElevationProfile elevations={route.elevations} distanceKm={route.distanceKm} routeLine={fetched?.line} lineElevations={fetched?.elevations} /> : null}
    </div>
  );
}

function StopPanel({
  route,
  stop,
  showNumber,
  locale,
  loginHref,
  stampMock,
}: {
  route: MapScreenRoute;
  stop: MapScreenStop;
  /** False when the stop was opened from the sutra mound pins: the course's numbering means nothing there. */
  showNumber: boolean;
  locale: string;
  loginHref: string;
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

      {stop.description ? (
        <div className="whitespace-pre-line text-lg leading-8">
          <RichText text={stop.description} />
        </div>
      ) : null}

      {stop.stamped === true ? (
        <div className="flex items-center gap-4">
          <StampFace state="stamped" number={showNumber ? (stop.order ?? undefined) : undefined} rough className="h-14 w-14 shrink-0" />
          <p className="text-xl font-bold">{t`スタンプを押しました`}</p>
        </div>
      ) : null}

      {stop.noStamp ? (
        <p className="self-start rounded-lg border-2 border-dashed border-line px-2 text-base font-bold">{t`スタンプなし`}</p>
      ) : (
        <StampHere
          spotId={stop.id}
          status={stop.status}
          alreadyStamped={stop.stamped === true}
          loginHref={loginHref}
          mock={stampMock}
          inSheet
          progress={route.stops ? { rallyName: route.name, place: stop.name, before: route.stops.filter((s) => !s.noStamp && s.stamped === true).length, total: route.stops.filter((s) => !s.noStamp).length } : undefined}
        />
      )}

      <Link href={stop.href} className={linkButton}>
        {t`この場所のページを開く`}
      </Link>
    </div>
  );
}
