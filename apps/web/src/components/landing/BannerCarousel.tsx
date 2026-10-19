"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChevronIcon } from "@/components/icons";
import type { BannerSlide } from "@/lib/banners";

/**
 * The banner at the top of the home page. Slides sit side by side and snap: swipe, or use the two large
 * buttons (nothing is gesture-only). It never moves by itself: moving content is hard for older readers and
 * for anyone using a screen reader. A slide with no picture is a plain placeholder.
 */
export function BannerCarousel({ slides }: { slides: BannerSlide[] }) {
  const { t, i18n } = useLingui();
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

  const button =
    "absolute top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink shadow disabled:opacity-40";

  return (
    <section aria-roledescription="carousel" aria-label={t`写真`} className="px-4">
      <div className="relative">
        <ul
          ref={track}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, i) => (
            <li
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              className="relative aspect-[16/10] w-full shrink-0 snap-center"
            >
              {slide.src ? (
                <Image
                  src={slide.src}
                  alt={i18n.locale === "ja" ? slide.altJa : slide.altEn}
                  fill
                  sizes="(min-width: 36rem) 36rem, 100vw"
                  priority={i === 0}
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-surface text-lg text-muted">
                  {i18n.locale === "ja" ? slide.altJa : slide.altEn}
                </div>
              )}
            </li>
          ))}
        </ul>
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
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div aria-hidden="true" className="mt-3 flex justify-center gap-2">
          {slides.map((_, i) => (
            <span key={i} className={`size-2.5 rounded-full ${i === index ? "bg-brand" : "bg-line/40"}`} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
