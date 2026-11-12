import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { initLingui } from "@/i18n/server";
import { PHYSICAL_LEVEL_UPPER_BOUNDS, TECHNICAL_LEVELS } from "@/lib/grading";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n.locale === "ja" ? "体力度と技術度について" : "About the physical and technical levels" };
}

const panel = "mx-4 flex flex-col gap-3 rounded-[1.75rem] bg-surface p-5 text-lg leading-8";

// How the two levels on a route are worked out. Written in our own words; the idea follows the mountain grading used in Nagano
// Prefecture (信州 山のグレーディング). The numbers are a guide: the person who edits the route chooses the saved level.
export default async function GradingPage() {
  const i18n = await initLingui();
  const ja = i18n.locale === "ja";
  const technical: Record<(typeof TECHNICAL_LEVELS)[number], string> = ja
    ? {
        A: "整備された道で、迷いにくく、転んでも大きな事故になりにくい。",
        B: "急な登り下りや、わかりにくい所がある。はしごやくさりが出ることもある。",
        C: "転落・滑落の危険がある所がある。地図を読む力と、ミスをしない注意が必要。",
        D: "岩場やガレ場、手を使う急な登り下りがある。道がわかりにくい所も多い。",
        E: "厳しい岩場や藪こぎが続く。道を自分で見つける技術と、高い判断力が必要。",
      }
    : {
        A: "A well-kept path that is hard to lose, where a fall is unlikely to be serious.",
        B: "Steep climbs and descents, and some places that are hard to follow. Ladders or chains may appear.",
        C: "Places where a fall or slip is dangerous. You need to read a map and take care not to make mistakes.",
        D: "Rocky ground and scree, and steep sections where you use your hands. Many places are hard to follow.",
        E: "Long stretches of hard rock or thick brush. You must find your own way and judge well.",
      };

  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/routes">
          <Trans>ルート一覧</Trans>
        </BackLink>
        <h1 className="font-serif text-3xl font-bold text-accent">
          <Trans>体力度と技術度について</Trans>
        </h1>
        <p className="text-lg leading-8">
          <Trans>ルートの「体力度」と「技術度」は、歩く前に大変さを知るための目安です。公式の情報ではありません。天気や体調で、感じ方は変わります。</Trans>
        </p>
      </div>

      <section id="physical" className={`${panel} scroll-mt-24`}>
        <h2 className="border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent">
          <Trans>体力度（1〜10）</Trans>
        </h2>
        <p>
          <Trans>歩く時間、距離、登りと下りの高さから、「コース定数」という数字を出します。この数字が大きいほど、体力が必要です。</Trans>
        </p>
        <p className="rounded-2xl bg-paper p-4 font-bold">
          <Trans>コース定数 ＝ 1.8 × 時間（h） ＋ 0.3 × 距離（km） ＋ 10 × 登り（km） ＋ 0.6 × 下り（km）</Trans>
        </p>
        <p>
          <Trans>たとえば、4時間・距離8km・登り500m・下り500mなら、1.8×4 ＋ 0.3×8 ＋ 10×0.5 ＋ 0.6×0.5 ＝ 14.9 で、体力度は2です。</Trans>
        </p>
        <ul className="flex flex-col gap-1">
          {PHYSICAL_LEVEL_UPPER_BOUNDS.map((upper, i) => (
            <li key={upper} className="flex justify-between gap-4 border-t border-line/30 pt-1 tabular-nums">
              <span className="font-bold">
                <Trans>体力度 {i + 1}</Trans>
              </span>
              <span>{i === 0 ? `〜 ${upper}` : `${PHYSICAL_LEVEL_UPPER_BOUNDS[i - 1]} 〜 ${upper}`}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4 border-t border-line/30 pt-1 tabular-nums">
            <span className="font-bold">
              <Trans>体力度 10</Trans>
            </span>
            <span>{`${PHYSICAL_LEVEL_UPPER_BOUNDS.at(-1)} 〜`}</span>
          </li>
        </ul>
        <p className="text-base text-muted">
          <Trans>数字は目安です。保存される体力度は、ルートを作った人が、この計算を見て決めています。</Trans>
        </p>
      </section>

      <section id="technical" className={`${panel} scroll-mt-24`}>
        <h2 className="border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent">
          <Trans>技術度（A〜E）</Trans>
        </h2>
        <p>
          <Trans>技術度は計算ではなく、道の様子から人が決めます。Aがいちばんやさしく、Eがいちばん難しいです。</Trans>
        </p>
        <dl className="flex flex-col gap-2">
          {TECHNICAL_LEVELS.map((level) => (
            <div key={level} className="flex gap-3 border-t border-line/30 pt-2">
              <dt className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-xl font-bold text-paper">{level}</dt>
              <dd>{technical[level]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mx-4 text-base text-muted">
        <Trans>この考え方は、長野県の「信州 山のグレーディング」を参考にしています。説明は、このサイト独自の言葉です。</Trans>
      </p>
    </div>
  );
}
