import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { KatsuragiLogo } from "@/components/KatsuragiLogo";

// The big first screen of the landing page on a desktop (from 1024 px; a phone has the compact title card instead).
// It is drawn, not photographed: the red sun of the logo, three ridges of the Katsuragi range and the trail winding
// along them with its stamp points, over the faint 七宝 pattern. Plain SVG and CSS in the theme's colours: a few
// hundred bytes, no image to download, no script and no animation, so it is as light as the rest of the page.
// A photo can take its place later (see the photo slots in the admin).

const primary = "tap-target inline-flex min-h-14 items-center justify-center rounded-2xl bg-brand px-8 text-xl font-bold text-on-brand";
const secondary = "tap-target inline-flex min-h-14 items-center justify-center rounded-2xl border-2 border-brand bg-paper/70 px-8 text-xl font-bold text-accent hover:bg-paper";

export function LandingHero() {
  return (
    <section aria-labelledby="hero-title" className="relative hidden min-h-[30rem] overflow-hidden rounded-[2rem] bg-surface lg:block">
      <div aria-hidden="true" className="pattern-shippo absolute inset-0" />
      <svg aria-hidden="true" viewBox="0 0 640 440" preserveAspectRatio="xMaxYMax slice" className="absolute inset-y-0 right-0 h-full w-[62%] [mask-image:linear-gradient(to_right,transparent,black_28%)]" focusable="false">
        <circle cx="440" cy="150" r="112" className="fill-brand" opacity="0.92" />
        <path d="M0 440V300l70-70 62 48 88-120 82 104 66-62 92 96 80-70 100 100v114z" className="fill-brand" opacity="0.22" />
        <path d="M0 440V340l96-84 78 66 104-110 92 104 70-48 120 108v64z" className="fill-accent" opacity="0.28" />
        <path d="M0 440V392l110-52 96 38 112-74 92 60 108-46 122 56v66z" className="fill-ink" opacity="0.2" />
        <path d="M40 410c70-26 120-6 190-44s110-86 190-72 120-50 200-82" fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 14" className="stroke-paper" />
        {[
          [40, 410],
          [230, 366],
          [420, 294],
          [610, 212],
        ].map(([x, y]) => (
          <circle key={`${x}`} cx={x} cy={y} r="11" strokeWidth="5" className="fill-shu stroke-paper" />
        ))}
      </svg>
      <div className="relative z-10 flex min-h-[30rem] max-w-[34rem] flex-col justify-center gap-6 px-12 py-12">
        <h1 id="hero-title">
          <span className="sr-only">
            <Trans>葛城修験</Trans>
          </span>
          <KatsuragiLogo className="h-auto w-full max-w-[28rem]" />
        </h1>
        <p className="font-serif text-4xl font-bold leading-tight">
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
