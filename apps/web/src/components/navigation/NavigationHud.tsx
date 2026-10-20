"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { StampHere } from "@/components/StampHere";
import { compassPoint, turnDelta, type CompassPoint, type TurnKind } from "@/lib/navigation/geometry";
import { modelFromMapRoute } from "@/lib/navigation/input";
import type { MapScreenRoute } from "@/lib/map-screen";
import { distanceParts } from "@/lib/stamp-flow";
import { useNavigation, type NavStopInfo } from "./NavigationProvider";

// The navigation toast: a small card floating at the bottom of the screen while a navigation runs, on every tab (on a
// phone just above the tab bar and the phone's own bar, on a wider screen at the bottom right). Two lines: which way and
// how far, then the stop and a short word on how it is guiding. The page makes room for it (its height is reported to
// the provider and as the CSS variable --nav-toast), so it covers nothing. The map is north-up, so the arrow points the
// way on the map (there is no phone compass).

const primary = "tap-target flex min-h-14 w-full items-center justify-center rounded-xl bg-ink px-5 text-xl font-bold text-paper";
const quiet = "tap-target flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-ink bg-paper px-3 text-base font-bold text-ink hover:bg-surface";

/** A fix older than this is said to be old, with its age. */
const STALE_MS = 30_000;
/** A turn is announced from this far away ("in 120 m, turn left"); further off, the toast gives the direction. */
const TURN_ANNOUNCE_M = 300;
/** How the turn arrow is drawn: straight up is "ahead", so a left turn leans 90 degrees to the left. */
const TURN_ARROW_DEG: Record<TurnKind, number> = { "slight-left": -45, left: -90, "sharp-left": -135, "slight-right": 45, right: 90, "sharp-right": 135, "u-turn": 180 };

/** Space kept between the toast and what is above it. */
const GAP_PX = 8;

export function NavigationStart({ route }: { route: MapScreenRoute }) {
  const { t } = useLingui();
  const { session, start } = useNavigation();
  if (!route.stops || route.stops.length === 0) return null;
  if (session?.routeId === route.id) return null; // the toast already shows it
  const stops: Record<string, NavStopInfo> = Object.fromEntries(route.stops.map((s) => [s.id, { name: s.name, nameLang: s.nameLang, status: s.status }]));
  return (
    <section className="flex flex-col gap-2">
      <p className="text-lg leading-snug">{t`いまいる場所から、いちばん近いスタンプの場所まで案内します。位置は、この端末の中だけで使います。`}</p>
      <button type="button" className={primary} onClick={() => start({ routeId: route.id, routeName: route.name, stops, model: modelFromMapRoute(route) })}>
        {session ? t`この区間のナビに切り替える` : t`この区間をナビする`}
      </button>
    </section>
  );
}

export function NavigationToast() {
  const { t, i18n } = useLingui();
  const { session, stop, markStamped, setToastPx } = useNavigation();
  const pathname = usePathname();
  const box = useRef<HTMLElement>(null);
  const [now, setNow] = useState(() => Date.now());

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

  if (!session) return null;

  const { snapshot: snap, routeName } = session;
  const st = snap.state;
  const target = st.targetId ? session.stops[st.targetId] : undefined;
  const turnWords: Record<TurnKind, string> = {
    "slight-left": t`少し左へ`,
    left: t`左に曲がる`,
    "sharp-left": t`大きく左に曲がる`,
    "slight-right": t`少し右へ`,
    right: t`右に曲がる`,
    "sharp-right": t`大きく右に曲がる`,
    "u-turn": t`引き返す`,
  };
  // Which way, relative to where the visitor walks (no line to follow).
  const steerWords: Record<TurnKind | "straight", string> = {
    straight: t`まっすぐ`,
    "slight-left": t`少し左の方へ`,
    left: t`左の方へ`,
    "sharp-left": t`左うしろの方へ`,
    "slight-right": t`少し右の方へ`,
    right: t`右の方へ`,
    "sharp-right": t`右うしろの方へ`,
    "u-turn": t`うしろの方へ`,
  };
  const compass: Record<CompassPoint, string> = {
    N: t`北`, NE: t`北東`, E: t`東`, SE: t`南東`, S: t`南`, SW: t`南西`, W: t`西`, NW: t`北西`,
  };
  const fmt = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { maximumFractionDigits: 1 });
  const dist = st.distanceM !== null ? distanceParts(st.distanceM) : null;
  const n = dist ? fmt.format(dist.value) : "";
  const distText = dist ? (dist.unit === "km" ? t`約${n}km` : t`約${n}m`) : "";
  const ageS = snap.lastFixAtMs !== null ? Math.round((now - snap.lastFixAtMs) / 1000) : null;

  const problem =
    snap.problem === "denied"
      ? t`位置情報が許可されていません。ブラウザの設定で、このサイトの位置情報を「許可」にしてください。`
      : snap.problem === "unsupported"
        ? t`この端末・ブラウザでは、位置情報を使えません。`
        : snap.problem === "unavailable" || snap.problem === "timeout"
          ? t`いまの位置が、わかりません。空の開けた場所で、しばらくお待ちください。`
          : null;

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

  let main;
  if (problem && snap.position === null) {
    main = <p className="text-base font-bold leading-snug">{problem}</p>;
  } else if (snap.position === null) {
    main = <p className="text-base">{st.ignoredFixes > 0 ? t`GPSの電波が弱いようです。空の開けた場所に動いてください。` : t`現在地を調べています…`}</p>;
  } else if (!st.targetId || !target) {
    main = <p className="text-base font-bold leading-snug">{t`この区間のスタンプは、すべて押しました。`}</p>;
  } else {
    const direction = st.bearingDeg !== null ? compass[compassPoint(st.bearingDeg)] : "";
    const turn = st.turn && st.turn.inM <= TURN_ANNOUNCE_M ? st.turn : null;
    const turnDist = turn ? distanceParts(turn.inM) : null;
    const tn = turnDist ? fmt.format(turnDist.value) : "";
    const turnIn = turnDist ? (turnDist.unit === "km" ? t`約${tn}km` : t`約${tn}m`) : "";
    const turnWord = turn ? turnWords[turn.kind] : "";
    // Within a few metres the turn is "now".
    const turnText = turn ? (turn.inM < 15 ? t`ここで${turnWord}` : t`${turnIn}先で${turnWord}`) : "";
    const steer = !turn && st.mode === "straight" ? st.steer : null;
    const steerWord = steer ? steerWords[steer] : "";
    // The arrow: a turn leans the way to turn; once the walking direction is known it is relative to it (ahead is up,
    // which also matches the map when it is turned to the walking direction); before that, the way on the north-up map.
    const arrowDeg = turn
      ? TURN_ARROW_DEG[turn.kind]
      : st.bearingDeg !== null && st.headingDeg !== null
        ? turnDelta(st.headingDeg, st.bearingDeg)
        : (st.bearingDeg ?? 0);
    const line1 = turn ? turnText : steer ? t`${steerWord} ${distText}` : direction ? t`${direction}へ ${distText}` : distText;
    const mode = st.mode === "line" ? t`道なり` : st.mode === "path" ? t`道の外・歩ける道で案内` : t`道の外・まっすぐの方向`;
    main = (
      <div className="flex min-w-0 items-center gap-3">
        {turn || st.bearingDeg !== null ? (
          // A turn: the arrow leans the way to turn (ahead is up). Otherwise: the way on the north-up map.
          <svg viewBox="0 0 48 48" aria-hidden="true" className="size-11 shrink-0 text-brand" style={{ transform: `rotate(${arrowDeg}deg)` }}>
            <circle cx="24" cy="24" r="23" className="fill-surface" />
            <path d="M24 6 L36 38 L24 31 L12 38 Z" fill="currentColor" />
          </svg>
        ) : null}
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
      {note ? <p className="text-base leading-snug">{note}</p> : null}
      {st.inRadius && st.targetId && target ? (
        <StampHere spotId={st.targetId} status={target.status} alreadyStamped={false} loginHref={`/login?next=${encodeURIComponent(pathname)}`} inSheet onStamped={() => markStamped(st.targetId!)} />
      ) : null}
    </section>
  );
}
