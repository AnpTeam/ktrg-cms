// The story page, in our own words (docs/landing-story-design.md). It replaces the copy of the official page; the facts
// come from the Katsuragi Shugendō Japan Heritage site, which is credited on the page. Plain strings only. `{km}` is
// filled in from lib/rally.ts so the length is written in one place.

export const STORY_SOURCE_URL = "https://katsuragisyugen-nihonisan.com/story/";

type Pair = { ja: string; en: string };
export type StorySection = { heading: Pair; paragraphs: Pair[] };

export const STORY_SECTIONS: StorySection[] = [
  {
    heading: { ja: "修験道は、ここから始まった", en: "Where Shugendō began" },
    paragraphs: [
      {
        ja: "大阪と和歌山の境を東西にのびる和泉山脈と、大阪と奈良の境を南北に走る金剛山地。この峰々の一帯が「葛城」です。全長はおよそ{km}km。古くから、神々の宿る山として敬われてきました。",
        en: "The Izumi Mountains run east to west along the border of Osaka and Wakayama, and the Kongō Mountains run north to south along the border of Osaka and Nara. Together these ridges are called Katsuragi, some {km} km in all, and people have long honoured them as mountains where the gods dwell.",
      },
      {
        ja: "七世紀、いまの奈良県御所市のあたりに生まれた役行者（えんのぎょうじゃ）は、修験道を開いた人と伝えられています。その役行者が、最初に修行を重ねた山がここ、葛城でした。",
        en: "In the seventh century a man named En no Gyōja was born near what is now Gose in Nara. He is said to have founded Shugendō, and Katsuragi is where he first trained.",
      },
      {
        ja: "のちに修行の場を大峯山へ移したとされ、葛城と大峯は、修験者にとってどちらも欠かせない行場になりました。",
        en: "Later he is said to have moved on to Ōmine, and from then on practitioners treated Katsuragi and Ōmine as the two places they had to train.",
      },
      {
        ja: "役行者は、法華経の八巻二十八品を一品ずつ山に埋めたと伝わります。その場所が「経塚」です。一番から二十八番までの経塚と、滝、巨石、寺や社をめぐる修行を、あわせて葛城修験と呼びます。",
        en: "It is told that En no Gyōja buried the Lotus Sutra here, one of its 28 chapters at a time. Each burial place is a sutra mound (kyōzuka), numbered 1 to 28. Walking from mound to mound, past waterfalls, great rocks, temples and shrines, is what is called Katsuragi Shugen.",
      },
    ],
  },
  {
    heading: { ja: "海から始まる道", en: "A path that starts at the sea" },
    paragraphs: [
      {
        ja: "旅は海から始まります。一番目の経塚「序品窟（じょほんくつ）」は、和歌山市の加太沖に浮かぶ友ヶ島の島のひとつ、虎島にあります。",
        en: "The journey begins at the sea. The first mound, Jobon-kutsu, is a cave on Tora Island, one of the Tomogashima islands off Kada in Wakayama City.",
      },
      {
        ja: "ふだん船で訪れる沖ノ島から、潮がひいたときだけ岩場を歩いて渡れます。山の修行なのに、はじめの一歩は海辺です。潮の時刻と公式の案内を、出かける前に確かめてください。",
        en: "From Oki Island, where visitors arrive by boat, you can cross the rocks on foot, but only at low tide. A mountain practice that starts on the shore. Please check the tide times and official notices before you go.",
      },
    ],
  },
  {
    heading: { ja: "里の人とともに", en: "Together with the villages" },
    paragraphs: [
      {
        ja: "葛城の山はそれほど高くなく、集落がすぐそばにあります。そのため修験者は、昔から里の暮らしや信仰と深くつながってきました。",
        en: "The Katsuragi mountains are not very high and villages lie close by, so practitioners have always been closely tied to the daily life and faith of the people living there.",
      },
      {
        ja: "とくに大阪府の南西部では、田畑をうるおす水への祈りが大切にされました。滝や雨乞いの場も行所になり、雨乞いの踊りは、岸和田の葛城踊り、和泉の笹踊りとして今も受けつがれています。",
        en: "In south-western Osaka especially, prayers for the water that feeds the fields mattered a great deal. Waterfalls and rain-calling sites became training places too, and the rain dances live on today as the Katsuragi dance in Kishiwada and the Sasa dance in Izumi.",
      },
      {
        ja: "修験者を支えたのも里の人々でした。和歌山市加太の向井家は、代々、修験者を迎える役を務め、紀の川市の中津川には、最も大切な儀式「葛城灌頂（かつらぎかんじょう）」が行われる行所があります。",
        en: "It was the villagers who supported the practitioners. The Mukai family of Kada in Wakayama City has for generations been the one to welcome them, and at Nakatsugawa in Kinokawa lies the site where Katsuragi Kanjō, the most important ritual, is held.",
      },
      {
        ja: "明治のはじめ、神仏分離にともなう廃仏毀釈や修験宗の廃止で、修験道は衰えました。行所や経塚は荒れ、道さえわからなくなった所もあります。それでも、里の人と修験者によって、この道は今に伝えられました。",
        en: "In the early Meiji era the separation of Shinto and Buddhism, the destruction of temples and the abolition of the Shugen sect brought decline. Training places and mounds fell into ruin, and in some places even the way there was lost. Even so, villagers and practitioners handed this path down to the present.",
      },
    ],
  },
  {
    heading: { ja: "いまの葛城修験、そしてこれから", en: "Katsuragi Shugen today, and tomorrow" },
    paragraphs: [
      {
        ja: "いまも多くの修験者が、この道で修行をしています。大峯山が女人禁制であるのに対し、葛城修験は多くの女性の修験者を受け入れてきました。",
        en: "Many practitioners still train here. Ōmine has long been closed to women, but Katsuragi Shugen has welcomed many women practitioners.",
      },
      {
        ja: "都市のすぐそばにあるのも、この地の特徴です。関西国際空港は目と鼻の先で、大阪の中心部、京都、高野山も遠くありません。尾根道は、近畿自然歩道やダイヤモンドトレールとして整えられ、ハイカーにも歩かれています。",
        en: "It also lies right beside the cities. Kansai International Airport is close, and central Osaka, Kyoto and Mount Kōya are not far. The ridge paths are kept up as the Kinki Nature Trail and the Diamond Trail, and hikers walk them too.",
      },
      {
        ja: "歩いていると、滝の音にまじって法螺貝（ほらがい）の響きが聞こえるかもしれません。木立のなかにひっそりとたたずむのは、経文が納められた経塚かもしれません。鈴懸（すずかけ）の装束の修験者と、すれちがうこともあるでしょう。",
        en: "As you walk, the sound of a conch trumpet may drift in with the noise of a waterfall. A quiet shape among the trees may be a sutra mound. You may pass a practitioner in traditional dress.",
      },
      {
        ja: "修験者の思いと、それを受けとめてきた地域の人々、そして葛城の自然や文化を楽しみに訪れる人。その行き来がつづくかぎり、葛城修験の歴史は、これからも刻まれていきます。",
        en: "As long as practitioners, the communities that have received them, and the people who come to enjoy Katsuragi's nature and culture keep coming and going, the history of Katsuragi Shugen will go on being written.",
      },
    ],
  },
];

/** One paragraph in a language, with the trail length filled in. */
export function storyParagraph(p: Pair, locale: "ja" | "en", km: number): string {
  return p[locale].replaceAll("{km}", String(km));
}
