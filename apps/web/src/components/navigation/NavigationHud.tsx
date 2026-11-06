"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getRouteLine } from "@/lib/navigation/line-client";
import { loadResume } from "@/lib/navigation/resume";
import { useLingui } from "@lingui/react/macro";
import { Medal } from "@/components/Medal";
import { StampHere } from "@/components/StampHere";
import { compassPoint, type CompassPoint, type TurnKind } from "@/lib/navigation/geometry";
import { modelFromMapRoute } from "@/lib/navigation/input";
import type { MapScreenRoute } from "@/lib/map-screen";
import { courseProgress } from "@/lib/navigation/progress";
import { distanceParts } from "@/lib/stamp-flow";
import { say, useNavVoice, voiceIsOn } from "./useNavVoice";
import { ArrivalPrompt, PassedPrompt } from "./NavPrompts";
import { NavElevation } from "./NavElevation";
import { legProfile } from "@/lib/navigation/elevation";
import { NavFarCard } from "./NavFarCard";
import { NavTargetPicker } from "./NavTargetPicker";
import { useNavigation, type NavStopInfo } from "./NavigationProvider";
import { buttonStyle } from "@/components/button";

// The navigation toast: a small card floating at the bottom of the screen while a navigation runs, on every tab (on a
// phone just above the tab bar and the phone's own bar, on a wider screen at the bottom right). Two lines: which way and
// how far, then the stop and a short word on how it is guiding. The page makes room for it (its height is reported to
// the provider and as the CSS variable --nav-toast), so it covers nothing. The sign on the left is the next turn
// (straight when none is near); the way to the stop is an arrow on the visitor's dot on the map.

const primary = buttonStyle("action", "lg", "flex w-full");
const quiet = buttonStyle("secondary", "sm", "flex shrink-0 whitespace-nowrap");

/** A fix older than this is said to be old, with its age. */
const STALE_MS = 30_000;
/** A turn is announced from this far away ("in 120 m, turn left"); further off, the toast gives the direction. */
const TURN_ANNOUNCE_M = 300;
/** The right-hand turns as drawn (the left ones are their mirror): the way to go, where its head sits, and the road left behind. */
const TURN_SHAPES = {
  slight: { way: "M20 44 V33 Q20 24 30 15", x: 32, y: 13, deg: 45, road: 20 },
  turn: { way: "M16 44 V32 Q16 23 26 23 H30", x: 32, y: 23, deg: 90, road: 16 },
  sharp: { way: "M15 44 V19 Q15 8 25 13 L31 20", x: 32, y: 22, deg: 135, road: 15 },
};

/**
 * The turn sign, drawn like a car navigation's junction: white on the brand red, the way to go as one thick curve into a big
 * head, with the road straight on left faint behind it. Straight up when no turn is near.
 */
function TurnSign({ kind }: { kind: TurnKind | null }) {
  const shape = !kind || kind === "u-turn" ? null : TURN_SHAPES[kind.startsWith("slight") ? "slight" : kind.startsWith("sharp") ? "sharp" : "turn"];
  const { way, x, y, deg } = shape ?? (kind === "u-turn" ? { way: "M34 44 V21 a10 10 0 0 0 -20 0 V27", x: 14, y: 30, deg: 180 } : { way: "M25 44 V17", x: 25, y: 15, deg: 0 });
  return (
    <svg viewBox="0 0 50 50" aria-hidden="true" className="size-14 shrink-0 rounded-xl bg-brand text-white">
      <g transform={kind?.endsWith("left") ? "matrix(-1 0 0 1 50 0)" : undefined}>
        {shape ? <path d={`M${shape.road} 28 V7`} fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="7" strokeLinecap="round" /> : null}
        <path d={way} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M0 -11 L12 4 L-12 4 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" transform={`translate(${x} ${y}) rotate(${deg})`} />
      </g>
    </svg>
  );
}

/** Space kept between the toast and what is above it. */
const GAP_PX = 8;

/** Asks the map to put its sheet away and hand the bottom of the screen back to the navigation (MapScreen listens). */
export const NAV_RESUME_EVENT = "ktrg:nav-resume";
/** How long the controls take to slide away before the sheet rises (MapScreen waits this long). */
export const NAV_HANDOFF_MS = 200;

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

/** `more` is the sheet's other button: it sits right under this one, above the note, and stands alone when there is nothing to start. */
export function NavigationStart({ route, more }: { route: MapScreenRoute; more: ReactNode }) {
  const { t, i18n } = useLingui();
  const { session, start, voiceByDefault } = useNavigation();
  const [starting, setStarting] = useState(false);
  if (!route.stops?.some((s) => !s.noStamp)) return more;
  if (session?.routeId === route.id) return more; // the toast already shows it
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        className={primary}
        disabled={starting}
        onClick={() => {
          setStarting(true);
          // Said inside the tap: an iPhone lets a page speak only after a touch, and the voice may be on without one.
          if (voiceIsOn(voiceByDefault)) say(t`ナビをはじめます`, i18n.locale);
          void beginNavigation(route, start).finally(() => setStarting(false));
        }}
      >
        {starting ? t`ナビを準備しています…` : session ? t`この区間のナビに切り替える` : t`ナビをはじめる`}
      </button>
      {more}
      <p className="text-base leading-snug">{t`いまいる場所から、いちばん近いスタンプの場所まで案内します。位置は、この端末の中だけで使います。`}</p>
    </section>
  );
}

export function NavigationToast() {
  const { t, i18n } = useLingui();
  const { session, stop, markStamped, skipPassed, returnToPassed, voiceByDefault, setToastPx, setBannerPx, sheetUp } = useNavigation();
  const pathname = usePathname();
  const box = useRef<HTMLElement>(null);
  const banner = useRef<HTMLElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const voice = useNavVoice(session?.snapshot.state ?? null, session?.snapshot.state.targetId ? session.stops[session.snapshot.state.targetId]?.name : undefined, voiceByDefault);
  // The stamp place whose arrival card was put off: its small button stays at the bottom of the screen.
  const [laterId, setLaterId] = useState<string | null>(null);

  // Ticks so the age of an old fix stays true while nothing new arrives.
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [session]);

  // Tell the page how much room to keep free at the bottom.
  const shown = session !== null;
  // Slid away while the map's sheet holds the bottom of the screen: then it takes no room.
  const tucked = sheetUp && pathname === "/map";
  useLayoutEffect(() => {
    const el = box.current;
    const root = document.documentElement;
    if (!shown || !el) return;
    const report = () => {
      const px = tucked ? 0 : el.offsetHeight + GAP_PX;
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
  }, [shown, tucked, setToastPx]);

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
  const isFar = snap.position !== null && st.far && st.mode !== "path" && st.targetId !== null;
  const back = !isFar && st.offRoute && st.backM !== null && st.backBearingDeg !== null ? { m: st.backM, deg: st.backBearingDeg } : null;
  // With a walking direction the arrow beside it says which way; a compass word only when there is none.
  const backText = back ? (st.headingDeg !== null ? t`道まで ${meters(back.m)}` : t`道まで ${meters(back.m)}（${compass[compassPoint(back.deg)]}）`) : "";
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
  const far = isFar;
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
    // Words a walker can use: left, right, along the path. A compass word only when nothing better is known.
    const onWay = st.mode === "line" || st.mode === "path";
    const line1 = turn ? turnText : steer ? t`${steerWord} ${distText}` : onWay ? t`道なりに ${distText}` : direction ? t`${direction} ${distText}` : distText;
    const mode = st.mode === "line" ? null : st.mode === "path" ? t`道の外・歩ける道` : t`道の外・直線`;
    const line2 = turn ? distText : mode;
    main = (
      <div className="flex min-w-0 items-center gap-3">
        <TurnSign kind={turn?.kind ?? (steer && steer !== "straight" ? steer : null)} />
        <div className="min-w-0">
          <p className="truncate text-xl font-bold leading-tight tabular-nums">{line1}</p>
          <p className="truncate text-base leading-snug text-muted">
            <span className="sr-only">{t`次のスタンプの場所`} </span>
            <span lang={target.nameLang}>{target.name}</span>
            {line2 ? ` · ${line2}` : null}
          </p>
        </div>
      </div>
    );
  }

  // Where the course stands: places done, time to the next one, and what is left (only numbers that can be true).
  const progress = courseProgress(session.model, st, snap.stamped);
  const mins = (m: number) => (m < 60 ? t`${m}分` : t`${Math.floor(m / 60)}時間${m % 60}分`);
  // The clock time of the arrival, in Japan's time like every date here. `now` ticks, so it stays true while standing still.
  const arrival = progress.toNextMin === null ? null : new Intl.DateTimeFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(now + progress.toNextMin * 60_000);
  const left = progress.leftM !== null && progress.leftMin !== null ? t`残り ${meters(progress.leftM)}（${mins(progress.leftMin)}）` : null;
  // The walk at a glance: the time in the heading type, and the stamps as the course's medal, the app's own way of showing them.
  const progressLine = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        {progress.toNextMin !== null ? <p className="font-serif text-2xl font-bold leading-tight text-accent tabular-nums">{t`次まで ${mins(progress.toNextMin)}`}</p> : null}
        <p className="text-base leading-snug tabular-nums">{[arrival ? t`${arrival}ごろ着` : null, left].filter(Boolean).join(" · ")}</p>
      </div>
      <p className="flex shrink-0 items-center gap-1.5 text-lg font-bold tabular-nums">
        <span className="sr-only">{t`スタンプ ${progress.done} / ${progress.total}`}</span>
        <Medal number={progress.done} done={progress.total > 0 && progress.done >= progress.total} stamped={progress.done} total={progress.total} className="h-14 w-auto" />
        <span aria-hidden="true">/ {progress.total}</span>
      </p>
    </div>
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

  const passed = snap.passedId ? session.stops[snap.passedId] : undefined;
  const arrived = stampButton !== null && laterId !== st.targetId && !passed;
  const prompts = passed ? (
    <PassedPrompt key={snap.passedId} name={passed.name} nameLang={passed.nameLang} onGoOn={skipPassed} onGoBack={returnToPassed} />
  ) : arrived && target ? (
    <ArrivalPrompt key={st.targetId} name={target.name} nameLang={target.nameLang} onLater={() => setLaterId(st.targetId)}>
      {stampButton}
    </ArrivalPrompt>
  ) : null;

  // On the map: the instruction on a banner at the top, and at the bottom the stamp button (when in range) and the exit.
  if (pathname === "/map") {
    const leave = () => {
      if (window.confirm(t`ナビを終えますか？`)) stop();
    };
    return (
      <>
        {prompts}
        {/* Phone: the top of the screen itself, from the status bar down (a solid box there keeps iOS from blurring it). */}
        <section ref={banner} aria-label={t`ナビ中：${routeName}`} className="fixed inset-x-0 top-0 z-30 flex max-h-[70dvh] flex-col gap-1 overflow-y-auto rounded-b-2xl border-b border-line/30 bg-paper px-4 pb-3 pt-[calc(0.75rem+var(--top-clear))] shadow-lg md:inset-x-auto md:left-[calc(50%-14rem)] md:top-[calc(0.5rem+var(--top-clear))] md:w-[28rem] md:rounded-2xl md:border-b-0 md:pt-3 md:shadow-2xl md:ring-1 md:ring-line/30">
          {main}
          {tucked ? (
            <button type="button" onClick={() => window.dispatchEvent(new Event(NAV_RESUME_EVENT))} className={buttonStyle("primary", "md", "mt-1 flex w-full")}>
              {t`ナビにもどる`}
            </button>
          ) : null}
          {offRouteBlock}
          {note ? <p className="text-base leading-snug">{note}</p> : null}
          {voice.supported && !far && !tucked ? (
            <div className="flex items-center gap-3">
              <button type="button" role="switch" aria-checked={voice.on} onClick={voice.toggle} className={quiet}>
                {voice.on ? t`音声案内：オン` : t`音声案内：オフ`}
              </button>
              {voice.on && !voice.canVibrate ? <span className="text-base text-muted">{t`この端末では、振動は使えません。`}</span> : null}
            </div>
          ) : null}
        </section>
        <section
          ref={box}
          aria-label={t`ナビの操作`}
          inert={tucked}
          aria-hidden={tucked || undefined}
          // Away first, then the sheet rises (MapScreen waits NAV_HANDOFF_MS); back only after the sheet has gone down (the delay).
          // Above the tab bar when it shows (--tabbar-room, globals.css): the map's overview keeps the tabs.
          className={`fixed inset-x-0 bottom-[var(--tabbar-room)] z-30 transition duration-200 ease-out motion-reduce:transition-none md:inset-x-auto md:bottom-6 md:right-6 md:w-[24rem] ${tucked ? "pointer-events-none translate-y-[calc(100%+2rem)] opacity-0" : "translate-y-0 opacity-100 delay-200"}`}
        >
          {/* Its own box: the pattern's class sets `position` and would undo the `fixed` above. */}
          <div className="pattern-shippo flex flex-col gap-3 rounded-t-2xl border-t border-line/30 bg-paper px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_24px_rgb(0_0_0/0.28)] md:rounded-2xl md:pb-3">
          {far ? null : progressLine}
          {far || !profile ? null : <NavElevation profile={profile} />}
          {far || arrived ? null : stampButton}
          <div className={far ? "" : "grid grid-cols-2 gap-2"}>
            {far ? null : <NavTargetPicker />}
            <button type="button" onClick={leave} className={buttonStyle("secondary", "md", "flex w-full")}>
              {t`ナビを終える`}
            </button>
          </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <section
      ref={box}
      aria-live="polite"
      aria-label={t`ナビ中：${routeName}`}
      className="fixed inset-x-3 bottom-[calc(max(0.75rem,var(--tabbar-room))+env(safe-area-inset-bottom))] z-30 flex max-h-[50dvh] transition-[bottom] duration-200 motion-reduce:transition-none flex-col gap-2 overflow-y-auto rounded-2xl bg-paper px-3 py-2 shadow-2xl ring-1 ring-line/30 md:inset-x-auto md:bottom-6 md:right-6 md:w-[24rem]"
    >
      {/* The direction and distance come first; with large text the two buttons drop to their own row instead of cutting it short. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem] flex-1">{main}</div>
        <div className="ml-auto flex gap-2">
          {pathname === "/map" ? null : (
            <Link href="/map" className={quiet}>
              {t`地図`}
            </Link>
          )}
          <button type="button" className={quiet} onClick={stop} aria-label={t`ナビを終える`}>
            {t`終了`}
          </button>
        </div>
      </div>
      {offRouteBlock}
      {note ? <p className="text-base leading-snug">{note}</p> : null}
      {arrived ? null : stampButton}
      {prompts}
    </section>
  );
}
