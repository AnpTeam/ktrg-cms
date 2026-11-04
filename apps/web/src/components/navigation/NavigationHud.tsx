"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getRouteLine } from "@/lib/navigation/line-client";
import { loadResume } from "@/lib/navigation/resume";
import { useLingui } from "@lingui/react/macro";
import { StampHere } from "@/components/StampHere";
import { compassPoint, type CompassPoint, type TurnKind } from "@/lib/navigation/geometry";
import { modelFromMapRoute } from "@/lib/navigation/input";
import type { MapScreenRoute } from "@/lib/map-screen";
import { courseProgress } from "@/lib/navigation/progress";
import { distanceParts } from "@/lib/stamp-flow";
import { useNavVoice } from "./useNavVoice";
import { NavElevation } from "./NavElevation";
import { legProfile } from "@/lib/navigation/elevation";
import { NavFarCard } from "./NavFarCard";
import { NavTargetPicker } from "./NavTargetPicker";
import { useNavigation, type NavStopInfo } from "./NavigationProvider";

// The navigation toast: a small card floating at the bottom of the screen while a navigation runs, on every tab (on a
// phone just above the tab bar and the phone's own bar, on a wider screen at the bottom right). Two lines: which way and
// how far, then the stop and a short word on how it is guiding. The page makes room for it (its height is reported to
// the provider and as the CSS variable --nav-toast), so it covers nothing. The sign on the left is the next turn
// (straight when none is near); the way to the stop is an arrow on the visitor's dot on the map.

const primary = "tap-target flex min-h-14 w-full items-center justify-center rounded-xl bg-ink px-5 text-xl font-bold text-paper";
const quiet = "tap-target flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-ink bg-paper px-3 text-base font-bold text-ink hover:bg-surface";

/** A fix older than this is said to be old, with its age. */
const STALE_MS = 30_000;
/** A turn is announced from this far away ("in 120 m, turn left"); further off, the toast gives the direction. */
const TURN_ANNOUNCE_M = 300;
/** How the turn arrow is drawn: straight up is "ahead", so a left turn leans 90 degrees to the left. */
const TURN_ARROW_DEG: Record<TurnKind, number> = { "slight-left": -45, left: -90, "sharp-left": -135, "slight-right": 45, right: 90, "sharp-right": 135, "u-turn": 180 };

/** The turn sign, like a road sign: the arrow goes up and bends the way to turn; straight up when no turn is near. */
function TurnSign({ kind }: { kind: TurnKind | null }) {
  const deg = kind ? TURN_ARROW_DEG[kind] : 0;
  const rad = (deg * Math.PI) / 180;
  // A U-turn goes up, round and back down; every other sign bends once at the middle.
  const [x, y] = kind === "u-turn" ? [17, 31] : [24 + 13 * Math.sin(rad), 22 - 13 * Math.cos(rad)];
  const stem = kind === "u-turn" ? "M31 41 V21 a7 7 0 0 0 -14 0 V31" : `M24 41 V22 L${x} ${y}`;
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-11 shrink-0 text-brand">
      <rect width="48" height="48" rx="12" className="fill-surface" />
      <path d={stem} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0 -8 L8 3 L-8 3 Z" fill="currentColor" transform={`translate(${x} ${y}) rotate(${deg})`} />
    </svg>
  );
}

/** Space kept between the toast and what is above it. */
const GAP_PX = 8;

/**
 * Starts navigating a course. The map page does not send the course's path, so it is fetched here first; with none the
 * guidance falls back to the stops only. Returns false when the course has no stamp places to head for.
 */
async function beginNavigation(route: MapScreenRoute, start: ReturnType<typeof useNavigation>["start"]): Promise<boolean> {
  const stampStops = route.stops?.filter((s) => !s.noStamp) ?? [];
  if (stampStops.length === 0) return false;
  const fetched = route.line === null && route.hasLine ? await getRouteLine(route.id) : null;
  const stops: Record<string, NavStopInfo> = Object.fromEntries(stampStops.map((s) => [s.id, { name: s.name, nameLang: s.nameLang, status: s.status }]));
  start({ routeId: route.id, routeName: route.name, access: route.accessPoints, stops, model: modelFromMapRoute(route, fetched) });
  return true;
}

/**
 * After a reload (the phone dropped the page while another one was on top), a navigation that was running starts again
 * when the map opens. `onResume` lets the map open that course's sheet.
 */
export function NavigationResume({ routes, onResume }: { routes: readonly MapScreenRoute[]; onResume: (routeId: string) => void }) {
  const { session, start } = useNavigation();
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || session) return;
    tried.current = true;
    const rec = loadResume(window.localStorage, Date.now());
    const route = rec ? routes.find((r) => r.id === rec.routeId && r.status === "ready") : undefined;
    if (!route) return;
    void beginNavigation(route, start).then((began) => began && onResume(route.id));
  }, [routes, session, start, onResume]);
  return null;
}

export function NavigationStart({ route }: { route: MapScreenRoute }) {
  const { t } = useLingui();
  const { session, start } = useNavigation();
  const [starting, setStarting] = useState(false);
  if (!route.stops?.some((s) => !s.noStamp)) return null;
  if (session?.routeId === route.id) return null; // the toast already shows it
  return (
    <section className="flex flex-col gap-2">
      <p className="text-lg leading-snug">{t`いまいる場所から、いちばん近いスタンプの場所まで案内します。位置は、この端末の中だけで使います。`}</p>
      <button
        type="button"
        className={primary}
        disabled={starting}
        onClick={() => {
          setStarting(true);
          void beginNavigation(route, start).finally(() => setStarting(false));
        }}
      >
        {starting ? t`ナビを準備しています…` : session ? t`この区間のナビに切り替える` : t`ナビをはじめる`}
      </button>
    </section>
  );
}

export function NavigationToast() {
  const { t, i18n } = useLingui();
  const { session, stop, markStamped, setToastPx, setBannerPx } = useNavigation();
  const pathname = usePathname();
  const box = useRef<HTMLElement>(null);
  const banner = useRef<HTMLElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const voice = useNavVoice(session?.snapshot.state ?? null, session?.snapshot.state.targetId ? session.stops[session.snapshot.state.targetId]?.name : undefined);

  // Ticks so the age of an old fix stays true while nothing new arrives.
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [session]);

  // Tell the page how much room to keep free at the bottom.
  const shown = session !== null;
  useLayoutEffect(() => {
    const el = box.current;
    const root = document.documentElement;
    if (!shown || !el) return;
    const report = () => {
      const px = el.offsetHeight + GAP_PX;
      setToastPx(px);
      root.style.setProperty("--nav-toast", `${px}px`);
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => {
      observer.disconnect();
      setToastPx(0);
      root.style.removeProperty("--nav-toast");
    };
  }, [shown, setToastPx]);

  // The banner at the top of the map: tell the map how far down it reaches, so the sheet never rises under it.
  const bannerShown = shown && pathname === "/map";
  useLayoutEffect(() => {
    const el = banner.current;
    if (!bannerShown || !el) return;
    const report = () => setBannerPx(el.offsetTop + el.offsetHeight + GAP_PX);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => {
      observer.disconnect();
      setBannerPx(0);
    };
  }, [bannerShown, setBannerPx]);

  // On the map a running navigation is a mode of its own: the layer pills and the top bar step aside (globals.css).
  const navOnMap = shown && pathname === "/map";
  useEffect(() => {
    document.body.classList.toggle("map-nav-mode", navOnMap);
    return () => document.body.classList.remove("map-nav-mode");
  }, [navOnMap]);

  if (!session) return null;

  const { snapshot: snap, routeName } = session;
  const st = snap.state;
  const target = st.targetId ? session.stops[st.targetId] : undefined;
  const turnWords: Record<TurnKind, string> = {
    "slight-left": t`やや左`,
    left: t`左折`,
    "sharp-left": t`大きく左`,
    "slight-right": t`やや右`,
    right: t`右折`,
    "sharp-right": t`大きく右`,
    "u-turn": t`Uターン`,
  };
  // Which way, relative to where the visitor walks (no line to follow).
  const steerWords: Record<TurnKind | "straight", string> = {
    straight: t`まっすぐ`,
    "slight-left": t`やや左`,
    left: t`左`,
    "sharp-left": t`左うしろ`,
    "slight-right": t`やや右`,
    right: t`右`,
    "sharp-right": t`右うしろ`,
    "u-turn": t`うしろ`,
  };
  const compass: Record<CompassPoint, string> = {
    N: t`北`, NE: t`北東`, E: t`東`, SE: t`南東`, S: t`南`, SW: t`南西`, W: t`西`, NW: t`北西`,
  };
  const fmt = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { maximumFractionDigits: 1 });
  const meters = (m: number) => {
    const d = distanceParts(m);
    const v = fmt.format(d.value);
    return d.unit === "km" ? t`${v}km` : t`${v}m`;
  };
  const distText = st.distanceM !== null ? meters(st.distanceM) : "";
  const ageS = snap.lastFixAtMs !== null ? Math.round((now - snap.lastFixAtMs) / 1000) : null;

  const problem =
    snap.problem === "denied"
      ? t`位置情報が許可されていません。ブラウザの設定で、このサイトの位置情報を「許可」にしてください。`
      : snap.problem === "unsupported"
        ? t`この端末・ブラウザでは、位置情報を使えません。`
        : snap.problem === "unavailable" || snap.problem === "timeout"
          ? t`いまの位置が、わかりません。空の開けた場所で、しばらくお待ちください。`
          : null;

  // Off the course line: say so once (the block appears when the visitor leaves it), with the way back.
  const back = st.offRoute && st.backM !== null && st.backBearingDeg !== null ? { m: st.backM, deg: st.backBearingDeg } : null;
  const backText = back ? t`道まで ${meters(back.m)}（${compass[compassPoint(back.deg)]}）` : "";
  const offRouteBlock = back ? (
    <div role="alert" className="flex items-center gap-3 border-l-4 border-caution pl-3">
      {/* The arrow points the way back relative to the walking direction when it is known, else relative to north. */}
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-8 shrink-0 text-ink" style={{ transform: `rotate(${back.deg - (st.headingDeg ?? 0)}deg)` }}>
        <path d="M12 3 L19 20 L12 16 L5 20 Z" fill="currentColor" />
      </svg>
      <p className="text-lg font-bold leading-snug">
        {t`道からはずれています`}
        <span className="block text-base font-normal tabular-nums">{backText}</span>
      </p>
    </div>
  ) : null;

  // At most one short note under the two lines, the most useful one first.
  const note = snap.paused
    ? t`画面が見えない間は、位置を止めています。`
    : problem && snap.position !== null
      ? problem
      : ageS !== null && ageS * 1000 > STALE_MS
        ? t`位置は${ageS}秒前のものです。`
        : !snap.stampsKnown
          ? t`スタンプの記録を読めませんでした。`
          : null;

  // Far from the course, with no walking path chosen: how to get there, not a distance and direction that mean nothing.
  const far = snap.position !== null && st.far && st.mode !== "path" && st.targetId !== null;
  let main;
  if (far) {
    main = pathname === "/map" ? <NavFarCard /> : <p className="text-base font-bold leading-snug">{t`この区間は遠くにあります。電車やバスで向かいましょう。`}</p>;
  } else if (problem && snap.position === null) {
    main = <p className="text-base font-bold leading-snug">{problem}</p>;
  } else if (snap.position === null) {
    main = <p className="text-base">{st.ignoredFixes > 0 ? t`GPSの電波が弱いようです。空の開けた場所に動いてください。` : t`現在地を調べています…`}</p>;
  } else if (!st.targetId || !target) {
    main = <p className="text-base font-bold leading-snug">{t`この区間のスタンプは、すべて押しました。`}</p>;
  } else {
    const direction = st.bearingDeg !== null ? compass[compassPoint(st.bearingDeg)] : "";
    const turn = st.turn && st.turn.inM <= TURN_ANNOUNCE_M ? st.turn : null;
    const turnIn = turn ? meters(turn.inM) : "";
    const turnWord = turn ? turnWords[turn.kind] : "";
    // Within a few metres the turn is "now".
    const turnText = turn ? (turn.inM < 15 ? t`すぐ${turnWord}` : t`${turnIn}先 ${turnWord}`) : "";
    const steer = !turn && st.mode === "straight" ? st.steer : null;
    const steerWord = steer ? steerWords[steer] : "";
    const line1 = turn ? turnText : steer ? t`${steerWord} ${distText}` : direction ? t`${direction} ${distText}` : distText;
    const mode = st.mode === "line" ? t`道なり` : st.mode === "path" ? t`道の外・歩ける道` : t`道の外・直線`;
    main = (
      <div className="flex min-w-0 items-center gap-3">
        <TurnSign kind={turn?.kind ?? (steer && steer !== "straight" ? steer : null)} />
        <div className="min-w-0">
          <p className="truncate text-xl font-bold leading-tight tabular-nums">{line1}</p>
          <p className="truncate text-base leading-snug text-muted">
            <span className="sr-only">{t`次のスタンプの場所`} </span>
            <span lang={target.nameLang}>{target.name}</span>
            {` · ${turn ? distText : mode}`}
          </p>
        </div>
      </div>
    );
  }

  // Where the course stands: places done, time to the next one, and what is left (only numbers that can be true).
  const progress = courseProgress(session.model, st, snap.stamped);
  const mins = (m: number) => (m < 60 ? t`${m}分` : t`${Math.floor(m / 60)}時間${m % 60}分`);
  const progressLine = (
    <p className="rounded-2xl bg-paper px-4 py-2 text-lg font-bold leading-snug shadow-lg ring-1 ring-line/30">
      <span className="tabular-nums">{t`スタンプ ${progress.done} / ${progress.total}`}</span>
      {progress.toNextMin !== null ? <span className="tabular-nums">{` · ${t`次まで ${mins(progress.toNextMin)}`}`}</span> : null}
      {progress.leftM !== null && progress.leftMin !== null ? <span className="tabular-nums">{` · ${t`残り ${meters(progress.leftM)}（${mins(progress.leftMin)}）`}`}</span> : null}
    </p>
  );

  // The climb to the next stop, when the course line carries elevations and the visitor is on it.
  const targetAt = st.targetId ? session.model.stops.findIndex((s) => s.id === st.targetId) : -1;
  const targetAlongM = targetAt >= 0 ? (session.model.stopAlongM[targetAt] ?? null) : null;
  const profile = st.mode === "line" && st.alongM !== null && targetAlongM !== null ? legProfile(session.model.line, session.model.cum, st.alongM, targetAlongM) : null;

  const stampButton =
    st.inRadius && st.targetId && target ? (
      <StampHere
        spotId={st.targetId}
        status={target.status}
        alreadyStamped={false}
        loginHref={`/login?next=${encodeURIComponent(pathname)}`}
        inSheet
        progress={snap.stampsKnown ? { rallyName: routeName, place: target.name, before: Object.keys(session.stops).filter((id) => snap.stamped.has(id)).length, total: Object.keys(session.stops).length } : undefined}
        onStamped={() => markStamped(st.targetId!)}
      />
    ) : null;

  // On the map: the instruction on a banner at the top, and at the bottom the stamp button (when in range) and the exit.
  if (pathname === "/map") {
    const leave = () => {
      if (window.confirm(t`ナビを終えますか？`)) stop();
    };
    return (
      <>
        <section ref={banner} aria-label={t`ナビ中：${routeName}`} className="fixed inset-x-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-30 flex max-h-[70dvh] flex-col gap-1 overflow-y-auto rounded-2xl bg-paper px-4 py-3 shadow-2xl ring-1 ring-line/30 md:inset-x-auto md:left-[calc(50%-14rem)] md:w-[28rem]">
          {main}
          {offRouteBlock}
          {note ? <p className="text-base leading-snug">{note}</p> : null}
          {voice.supported ? (
            <div className="flex items-center gap-3">
              <button type="button" role="switch" aria-checked={voice.on} onClick={voice.toggle} className={quiet}>
                {voice.on ? t`音声案内：オン` : t`音声案内：オフ`}
              </button>
              {voice.on && !voice.canVibrate ? <span className="text-base text-muted">{t`この端末では、振動は使えません。`}</span> : null}
            </div>
          ) : null}
        </section>
        <section ref={box} aria-label={t`ナビの操作`} className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-[24rem]">
          {progressLine}
          {profile ? <NavElevation profile={profile} /> : null}
          {stampButton}
          <NavTargetPicker />
          <button type="button" onClick={leave} className="tap-target flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-ink bg-paper px-5 text-xl font-bold text-ink shadow-lg hover:bg-surface">
            {t`ナビを終える`}
          </button>
        </section>
      </>
    );
  }

  return (
    <section
      ref={box}
      aria-live="polite"
      aria-label={t`ナビ中：${routeName}`}
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex max-h-[50dvh] flex-col gap-2 overflow-y-auto rounded-2xl bg-paper px-3 py-2 shadow-2xl ring-1 ring-line/30 md:inset-x-auto md:bottom-6 md:right-6 md:w-[24rem]"
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{main}</div>
        {pathname === "/map" ? null : (
          <Link href="/map" className={quiet}>
            {t`地図`}
          </Link>
        )}
        <button type="button" className={quiet} onClick={stop} aria-label={t`ナビを終える`}>
          {t`終了`}
        </button>
      </div>
      {offRouteBlock}
      {note ? <p className="text-base leading-snug">{note}</p> : null}
      {stampButton}
    </section>
  );
}
