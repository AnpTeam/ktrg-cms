"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { beatAt, drawnShare, motionMode, sealsPlaced } from "@/lib/journey";
import { DESK_QUERY, PHONE_RIDGE_ROOM_PX, RIDGE_ROOM_PX, SCENE_QUERY, beatsFit } from "@/lib/landing-desktop";

/**
 * The landing journey's motion (docs/landing-journey-design.md). `children` are the complete static page (Journey.tsx);
 * this only adds to it, and every way it can fail leaves that page as it was:
 *  - calm on, no script, GSAP failing to load: nothing happens (the page stays stacked and complete);
 *  - reduced motion: no scene; the three beats fade in once as they arrive, nothing moves;
 *  - a screen shorter than 38rem (a phone on its side): no scene, the stacked page;
 *  - otherwise the scene: `.journey-live` turns the page into 250svh of scroll with one sticky stage, and a single
 *    scrubbed trigger draws the ridge, drops the seals and picks the beat whose text shows (`data-active-beat`).
 * Turning reduced motion on while the page is open reverts to the plain page (gsap.matchMedia).
 */
export function JourneyScene({ children, seals }: { children: ReactNode; seals: number }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mode = motionMode({ reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches, calm: document.documentElement.hasAttribute("data-calm") });
    if (mode === "static") return;

    const ridge = el.querySelector<SVGPathElement>("[data-ridge]");
    const ridgeSvg = ridge?.ownerSVGElement ?? null;
    const dots = Array.from(el.querySelectorAll<HTMLElement>("[data-seal]"));
    const beats = Array.from(el.querySelectorAll<HTMLElement>("[data-beat]")).filter((b) => b.dataset.beat !== "0");
    // Everything the scene touched, put back: the class, the active beat and every inline style.
    const reset = (clear: (targets: Element[], vars: object) => void) => {
      el.classList.remove("journey-live");
      el.style.removeProperty("--journey");
      delete el.dataset.activeBeat;
      ridgeSvg?.style.removeProperty("clip-path");
      clear([...dots, ...beats], { clearProps: "all" });
    };

    let stop = () => {};
    let gone = false;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (gone) return;
        gsap.registerPlugin(ScrollTrigger);
        const mm = gsap.matchMedia();
        // The scene needs a screen tall enough to hold a beat (a phone on its side is not: the story would be cut off and the
        // ridge out of reach), so a short screen keeps the stacked page. matchMedia re-checks it when the phone is turned.
        mm.add(mode === "scene" ? SCENE_QUERY : "(prefers-reduced-motion: reduce)", () => {
          if (mode === "fade") {
            // Reduced motion: the final scene as it is (ridge drawn, seals placed); each later beat only fades in, once.
            beats.forEach((beat) => {
              gsap.fromTo(beat, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none", clearProps: "opacity", scrollTrigger: { trigger: beat, start: "top 85%", once: true } });
            });
            return;
          }
          el.classList.add("journey-live");
          el.dataset.activeBeat = "0";
          // A beat's words plus a little room for the ridge must fit the screen. The chapter's own bottom padding is the ridge's
          // reserved zone, so it is not counted as words (a short screen may squeeze it). A taller beat (a long editor text, a big
          // text-size setting) would be cut off and out of reach, so the stacked page stays.
          // shortcut: measured when the scene starts (and when a query changes), not on every resize; upgrade if editors report clipping.
          // The chapter stretches to fill the stage (flex: 1), so its scrollHeight is never less than the screen and said "fits" for
          // any text. The words' own box is measured instead, plus the chapter's top padding and the ridge's room (a desk has the
          // ridge in the other column, a phone has it under the words).
          const room = window.matchMedia(DESK_QUERY).matches ? RIDGE_ROOM_PX : PHONE_RIDGE_ROOM_PX;
          const needs = beats.map((b, i) => {
            const chapter = (b.firstElementChild as HTMLElement | null) ?? b;
            if (i === 0) return chapter.scrollHeight - (parseFloat(getComputedStyle(chapter).paddingBottom) || 0) + RIDGE_ROOM_PX; // the photos beat has no ridge text
            const words = chapter.querySelector<HTMLElement>(":scope > div") ?? chapter;
            return words.offsetHeight + (parseFloat(getComputedStyle(chapter).paddingTop) || 0) + room;
          });
          if (!beatsFit(needs, window.innerHeight)) {
            el.classList.remove("journey-live");
            delete el.dataset.activeBeat;
            return;
          }
          // The line is revealed with a clip from the left, not a dash: with vector-effect non-scaling-stroke the dash is measured in
          // screen pixels but the line in drawing units, and in the desktop panel (stretched unevenly) a fully drawn line stopped at
          // about 90%. The elevation line only runs left to right, so a clip shows exactly the share drawn.
          const draw = (share: number) => ridgeSvg?.style.setProperty("clip-path", `inset(-8px ${((1 - share) * 100).toFixed(2)}% -8px -8px)`);
          draw(0);
          gsap.set(dots, { opacity: 0, scale: 0.6 });
          let placed = 0;
          let beat = 0;
          let away = false;
          ScrollTrigger.create({
            trigger: el,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            onUpdate: (self) => {
              const p = self.progress;
              if (!away && p > 0.02) {
                away = true;
                window.dispatchEvent(new Event("journey-scrolled")); // the photos stop advancing (HeroSlides)
              }
              el.style.setProperty("--journey", p.toFixed(3)); // the drawings drift with it (.decor-drift)
              draw(drawnShare(p));
              const n = sealsPlaced(p, seals);
              if (n !== placed) {
                dots.forEach((dot, i) => gsap.set(dot, i < n ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }));
                placed = n;
              }
              const b = beatAt(p);
              if (b !== beat) {
                el.dataset.activeBeat = String(b);
                beat = b;
              }
            },
          });
          return () => reset((targets, vars) => gsap.set(targets, vars));
        });
        stop = () => mm.revert();
      })
      .catch(() => reset(() => {}));
    return () => {
      gone = true;
      stop();
    };
  }, [seals]);

  return (
    <div ref={root} data-journey>
      {children}
    </div>
  );
}
