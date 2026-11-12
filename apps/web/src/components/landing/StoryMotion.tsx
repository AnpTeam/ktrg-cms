"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Motion for the landing page (docs/design-language.md, Motion). The words of every chapter (and its headline) rise and
// fade in as the chapter arrives, and the ridge draws itself as it scrolls by. The chapters keep their own static grounds:
// the page's ground used to crossfade between them, which flashed grey and cream as you scrolled, so it is gone.
//
// The words are hidden by CSS before the script runs (`.story-pending`, only when the visitor allows motion and calm is
// off) so they never show and then jump. Everything that could go wrong gives them back: no script (<noscript>), GSAP
// failing to load (the catch), reduced motion or calm (the rule never applies; the effect leaves at once).
const HIDDEN = "[data-reveal] > *, [data-ground] h2";

export function StoryMotion({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const show = () => el.classList.remove("story-pending");
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches || document.documentElement.hasAttribute("data-calm")) {
      show();
      return;
    }
    let stop = () => {};
    let gone = false;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (gone) return;
        gsap.registerPlugin(ScrollTrigger);
        const mm = gsap.matchMedia();
        // matchMedia: if the visitor turns reduced motion on while the page is open, everything is reverted to the plain page.
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          // One chapter at a time: its headline first, then its blocks one after another, once.
          gsap.utils.toArray<HTMLElement>("[data-ground]", el).forEach((g) => {
            if (g.closest("[data-journey]")) return; // the journey has its own scene (JourneyScene)
            const parts = Array.from(g.querySelectorAll<HTMLElement>(HIDDEN));
            if (parts.length === 0) return;
            gsap.set(parts, { autoAlpha: 0, y: 28, filter: "blur(6px)" });
            gsap.to(parts, {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 1,
              stagger: 0.14,
              ease: "power3.out",
              clearProps: "filter,transform", // leave no stacking context or blur behind once settled
              scrollTrigger: { trigger: g, start: "top 78%", once: true },
            });
          });
          show(); // after gsap.set, in the same tick: no frame where the words are neither hidden nor positioned
          // The ridge draws as it passes: pathLength="1" on the path, so the dash is the whole line at any size.
          gsap.utils.toArray<SVGPathElement>("[data-ridge]", el).forEach((path) => {
            if (path.closest("[data-journey]")) return;
            gsap.fromTo(path, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: path.ownerSVGElement ?? path, start: "top 90%", end: "bottom 45%", scrub: 0.6 } });
          });
          // The decorations (Decor.tsx) move gently: `data-parallax` drifts a few percent against the scroll while its chapter
          // passes, and `data-grow` (the kuzu vine) is uncovered from the top as the chapter scrolls by. Both leave the scene's
          // own drawings alone (they follow --journey), and neither runs for reduced motion or calm.
          gsap.utils.toArray<HTMLElement>("[data-parallax]", el).forEach((d) => {
            if (d.closest("[data-journey]")) return;
            gsap.fromTo(d, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: d.closest("[data-ground]") ?? d, start: "top bottom", end: "bottom top", scrub: true } });
          });
          gsap.utils.toArray<HTMLElement>("[data-grow]", el).forEach((d) => {
            if (d.closest("[data-journey]")) return;
            gsap.fromTo(d, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", ease: "none", scrollTrigger: { trigger: d.closest("[data-ground]") ?? d, start: "top 70%", end: "bottom 55%", scrub: true } });
          });
        });
        stop = () => mm.revert();
      })
      .catch(show);
    return () => {
      gone = true;
      stop();
    };
  }, []);

  return (
    <div ref={root} className={`story-pending ${className}`}>
      <noscript>
        <style>{".story-pending [data-reveal] > *, .story-pending [data-ground] h2 { opacity: 1 !important; transform: none !important; }"}</style>
      </noscript>
      {children}
    </div>
  );
}
