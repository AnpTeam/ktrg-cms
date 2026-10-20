import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { KatsuragiLogo } from "@/components/KatsuragiLogo";

// The first screen of the landing page: the logo, the line, the buttons, and the drawing (under them on a phone and a
// tablet, beside them from 1024 px).
// It is drawn, not photographed: three ridges of the Katsuragi range and the trail winding
// along them with its stamp points, over the faint 七宝 pattern. Plain SVG and CSS in the theme's colours: a few
// hundred bytes, no image to download, no script and no animation, so it is as light as the rest of the page.
// A photo can take its place later (see the photo slots in the admin).

const primary = "tap-target inline-flex min-h-14 items-center justify-center rounded-xl bg-ink px-8 text-xl font-bold text-paper";
const secondary = "tap-target inline-flex min-h-14 items-center justify-center rounded-xl border border-ink bg-paper/70 px-8 text-xl font-bold text-ink hover:bg-paper";

export function LandingHero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden rounded-lg bg-surface lg:min-h-[30rem]">
      <div aria-hidden="true" className="pattern-shippo absolute inset-0" />
      {/* Under the text on a phone and a tablet, beside it from 1024 px. */}
      <svg aria-hidden="true" viewBox="0 0 640 440" preserveAspectRatio="xMaxYMax slice" className="absolute inset-x-0 bottom-0 h-44 w-full [mask-image:linear-gradient(to_bottom,transparent,black_40%)] md:h-60 lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-[62%] lg:[mask-image:linear-gradient(to_right,transparent,black_28%)]" focusable="false">
        <path d="M0 440V300l70-70 62 48 88-120 82 104 66-62 92 96 80-70 100 100v114z" className="fill-ink" opacity="0.07" />
        <path d="M0 440V340l96-84 78 66 104-110 92 104 70-48 120 108v64z" className="fill-ink" opacity="0.13" />
        <path d="M0 440V392l110-52 96 38 112-74 92 60 108-46 122 56v66z" className="fill-ink" opacity="0.24" />
        <path d="M40 410c70-26 120-6 190-44s110-86 190-72 120-50 200-82" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 12" className="stroke-paper" />
        {[
          [40, 410],
          [230, 366],
          [420, 294],
          [610, 212],
        ].map(([x, y]) => (
          <circle key={`${x}`} cx={x} cy={y} r="11" strokeWidth="5" className="fill-shu stroke-paper" />
        ))}
      </svg>
      <div className="relative z-10 flex max-w-[34rem] flex-col justify-center gap-5 px-5 pb-48 pt-6 md:px-10 md:pb-64 md:pt-10 lg:min-h-[30rem] lg:gap-6 lg:px-12 lg:py-12">
        <h1 id="hero-title">
          <span className="sr-only">
            <Trans>葛城修験</Trans>
          </span>
          <KatsuragiLogo className="h-auto w-full max-w-[13rem] md:max-w-[17rem] lg:max-w-[28rem]" />
        </h1>
        <p className="font-serif text-2xl font-bold leading-snug md:text-3xl lg:text-4xl lg:leading-tight">
          <Trans>「祈り」を見つめる再発見の旅</Trans>
        </p>
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
