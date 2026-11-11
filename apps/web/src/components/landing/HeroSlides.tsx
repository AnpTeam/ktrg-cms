"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { CreditBadge } from "@/components/PhotoCredit";

export interface HeroSlide {
  src: string;
  alt: string;
  credit?: string | null;
  /** Banner photos are https links on hosts next/image is not set up for: shown as they are. Our own files are optimised. */
  unoptimized: boolean;
}

/** How long one photo stays before the next (the dot at the top right fills over this time: `.hero-dot-fill`). */
const SLIDE_SECONDS = 6;

const arrow = "absolute top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center text-white [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.7))]";

// A thin chevron (the shared icon is heavy); it is decoration, the button carries the label.
const Thin = () => (
  <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 4 8 8-8 8" />
  </svg>
);

/**
 * The photos behind the home page's title: the admin's banners side by side, snapping. They advance by themselves; the
 * dot of the current photo fills to show when the next comes, so a visitor sees at once that it moves and can be swiped
 * (the two thin buttons are there too: nothing is gesture-only). The advance stops while a finger, the pointer or the
 * keyboard is on it, and never runs with reduced motion or calm on (no animation, so `animationend` never comes).
 * `children` is the overlay (a fade, the title, the logo): it sits above the photos but lets touches through.
 */
export function HeroSlides({ slides, children }: { slides: HeroSlide[]; children?: ReactNode }) {
  const { t } = useLingui();
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  // The visitor's own pause (WCAG 2.2.2: anything that moves by itself for over 5 s can be stopped).
  const [paused, setPaused] = useState(false);
  // The landing journey (JourneyScene) says once that the visitor scrolled away from the first screen: stop advancing.
  // Its own flag, not `held`: the pointer leaving would clear that one.
  const [away, setAway] = useState(false);
  useEffect(() => {
    const onAway = () => setAway(true);
    window.addEventListener("journey-scrolled", onAway, { once: true });
    return () => window.removeEventListener("journey-scrolled", onAway);
  }, []);
  const count = slides.length;

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: ((to + count) % count) * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }

  function onScroll() {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }

  return (
    <div
      aria-roledescription="carousel"
      aria-label={t`写真`}
      className="absolute inset-0"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onPointerDown={() => setHeld(true)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <ul ref={track} onScroll={onScroll} aria-live={held ? "polite" : "off"} className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((slide, i) => (
          <li key={slide.src} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${count}`} className="relative size-full shrink-0 snap-center">
            <Image src={slide.src} alt={slide.alt} fill sizes="(min-width: 1280px) 1200px, 100vw" priority={i === 0} unoptimized={slide.unoptimized} className="object-cover" />
            <CreditBadge credit={slide.credit} />
          </li>
        ))}
      </ul>
      <div className="pointer-events-none absolute inset-0">{children}</div>
      {count > 1 ? (
        <>
          <button type="button" aria-label={t`前の写真`} onClick={() => go(index - 1)} className={`${arrow} left-1`}>
            <span className="rotate-180">
              <Thin />
            </span>
          </button>
          <button type="button" aria-label={t`次の写真`} onClick={() => go(index + 1)} className={`${arrow} right-1`}>
            <Thin />
          </button>
          <button type="button" aria-pressed={paused} aria-label={paused ? t`自動で切り替える` : t`自動の切り替えを止める`} onClick={() => setPaused(!paused)} className={`${arrow} bottom-1 right-1 top-auto translate-y-0`}>
            <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
              {paused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
            </svg>
          </button>
          <div aria-hidden="true" className="pointer-events-none absolute right-4 top-[calc(1rem+var(--top-clear,0px))] z-10 flex items-center gap-2">
            {slides.map((s, i) => (
              <span key={s.src} className={`relative h-2.5 overflow-hidden rounded-full bg-white/50 ${i === index ? "w-8" : "w-2.5"}`}>
                {i === index ? (
                  // Re-keyed per photo so the fill starts again from empty; when it is full the next photo comes.
                  <span
                    key={index}
                    onAnimationEnd={() => go(index + 1)}
                    style={{ animationDuration: `${SLIDE_SECONDS}s`, animationPlayState: held || paused || away ? "paused" : "running" }}
                    className="hero-dot-fill absolute inset-0 origin-left rounded-full bg-white"
                  />
                ) : null}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
