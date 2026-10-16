import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { Notice } from "@/components/Notice";
import { RouteIcon, StampIcon, UserIcon } from "@/components/icons";
import { Ruby } from "@/components/Ruby";
import { SectionBanner } from "@/components/SectionBanner";
import { StampFace } from "@/components/StampFace";
import { TrailNode } from "@/components/TrailNode";
import { TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";

const primary =
  "tap-target flex min-h-14 items-center justify-center rounded-xl bg-brand px-6 text-xl font-bold text-on-brand";
const secondary =
  "tap-target flex min-h-14 items-center justify-center rounded-xl border-2 border-brand bg-surface px-6 text-xl font-bold text-accent hover:bg-paper";
const panel = "mx-4 rounded-xl border-2 border-brand/40 bg-surface p-4";

/**
 * The first screen for someone who is not signed in: what this is, where the trail goes, what the
 * app does, and how to start. Plain words, no photos (none are cleared for use yet), no invented
 * facts: the numbers come from `lib/rally`, the place names from the course list.
 * `to` adds the language prefix to a path.
 */
export function Landing({ to }: { to: (path: string) => string }) {
  return (
    <div className="flex flex-col gap-8">
      <section className="px-4">
        <div className="frame p-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-serif text-4xl font-bold leading-snug">
              <Ruby reading="かつらぎしゅげん">
                <Trans>葛城修験</Trans>
              </Ruby>
            </h1>
            {/* The stamp is the thing you collect here, so it is also the mark of the page. */}
            <StampFace state="stamped" className="h-20 w-20 shrink-0 -rotate-3 text-2xl font-bold">
              経塚
            </StampFace>
          </div>
          <p className="mt-3 font-serif text-2xl font-bold leading-snug">
            <Trans>歩いた場所で、スタンプを押そう。</Trans>
          </p>
          <p className="mt-3 max-w-prose text-xl leading-8">
            <Trans>
              大阪・和歌山・奈良にまたがる、<span className="whitespace-nowrap">約{TRAIL_KM}km</span>の山の道。スタンプを集めながら、ゆっくり歩けます。
            </Trans>
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Link href={to("/register")} className={primary}>
              <Trans>新規登録（無料）</Trans>
            </Link>
            <Link href={to("/routes")} className={secondary}>
              <Trans>ルートをさがす</Trans>
            </Link>
            <p className="text-lg">
              <Trans>登録済みの方は</Trans>{" "}
              <Link href={to("/login")} className="font-bold">
                <Trans>ログイン</Trans>
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="px-4">
          <SectionBanner>
            <Trans>歩く道</Trans>
          </SectionBanner>
        </div>
        <div className={panel}>
          <p className="max-w-prose text-lg leading-8">
            <Trans>和歌山県の友ヶ島から、大阪府をとおり、奈良県へ。西から東へ、つながる道です。</Trans>
          </p>
          <ol className="mt-5">
            <TrailStop order={1} last={false} href={to("/routes?pref=wakayama")} title={<Trans>和歌山県</Trans>}>
              <Trans>友ヶ島と加太のあたりから、はじまります。</Trans>
            </TrailStop>
            <TrailStop order={2} last={false} href={to("/routes?pref=osaka")} title={<Trans>大阪府</Trans>}>
              <Trans>山なみに沿って、東へ進みます。</Trans>
            </TrailStop>
            <TrailStop order={3} last href={to("/routes?pref=nara")} title={<Trans>奈良県</Trans>}>
              <Trans>二上山や金剛山のあたりを通って、ゴールへ。</Trans>
            </TrailStop>
          </ol>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="px-4">
          <SectionBanner>
            <Trans>このアプリでできること</Trans>
          </SectionBanner>
        </div>
        <ul className={`${panel} flex flex-col gap-5`}>
          <Feature icon={<RouteIcon />} title={<Trans>コースを見る</Trans>}>
            <Trans>地図で、歩く道とスタンプの場所を確認できます。</Trans>
          </Feature>
          <Feature icon={<StampIcon />} title={<Trans>スタンプを押す</Trans>}>
            <Trans>その場所に着いたら、ボタンを押すだけ。アプリが場所を確かめて、スタンプを押します。</Trans>
          </Feature>
          <Feature icon={<UserIcon />} title={<Trans>記録を残す</Trans>}>
            <Trans>登録すると、集めたスタンプが記録されます。</Trans>
          </Feature>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="px-4">
          <SectionBanner>
            <Trans>葛城修験とは</Trans>
          </SectionBanner>
        </div>
        <div className={panel}>
          <p className="max-w-prose text-lg leading-8">
            <Trans>
              葛城の山々は、山で心と体をきたえる「修験道（しゅげんどう）」のはじまりの地といわれます。役行者（えんのぎょうじゃ）が、お経を納めたと伝わる場所が「経塚（きょうづか）」です。経塚は、お経の28の章にあたる28番まであり、3つの番号には2か所ずつあるので、全部で31か所です。
            </Trans>
          </p>
          <dl className="mt-4 border-t-2 border-brand/40">
            <Fact term={<Trans>コース</Trans>} value={<Trans>全{TOTAL_ROUTES}区間</Trans>} />
            <Fact term={<Trans>長さ</Trans>} value={<Trans>約{TRAIL_KM}km</Trans>} />
            <Fact term={<Trans>経塚</Trans>} value={<Trans>{TOTAL_STAMPS}か所</Trans>} />
          </dl>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="px-4">
          <SectionBanner>
            <Trans>出かける前に</Trans>
          </SectionBanner>
        </div>
        <ul className={`${panel} flex flex-col gap-3 text-lg leading-8`}>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-accent">
              ・
            </span>
            <Trans>山道です。天気と、水や食べ物、歩きやすい靴を用意してください。</Trans>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-accent">
              ・
            </span>
            <Trans>山の中は、電波がつながりにくいことがあります。</Trans>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-accent">
              ・
            </span>
            <Trans>道が通れないときは、無理をせず引き返してください。</Trans>
          </li>
        </ul>
        <Notice>
          <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
        </Notice>
      </section>

      <section className="flex flex-col gap-3 px-4 pb-4">
        <SectionBanner>
          <Trans>さあ、はじめましょう</Trans>
        </SectionBanner>
        <div className="flex flex-col gap-3">
          <Link href={to("/register")} className={primary}>
            <Trans>新規登録（無料）</Trans>
          </Link>
          <Link href={to("/routes")} className={secondary}>
            <Trans>ルートをさがす</Trans>
          </Link>
        </div>
      </section>
    </div>
  );
}

/** One stop on the page's own little trail: a node, a line down to the next, and a link. */
function TrailStop({
  order,
  last,
  href,
  title,
  children,
}: {
  order: number;
  last: boolean;
  href: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="relative pb-6 pl-16 last:pb-0">
      <span className="absolute left-0 top-0">
        <TrailNode state="neutral" order={order} share={0} />
      </span>
      {last ? null : <span aria-hidden="true" className="absolute bottom-0 left-[21px] top-11 w-0.5 bg-brand" />}
      <Link href={href} className="tap-target block">
        <span className="block text-xl font-bold text-accent">{title}</span>
        <span className="mt-1 block text-lg leading-7 text-muted">{children}</span>
      </Link>
    </li>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="mt-1 shrink-0 rounded-full bg-brand p-2 text-on-brand">{icon}</span>
      <div>
        <p className="text-xl font-bold text-accent">{title}</p>
        <p className="mt-1 text-lg leading-8">{children}</p>
      </div>
    </li>
  );
}

function Fact({ term, value }: { term: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b-2 border-brand/40 py-3">
      <dt className="text-lg text-muted">{term}</dt>
      <dd className="text-2xl font-bold tabular-nums text-accent">{value}</dd>
    </div>
  );
}
