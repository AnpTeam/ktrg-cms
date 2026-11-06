"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { isEarned, medalCapacity, medalLayout } from "@/lib/medals";

const SIZE = 28;
const GAP = 6;

/** A medal with no ribbon: a coin with an inner ring and a star. Filled when it is earned, an outline when it is not. */
export function Coin({ earned, size = SIZE }: { earned: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden="true" className="shrink-0">
      {earned ? (
        <>
          <circle cx="14" cy="14" r="13" className="fill-shu" />
          <circle cx="14" cy="14" r="10" fill="none" className="stroke-on-shu" strokeWidth="1.5" opacity="0.75" />
          <polygon points="14,8.2 15.7,12.1 19.9,12.5 16.7,15.2 17.7,19.3 14,17.1 10.3,19.3 11.3,15.2 8.1,12.5 12.3,12.1" className="fill-on-shu" />
        </>
      ) : (
        <>
          <circle cx="14" cy="14" r="12" fill="none" className="stroke-line" strokeWidth="2" />
          <circle cx="14" cy="14" r="8.5" fill="none" className="stroke-line" strokeWidth="1.2" strokeDasharray="2.5 3" opacity="0.8" />
        </>
      )}
    </svg>
  );
}

/**
 * One medal for each stamp place of a route, earned ones filled. All of them are drawn when the line is wide enough;
 * when it is not, as many as fit are drawn and the last space says "+n". `earned` is null when nobody is signed in:
 * then every medal is an outline (no progress is shown). The words for a screen reader come from `label`.
 */
export function MedalRow({ total, earned, label }: { total: number; earned: number | null; label: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [capacity, setCapacity] = useState(8); // until it is measured (the first paint on the server)

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setCapacity(medalCapacity(el.clientWidth, SIZE, GAP));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { shown, more } = medalLayout(total, capacity);
  return (
    <span ref={box} role="img" aria-label={label} className="flex h-7 items-center overflow-hidden" style={{ gap: GAP }}>
      {Array.from({ length: shown }, (_, i) => (
        <Coin key={i} earned={isEarned(i, earned)} />
      ))}
      {more > 0 ? <span className="shrink-0 pl-1 text-lg font-bold tabular-nums leading-none">+{more}</span> : null}
    </span>
  );
}
