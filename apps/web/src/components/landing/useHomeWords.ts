import { useLingui } from "@lingui/react/macro";
import type { HomeSlot, HomeText } from "@/lib/home-text";

/** The home page's words: the app's own, with what an editor wrote laid over them. The editor's screen reads the app's own from here too. */
export function useHomeWords(own: HomeText = {}): Record<HomeSlot, string> {
  const { t } = useLingui();
  return {
    heroLine: t`「祈り」を見つめる再発見の旅`,
    rallyHeading: t`スタンプラリー`,
    rallyLead: t`歩いて、スタンプを集めよう。`,
    rallyText: t`行き先の近くでボタンを押すと、スタンプがたまります。位置は、押した一回だけ調べ、保存しません。`,
    routesHeading: t`歩く道`,
    mapHeading: t`全体の地図`,
    storyHeading: t`葛城修験とは`,
    storyText: t`和泉山脈から金剛山地へ。大阪・和歌山・奈良の境にのびるこの山なみは、古くから「葛城」と呼ばれ、神の宿る山として敬われてきました。山で心身をきたえる修験道を開いたと伝わる役行者が、はじめて修行をしたのも、この山々だといわれています。`,
    storyCaption: t`役小角（役行者）`,
    videoHeading: t`動画で見る`,
    officialHeading: t`公式サイトで、もっと知る`,
    tourismHeading: t`観光情報`,
    beforeHeading: t`出かける前に`,
    before1: t`山道です。天気と、水や食べ物、歩きやすい靴を用意してください。`,
    before2: t`山の中は、電波がつながりにくいことがあります。`,
    before3: t`道が通れないときは、無理をせず引き返してください。`,
    beforeNotice: t`出かける前に、公式の最新情報を確認してください。`,
    startHeading: t`さあ、はじめましょう`,
    ...own,
  };
}
