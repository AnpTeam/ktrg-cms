"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChevronIcon } from "@/components/icons";
import { CreditBadge } from "@/components/PhotoCredit";

export interface HeroSlide {
  src: string;
  alt: string;
  credit?: string | null;
  /** Banner photos are https links on hosts next/image is not set up for: shown as they are. Our own files are optimised. */
  unoptimized: boolean;
}

/**
 * The photos behind the home page's title: the admin's banners side by side, snapping. Swipe or use the two large buttons
 * (nothing is gesture-only). It never moves by itself: moving content is hard for older readers and for screen readers.
 * `children` is the overlay (a fade, the logo, the title): it sits above the photos but lets touches through, so a swipe
 * on the title still moves the photos.
 */
export function HeroSlides({ slides, children }: { slides: HeroSlide[]; children?: ReactNode }) {
  const { t } = useLingui();
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const count = slides.length;

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: to * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }

  function onScroll() {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }

  const button = "absolute top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink shadow disabled:opacity-40";

  return (
    <div aria-roledescription="carousel" aria-label={t`写真`} className="absolute inset-0">
      <ul ref={track} onScroll={onScroll} className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          <button type="button" aria-label={t`前の写真`} disabled={index === 0} onClick={() => go(index - 1)} className={`${button} left-2`}>
            <span className="rotate-180">
              <ChevronIcon />
            </span>
          </button>
          <button type="button" aria-label={t`次の写真`} disabled={index === count - 1} onClick={() => go(index + 1)} className={`${button} right-2`}>
            <ChevronIcon />
          </button>
          <div aria-hidden="true" className="pointer-events-none absolute right-4 top-4 z-10 flex gap-2">
            {slides.map((s, i) => (
              <span key={s.src} className={`size-2.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
