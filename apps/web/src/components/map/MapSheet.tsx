"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { nextSnap, sheetHeightPx, snapAfterDrag, sheetSnaps, type SheetSnap } from "@/lib/map-screen";

/**
 * The bottom sheet of the home map (WBS 3.2.10). It rests at three heights, so the map stays in view while the
 * visitor reads: a low one (peek), about half the screen, and nearly all of it. Pull the handle, flick it, tap
 * it, or use the arrow keys. The page behind does not scroll; the sheet's own content does.
 *
 * `header` stays at the top of the sheet; `children` scroll under it. `available` is the room the sheet may use
 * (the map's height minus the tab bar), measured by the parent.
 */
export function MapSheet({
  panel = false,
  snap,
  onSnap,
  available,
  tabPx,
  header,
  contentKey,
  children,
}: {
  /** A desktop: not a bottom sheet to pull, but a panel floating at the left of the map. */
  panel?: boolean;
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  available: number;
  /** The room the floating tab bar takes at the bottom: the sheet reaches the screen's edge under it. */
  tabPx: number;
  /** Null when the content brings its own top (a course's banner), which then scrolls with the rest. */
  header: ReactNode | null;
  /** Changes when the sheet shows something else (another course or place): it starts from its top again. */
  contentKey: string;
  children: ReactNode;
}) {
  const { t } = useLingui();
  const [dragPx, setDragPx] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startHeight: number; lastY: number; lastT: number; velocity: number } | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const restingPx = sheetHeightPx(snap, available);

  // A new resting place, or other content, starts from the top again.
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [snap, contentKey]);

  function down(e: PointerEvent<HTMLElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startHeight: restingPx, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
    setDragPx(restingPx);
  }
  function move(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    // Pixels per second, positive when the finger moves up (the sheet grows).
    d.velocity = (-(e.clientY - d.lastY) / dt) * 1000;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const max = sheetHeightPx("full", available);
    // Down to nothing: let go near the bottom and the sheet hides (snapAfterDrag).
    setDragPx(Math.min(max, Math.max(0, d.startHeight + (d.startY - e.clientY))));
  }
  function up(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const moved = Math.abs(d.startY - e.clientY);
    const final = dragPx ?? restingPx;
    setDragPx(null);
    // Hardly moved: it was a tap on the handle.
    if (moved < 6) onSnap(nextSnap(snap));
    else onSnap(snapAfterDrag(final, d.velocity, available, snap));
  }
  function key(e: KeyboardEvent<HTMLElement>) {
    const index = sheetSnaps.indexOf(snap);
    if (e.key === "ArrowUp") onSnap(sheetSnaps[Math.min(sheetSnaps.length - 1, index + 1)] as SheetSnap);
    else if (e.key === "ArrowDown") onSnap(sheetSnaps[Math.max(0, index - 1)] as SheetSnap);
    else return;
    e.preventDefault();
  }

  // `height` is the part above the tab bar; the sheet itself is that much taller, so it runs under the bar.
  const height = dragPx ?? restingPx;
  // Hidden (and not being pulled): nothing is drawn; the map screen shows a button to bring it back.
  if (!panel && snap === "hidden" && dragPx === null) return null;

  return (
    <section
      aria-label={t`情報`}
      className={
        panel
          ? "absolute bottom-3 left-3 top-3 z-[5] flex w-[26rem] flex-col rounded-3xl bg-paper shadow-[0_4px_24px_rgb(0_0_0/0.28)]"
          : "absolute inset-x-0 bottom-0 z-[5] flex flex-col rounded-t-3xl bg-paper shadow-[0_-4px_24px_rgb(0_0_0/0.28)] motion-reduce:transition-none"
      }
      style={panel ? undefined : { height: height + tabPx, transition: dragPx === null ? "height 240ms ease-out" : "none" }}
    >
      {panel ? <div className="h-4 shrink-0" aria-hidden="true" /> : null}
      <div
        role="slider"
        tabIndex={0}
        aria-label={t`シートの高さ（上下の矢印キーで変えられます）`}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={sheetSnaps.length - 1}
        aria-valuenow={sheetSnaps.indexOf(snap)}
        aria-valuetext={snap === "hidden" ? t`隠す` : snap === "peek" ? t`低い` : snap === "half" ? t`半分` : t`高い`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        className={`h-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-t-3xl active:cursor-grabbing ${panel ? "hidden" : "flex"}`}
      >
        <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-line/60" />
      </div>
      {header ? <div className="shrink-0 px-4 pb-2">{header}</div> : null}
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: tabPx + 24 }}>
        {children}
      </div>
    </section>
  );
}
