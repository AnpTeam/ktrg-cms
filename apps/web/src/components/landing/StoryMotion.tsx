"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Motion for the landing story (docs/design-language.md, Motion). Words fade up as each chapter arrives, the ridge
// draws itself as it scrolls by, and the page's ground crossfades to each chapter's own. Nothing depends on it: every
// chapter is complete and readable as the server sent it. GSAP is fetched here only (not in the shared bundle), after
// the page is shown, and only when the visitor allows motion; under reduced motion nothing loads and nothing moves.
export function StoryMotion({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    let stop = () => {};
    let gone = false;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (gone) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      // matchMedia: if the visitor turns reduced motion on while the page is open, everything is reverted to the plain page.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const grounds = gsap.utils.toArray<HTMLElement>("[data-ground]", el);
        // Read each chapter's colours before .story-live makes the chapters see-through.
        const colours = grounds.map((g) => {
          const s = getComputedStyle(g);
          return { backgroundColor: s.backgroundColor, color: s.color };
        });
        if (colours[0]) gsap.set(el, colours[0]);
        el.classList.add("story-live");
        // Top to bottom, as ScrollTrigger refreshes in creation order.
        grounds.forEach((g, i) => {
          ScrollTrigger.create({
            trigger: g,
            start: "top 55%",
            end: "bottom 55%",
            onToggle: (self) => {
              if (self.isActive) gsap.to(el, { ...colours[i], duration: 0.5, ease: "power1.out", overwrite: "auto" });
            },
          });
          // The words of a chapter below the first screen fade up, line by line, once.
          const words = g.querySelectorAll<HTMLElement>("[data-reveal] > *");
          if (words.length > 0 && g.getBoundingClientRect().top > window.innerHeight) {
            gsap.from(words, { autoAlpha: 0, y: 12, duration: 0.6, stagger: 0.08, ease: "power2.out", scrollTrigger: { trigger: g, start: "top 80%", once: true } });
          }
        });
        // The ridge draws as it passes: pathLength="1" on the path, so the dash is the whole line at any size.
        gsap.utils.toArray<SVGPathElement>("[data-ridge]", el).forEach((path) => {
          gsap.fromTo(path, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: path.ownerSVGElement ?? path, start: "top 90%", end: "bottom 45%", scrub: 0.6 } });
        });
        return () => el.classList.remove("story-live");
      });
      stop = () => mm.revert();
    });
    return () => {
      gone = true;
      stop();
    };
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
