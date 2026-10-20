"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { StampHere } from "@/components/StampHere";
import { compassPoint, type CompassPoint } from "@/lib/navigation/geometry";
import { modelFromMapRoute } from "@/lib/navigation/input";
import type { MapScreenRoute } from "@/lib/map-screen";
import { distanceParts } from "@/lib/stamp-flow";
import { useNavigation, type NavStopInfo } from "./NavigationProvider";

// The navigation toast: a card floating at the bottom of the screen while a navigation runs, on every tab (on a phone just
// above the tab bar and the phone's own bar, on a wider screen at the bottom right). Which stop is next, which way, how
// far, and the stamp button once the visitor is there. The map is north-up, so the arrow points the way on the map
// (there is no phone compass).

const primary = "tap-target flex min-h-14 w-full items-center justify-center rounded-xl bg-ink px-5 text-xl font-bold text-paper";
const quiet = "tap-target flex min-h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-ink bg-paper px-4 text-lg font-bold text-ink hover:bg-surface";

/** A fix older than this is said to be old, with its age. */
const STALE_MS = 30_000;

export function NavigationStart({ route }: { route: MapScreenRoute }) {
  const { t } = useLingui();
  const { session, start } = useNavigation();
  if (!route.stops || route.stops.length === 0) return null;
  if (session?.routeId === route.id) return null; // the panel above already shows it
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
  const { session, stop, markStamped } = useNavigation();
  const pathname = usePathname();
  const [now, setNow] = useState(() => Date.now());
  // Ticks so the age of an old fix stays true while nothing new arrives.
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [session]);
  if (!session) return null;

  const { snapshot: snap, routeName } = session;
  const st = snap.state;
  const target = st.targetId ? session.stops[st.targetId] : undefined;
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

  let body;
  if (problem && snap.position === null) {
    body = <p className="text-lg font-bold leading-snug">{problem}</p>;
  } else if (snap.position === null) {
    body = <p className="text-lg">{t`現在地を調べています…`}</p>;
  } else if (!st.targetId || !target) {
    body = <p className="text-xl font-bold leading-snug">{t`この区間のスタンプは、すべて押しました（閉鎖中の場所をのぞきます）。`}</p>;
  } else {
    const direction = st.bearingDeg !== null ? compass[compassPoint(st.bearingDeg)] : "";
    const name = target.name;
    body = (
      <div className="flex items-center gap-3">
        {st.bearingDeg !== null ? (
          <svg viewBox="0 0 48 48" aria-hidden="true" className="size-14 shrink-0 text-brand" style={{ transform: `rotate(${st.bearingDeg}deg)` }}>
            <circle cx="24" cy="24" r="22" className="fill-paper" />
            <path d="M24 6 L36 38 L24 31 L12 38 Z" fill="currentColor" />
          </svg>
        ) : null}
        <div className="min-w-0">
          <p lang={target.nameLang} className="text-base font-bold leading-snug">
            <span className="sr-only">{t`次のスタンプの場所`} </span>
            {name}
          </p>
          <p className="text-xl font-bold leading-snug tabular-nums">{direction ? t`${direction}へ ${distText}` : distText}</p>
          <p className="text-base text-muted">
            {st.mode === "line" ? t`区間の道に沿って案内しています。` : st.mode === "path" ? t`道からはずれています。歩ける道を通る案内です。` : t`道からはずれています。まっすぐの方向です（足元の道を確かめてください）。`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-live="polite"
      aria-label={t`ナビ中：${routeName}`}
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex max-h-[60dvh] flex-col gap-2 overflow-y-auto rounded-2xl bg-paper p-3 shadow-2xl ring-1 ring-line/30 md:inset-x-auto md:bottom-6 md:right-6 md:w-[26rem]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-base text-muted">{t`ナビ中：${routeName}`}</p>
        <div className="flex shrink-0 gap-2">
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
      {body}
      {snap.paused ? <p className="text-base font-bold">{t`画面が見えない間は、位置を止めています。戻ると続きから案内します。`}</p> : null}
      {!snap.paused && ageS !== null && ageS * 1000 > STALE_MS ? <p className="text-base">{t`位置は${ageS}秒前のものです。`}</p> : null}
      {st.ignoredFixes > 0 && snap.position === null ? <p className="text-base">{t`GPSの電波が弱いようです。空の開けた場所に動いてください。`}</p> : null}
      {snap.stampsKnown ? null : <p className="text-base">{t`スタンプの記録を読めませんでした。押した場所へ案内することがあります。`}</p>}
      {problem && snap.position !== null ? <p className="text-base">{problem}</p> : null}
      {st.inRadius && st.targetId && target ? (
        <StampHere spotId={st.targetId} status={target.status} alreadyStamped={false} loginHref={`/login?next=${encodeURIComponent(pathname)}`} inSheet onStamped={() => markStamped(st.targetId!)} />
      ) : null}
    </section>
  );
}
