import Image from "next/image";
import Link from "next/link";
import { Trans } from "@lingui/react/macro";

// The first screen of the landing page: a photo of the trail with the line over it, and under it the two buttons.
// The photo is the council's own (public/home, reused with their permission, see the decisions log 2026-11-02). The
// words sit on a dark fade so they stay readable on any part of the photo; the buttons are below the photo, on the page
// colour, so their contrast does not depend on it.

const primary = "tap-target inline-flex min-h-14 items-center justify-center rounded-xl bg-ink px-8 text-xl font-bold text-paper";
const secondary = "tap-target inline-flex min-h-14 items-center justify-center rounded-xl border border-ink bg-paper/70 px-8 text-xl font-bold text-ink hover:bg-paper";

export function LandingHero() {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden rounded-lg bg-surface">
      <div className="relative h-72 md:h-96 lg:h-[30rem]">
        <Image src="/home/top_slider_img01.jpg" alt="" fill priority sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 px-5 pb-5 md:px-10 md:pb-8 lg:px-12 lg:pb-10">
          <p className="text-lg font-bold text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.7)] md:text-xl">
            <Trans>日本遺産 葛城修験</Trans>
          </p>
          <h1 id="hero-title" className="font-serif text-3xl font-bold leading-snug text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.7)] md:text-4xl lg:text-5xl">
            <Trans>「祈り」を見つめる再発見の旅</Trans>
          </h1>
        </div>
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
