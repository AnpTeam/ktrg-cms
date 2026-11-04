import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { KatsuragiLogo } from "@/components/KatsuragiLogo";
import { HeroSlides, type HeroSlide } from "@/components/landing/HeroSlides";
import type { BannerSlide } from "@/lib/banners";

// The first screen of the landing page: the admin's banner photos fill the top, with the logo and the line over them, and
// under them the buttons. With no banner yet, one photo of the trail (public/home, from the Japan Heritage council, reused
// with their permission: decisions log 2026-11-02) stands in. The words sit on a dark fade so they read on any photo; the
// buttons are below the photos, on the page colour, so their contrast does not depend on a picture.
// The marker class `landing-hero` lets globals.css hide the sidebar's own logo (the big one is here); it keeps its space.

const primary = "tap-target inline-flex min-h-14 items-center justify-center rounded-xl bg-ink px-8 text-xl font-bold text-paper";
const secondary = "tap-target inline-flex min-h-14 items-center justify-center rounded-xl border border-ink bg-paper/70 px-8 text-xl font-bold text-ink hover:bg-paper";

const FALLBACK: HeroSlide = { src: "/home/top_slider_img01.jpg", alt: "", unoptimized: false };

export function LandingHero({ slides, locale }: { slides: BannerSlide[]; locale: string }) {
  const photos: HeroSlide[] = slides.flatMap((s) => (s.src ? [{ src: s.src, alt: locale === "ja" ? s.altJa : s.altEn, credit: s.credit, unoptimized: true }] : []));
  return (
    <section aria-labelledby="hero-title" className="landing-hero overflow-hidden rounded-lg bg-surface">
      <div className="relative h-80 md:h-96 lg:h-[30rem]">
        <HeroSlides slides={photos.length > 0 ? photos : [FALLBACK]}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-between p-4 md:p-8 lg:p-10">
            <div className="w-fit rounded-xl bg-paper/90 px-4 py-2 shadow-lg">
              <KatsuragiLogo className="h-20 w-auto md:h-28 lg:h-32" />
            </div>
            <h1 id="hero-title" className="font-serif text-3xl font-bold leading-snug text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.7)] md:text-4xl lg:text-5xl">
              <span className="sr-only">
                <Trans>葛城修験</Trans>{" "}
              </span>
              <Trans>「祈り」を見つめる再発見の旅</Trans>
            </h1>
          </div>
        </HeroSlides>
      </div>
      <div className="pattern-shippo flex flex-col gap-4 px-5 py-6 md:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-12">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/register" className={primary}>
            <Trans>新規登録</Trans>
          </Link>
          <Link href="/routes" className={secondary}>
            <Trans>ルートをさがす</Trans>
          </Link>
        </div>
        <p className="text-lg opacity-80">
          <Trans>登録済みの方は</Trans>{" "}
          <Link href="/login" className="font-bold underline">
            <Trans>ログイン</Trans>
          </Link>
        </p>
      </div>
    </section>
  );
}
