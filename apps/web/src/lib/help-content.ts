// The text of the how-to-play page, the FAQ and the licenses page, in both languages. Like the privacy policy these
// are documents, so they live here (one copy per language) and not in the message catalogs. Keep them true to
// what the app does; where something is not decided yet it says so instead of inventing it.

export interface Step {
  title: string;
  text: string;
}
export interface Faq {
  question: string;
  answer: string;
}
export interface Credit {
  name: string;
  text: string;
  url?: string;
}
export interface Help {
  guideTitle: string;
  guideIntro: string;
  steps: Step[];
  guideNote: string;
  faqTitle: string;
  faqs: Faq[];
  licensesTitle: string;
  licensesIntro: string;
  credits: Credit[];
}

const ja: Help = {
  guideTitle: "遊び方",
  guideIntro: "歩いた場所で、スタンプを集めていくアプリです。むずかしい操作はありません。",
  steps: [
    { title: "登録する", text: "メールか、顔・指紋（パスキー）で登録します。数分で終わります。" },
    { title: "ルートをえらぶ", text: "「ルート」から、歩きたいコースをえらびます。地図で、道とスタンプの場所が見られます。" },
    { title: "着いたら、スタンプを押す", text: "スタンプの場所に着いたら、ボタンを押します。アプリがいまの場所を確かめて、近くにいればスタンプが押されます。" },
    { title: "スタンプカードで見る", text: "「スタンプ」のページで、集めたスタンプと、のこりが見られます。" },
  ],
  guideNote: "山の中は、電波がつながりにくいことがあります。出かける前に、公式の最新情報を確認してください。",
  faqTitle: "よくあるご質問",
  faqs: [
    {
      question: "集めたスタンプが消えました",
      answer:
        "スタンプは、アカウントに保存されています。ログインの方法を変えると、別のアカウントになっていることがあります（メールで登録した方と、顔・指紋だけで登録した方は、別のアカウントです）。前と同じ方法でログインしてみてください。それでも見つからないときは、「スタンプ」のページに出ているID（8けたの数字）を、問い合わせ先にお伝えください。問い合わせ先は、公開までにここに書きます。",
    },
    {
      question: "位置情報を許可できません",
      answer: "お使いのスマートフォンの設定で、ブラウザの位置情報を「許可」にしてから、もう一度お試しください。位置情報は、スタンプを押すときにだけ使います。",
    },
    {
      question: "スタンプが押せません。「場所から離れすぎています」と出ます",
      answer: "スタンプの場所の近くまで行って、空の開けたところでお試しください。電波や位置の精度が悪いと、押せないことがあります。",
    },
    {
      question: "スタンプは、何日かに分けて集められますか",
      answer: "はい。集めたスタンプは、アカウントに保存されます。何回かに分けて、ゆっくり集められます。",
    },
    {
      question: "山の中で電波がつながりません",
      answer: "電波の良い場所に着いてから、もう一度お試しください。出かける前に、ルートの情報を見ておくと安心です。",
    },
    {
      question: "アカウントを消したいです",
      answer: "「スタンプ」のページで、プロフィールの「変える」を押すと、「アカウントを削除する」があります。押してから3日のあいだは、取り消せます。3日をすぎると、アカウントと記録がすべて消えます。",
    },
  ],
  licensesTitle: "ライセンス情報",
  licensesIntro: "このアプリは、次のものを使っています。",
  credits: [
    {
      name: "地図",
      text: "国土地理院（地理院タイル）。標準地図、陰影起伏図、色別標高図を使っています。",
      url: "https://maps.gsi.go.jp/development/ichiran.html",
    },
    { name: "地図の表示", text: "MapLibre GL JS（BSDライセンス）。" },
    {
      name: "府県の紋章",
      text: "大阪府・奈良県・和歌山県の紋章の図は、ウィキメディア・コモンズの図を使っています（著作権のないものとされています）。どの府県かを示すためだけに使います。",
    },
    { name: "そのほか", text: "ほかのソフトウェアのライセンスは、公開までに、ここに一覧にします。" },
  ],
};

const en: Help = {
  guideTitle: "How to play",
  guideIntro: "Collect stamps as you walk. There is nothing complicated to learn.",
  steps: [
    { title: "Register", text: "Register with your email, or with your face or fingerprint (a passkey). It takes a few minutes." },
    { title: "Choose a route", text: "Pick the course you want to walk under Routes. The map shows the path and the stamp places." },
    { title: "Press the button when you arrive", text: "At a stamp place, press the button. The app checks where you are and, if you are close enough, gives you the stamp." },
    { title: "See your stamp card", text: "On the Stamps page you can see the stamps you have and how many are left." },
  ],
  guideNote: "Signal can be weak in the mountains. Check the latest official information before you go.",
  faqTitle: "FAQ",
  faqs: [
    {
      question: "My stamps are gone",
      answer:
        "Stamps are saved on your account. If you signed in a different way, it may be a different account (someone who registered with email and someone who registered with only a face or fingerprint have separate accounts). Try signing in the same way as before. If you still cannot find them, tell the contact point the ID (8 digits) shown on the Stamps page. The contact point will be written here before the app is published.",
    },
    {
      question: "I cannot allow location",
      answer: "In your phone's settings, set your browser's location to \"Allow\", then try again. Your location is used only when you press the stamp button.",
    },
    {
      question: "I cannot stamp. It says I am too far from the place",
      answer: "Go closer to the stamp place and try in the open, away from trees and buildings. If the signal or the position is poor, stamping may not work.",
    },
    {
      question: "Can I collect stamps over several days?",
      answer: "Yes. Your stamps are saved on your account, so you can collect them slowly, over as many outings as you like.",
    },
    {
      question: "There is no signal in the mountains",
      answer: "Try again when you reach a place with a good signal. It also helps to look at the route information before you leave.",
    },
    {
      question: "I want to delete my account",
      answer: "On the Stamps page, press \"Edit\" on your profile and you will find \"Delete account\". You can cancel for 3 days after pressing it. After 3 days your account and all your records are erased.",
    },
  ],
  licensesTitle: "Licenses",
  licensesIntro: "This app uses the following.",
  credits: [
    {
      name: "Map",
      text: "Geospatial Information Authority of Japan (GSI Tiles): the standard map, hillshade and relief map.",
      url: "https://maps.gsi.go.jp/development/ichiran.html",
    },
    { name: "Map display", text: "MapLibre GL JS (BSD license)." },
    {
      name: "Prefecture emblems",
      text: "The emblems of Osaka, Nara and Wakayama are the drawings from Wikimedia Commons, which marks them as having no copyright. They are used only to show which prefecture a course is in.",
    },
    { name: "Others", text: "The licenses of other software will be listed here before the app is published." },
  ],
};

export function helpContent(locale: string): Help {
  return locale === "ja" ? ja : en;
}
