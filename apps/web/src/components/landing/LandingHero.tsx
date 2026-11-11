import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { HeroSlides, type HeroSlide } from "@/components/landing/HeroSlides";
import type { BannerSlide } from "@/lib/banners";
import { buttonStyle } from "@/components/button";
import { KatsuragiLogo } from "@/components/KatsuragiLogo";

// The first screen of the landing page: the admin's banner photos run from edge to edge of the page, with the line over them,
// and under them the buttons. With no banner yet, one photo of the trail (public/home, from the Japan Heritage council, reused
// with their permission: decisions log 2026-11-02) stands in. The words sit on a dark fade so they read on any photo; the
// buttons are below the photos, on the page colour, so their contrast does not depend on a picture.

const primary = buttonStyle("primary", "lg", "inline-flex");
const secondary = buttonStyle("secondary", "lg", "inline-flex");

const FALLBACK: HeroSlide = { src: "/home/top_slider_img01.jpg", alt: "", unoptimized: false };

/**
 * `title` (a signed-in visitor's greeting) takes the line's place, with the line kept small above it; `children` take the
 * buttons' place on the patterned band below (their progress, instead of signing up). `bare` leaves the band out: the
 * landing journey (Journey.tsx) shows the photos alone as its first beat and puts the buttons in its last.
 */
export function LandingHero({ slides, locale, line, title, children, bare = false }: { slides: BannerSlide[]; locale: string; line: string; title?: ReactNode; children?: ReactNode; bare?: boolean }) {
  const photos: HeroSlide[] = slides.flatMap((s) => (s.src ? [{ src: s.src, alt: locale === "ja" ? s.altJa : s.altEn, credit: s.credit, unoptimized: true }] : []));
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden bg-surface">
      {/* The line and the logo sit in the middle of the photos. A first-time visitor gets a taller picture with the line set
          vertically (the reading register); a low screen keeps it across, still centred. */}
      <div className="relative h-80 tall:h-[min(78svh,44rem)] @[34rem]:h-96 @[42rem]:h-[30rem]">
        <HeroSlides slides={photos.length > 0 ? photos : [FALLBACK]}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 mx-auto flex max-w-6xl flex-col items-center justify-center gap-5 px-12 py-6 text-center">
            {/* The line and the title are one block: set vertically on a tall screen (the line to the right of the title, as
                columns run right to left), across and centred on a low one. Signed in or not. */}
            <div className="flex flex-col items-center gap-2 tall:block tall:max-h-[calc(100%-7rem)] tall:tracking-[0.04em] tall:[writing-mode:vertical-rl]">
              {title ? (
                <p className="font-serif text-lg font-bold text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.7)] tall:ml-4 @[34rem]:text-xl">{line}</p>
              ) : null}
              <h1 id="hero-title" className="font-serif text-3xl font-bold leading-snug text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.7)] @[34rem]:text-4xl @[42rem]:text-5xl">
                <span className="sr-only">
                  <Trans>葛城修験</Trans>{" "}
                </span>
                {title ?? line}
              </h1>
            </div>
            {/* The logo in white: its colours are theme tokens, so they are set to white for this one. */}
            <KatsuragiLogo className="h-14 w-auto shrink-0 [--color-brand:#fff] [--color-ink:#fff] [filter:drop-shadow(0_1px_4px_rgb(0_0_0/0.6))]" />
          </div>
        </HeroSlides>
      </div>
      {bare ? null : <div className="pattern-shippo">
      {children ? <div className="mx-auto max-w-6xl py-6 @[34rem]:px-6">{children}</div> : (
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-6 text-center @[34rem]:px-10 @[42rem]:flex-row @[42rem]:justify-between @[42rem]:text-left">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className={primary}>
            <Trans>新規登録</Trans>
          </Link>
          <Link href="/routes" className={secondary}>
            <Trans>ルートをさがす</Trans>
          </Link>
        </div>
        <p className="text-lg opacity-80">
          <Trans>登録済みの方は</Trans>{" "}
          <Link href="/login" className="tap-target inline-flex items-center font-bold underline underline-offset-4">
            <Trans>ログイン</Trans>
          </Link>
        </p>
      </div>
      )}
      </div>}
    </section>
  );
}
