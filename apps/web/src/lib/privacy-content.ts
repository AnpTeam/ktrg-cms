// The privacy policy text, in both languages. It is a DRAFT written from what the app actually does (CLAUDE.md,
// "Privacy" and the data model). It has to be read by whoever handles legal matters before launch: the operator,
// the contact and the way to ask for deletion are not decided yet and are marked as such, never invented.
// Keep it true: when the app starts collecting or sharing something new, change this text in the same change.

export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  /** A list of "term: explanation" rows. */
  items?: { term: string; text: string }[];
}

export interface Policy {
  title: string;
  /** Shown at the top while the text is still a draft. */
  draftNotice: string;
  updated: string;
  sections: PolicySection[];
}

const ja: Policy = {
  title: "プライバシーポリシー",
  draftNotice: "この文章は案です。公開の前に、内容を確認します。",
  updated: "2026年10月27日（案）",
  sections: [
    {
      heading: "このページについて",
      paragraphs: [
        "このアプリ（葛城修験のスタンプラリー）で、どんな情報を、何のために使うかをまとめています。登録のときの質問は、答えたくないものは飛ばせます。",
      ],
    },
    {
      heading: "運営者・お問い合わせ",
      paragraphs: ["運営者の名前と連絡先は、公開までにここに書きます。"],
    },
    {
      heading: "集める情報と使いみち",
      items: [
        { term: "メールアドレス", text: "メールでログインする方だけです。ログイン用の番号を送るために使います。" },
        { term: "パスキー", text: "パスキーで登録した方の、公開用の鍵だけを保存します。顔や指紋のデータは、お使いの端末の外に出ません。" },
        { term: "お名前", text: "アプリの中で表示します。ニックネームでかまいません。" },
        {
          term: "どちらからお越しか、年代、性別",
          text: "どれも任意で、答えなくてもアプリは使えます。「答えたくない」も選べます。どんな方がこのアプリを使っているかを知るためだけに使い、個人が分からない形でまとめます。",
        },
        { term: "言語・見やすさの設定", text: "表示をあなたに合わせるために保存します。" },
        { term: "スタンプの記録", text: "どの場所で、いつ、どの方法でスタンプを押したかを保存します。スタンプカードを表示するために使います。" },
      ],
    },
    {
      heading: "位置情報",
      paragraphs: [
        "位置情報は、スタンプを押すときに使い、その場所の近くにいるかを確かめます。送られた位置そのものは保存しません。保存するのは、スタンプの記録だけです。",
        "道案内を使うと、コースから外れている間、数十秒おきにあなたの位置を、道順を描くための外部サービス（OpenRouteService）へ送ります。保存はせず、道順を描いたらすぐに捨てます。",
        "電波がつながらないときは、押したスタンプを端末の中に一時的にしまい、つながってから送ります。送り終わったら、端末から消します。",
        "アプリが、あなたの動きを続けて記録することはありません。",
      ],
    },
    {
      heading: "どちらの地域からのアクセスか",
      paragraphs: [
        "ページが開かれるたびに、接続元から分かるおおよその地域（国・都道府県・市や町）と、開かれたページを数えます。どの地域の方がこのプロジェクトに関心を持っているかを知り、広報や運営に生かすためです。",
        "IPアドレスそのものは、保存も記録もしません。保存するのは「日ごと・地域ごと・ページごとの回数」だけで、あなたのアカウントやスタンプとは結びつけず、個人を特定できる形では扱いません。地域は接続元から推定するため、実際にいる場所と違うことがあります。",
        "ブラウザで「トラッキングしない（Do Not Track）」や「Global Privacy Control」を有効にしている場合は、開かれた回数だけを数え、地域は一切調べません。人数が少ない市や町は、名前を出さず合計だけにして、集計を見る人にも個人が分からないようにしています。",
      ],
    },
    {
      heading: "Cookieなどの保存",
      paragraphs: [
        "ログインを保つため、言語や見やすさの設定を覚えておくために、お使いの端末に小さな情報（Cookie）を保存します。広告や、行動を追いかけるためのものは使いません。",
      ],
    },
    {
      heading: "外部のサービス",
      items: [
        { term: "地図", text: "地図を表示すると、国土地理院の地図データを読み込むため、お使いの端末の通信先情報（IPアドレスなど）がそこに伝わります。" },
        { term: "動画", text: "動画は、再生ボタンを押したときだけ、YouTubeまたはVimeoから読み込みます。" },
        { term: "道案内", text: "道案内の間、位置をOpenRouteServiceへ送って道順を描きます。位置は保存しません。" },
        { term: "利用状況の集計", text: "このアプリの運営に使っているホスティング事業者（Vercel）の集計機能と、上の「どちらの地域からのアクセスか」の集計で、ページの閲覧数などを個人が分からない形で数えます。Cookieは使いません。" },
        { term: "メールの送信", text: "ログイン用の番号は、メール配信を行う事業者を通して送ります。事業者名は公開までに書きます。" },
      ],
    },
    {
      heading: "ほかの人への提供",
      paragraphs: [
        "法令に基づく場合を除き、あなたの同意なしに、個人が分かる情報をほかの人に渡しません。個人が分からない形の集計は、アプリの改善や、主催者への報告に使うことがあります。",
      ],
    },
    {
      heading: "見る・直す・消す",
      paragraphs: [
        "お名前、どちらからお越しか、年代、性別は、スタンプのページから、いつでも変えられます。",
        "アカウントと記録の削除を求めることもできます。その方法は、公開までにここに書きます。",
      ],
    },
    {
      heading: "この文章を変えるとき",
      paragraphs: ["内容を変えるときは、このページでお知らせします。"],
    },
  ],
};

const en: Policy = {
  title: "Privacy policy",
  draftNotice: "This text is a draft. It will be checked before the app is published.",
  updated: "October 27, 2026 (draft)",
  sections: [
    {
      heading: "About this page",
      paragraphs: [
        "This page explains what information this app (the Katsuragi Shugen stamp rally) uses, and why. You can skip any question you would rather not answer when you register.",
      ],
    },
    {
      heading: "Operator and contact",
      paragraphs: ["The operator's name and contact details will be written here before the app is published."],
    },
    {
      heading: "What we collect and why",
      items: [
        { term: "Email address", text: "Only if you sign in by email. It is used to send you the sign-in code." },
        {
          term: "Passkey",
          text: "If you register with a passkey, we store only its public key. Your face or fingerprint data never leaves your device.",
        },
        { term: "Name", text: "Shown inside the app. A nickname is fine." },
        {
          term: "Where you come from, age range, gender",
          text: "All optional: the app works without them, and \"Prefer not to say\" is a choice. We use them only to understand who uses the app, and we put them together in a form that does not identify anyone.",
        },
        { term: "Language and display settings", text: "Saved so the app looks the way you want." },
        { term: "Stamp records", text: "Which place you stamped, when, and how. Used to show your stamp card." },
      ],
    },
    {
      heading: "Location",
      paragraphs: [
        "Your location is used when you press the stamp button, to check that you are near the place. The position itself is not saved. Only the stamp record is.",
        "When you use navigation and you are off the course line, your position is sent about every 30 seconds to an outside service (OpenRouteService) to draw a path. We do not store it, and it is dropped once the path is drawn.",
        "With no signal, the stamp is kept briefly on your device and sent when you are connected again. It is removed from your device once it has been sent.",
        "The app never records your movements continuously.",
      ],
    },
    {
      heading: "Which regions visits come from",
      paragraphs: [
        "Each time a page is opened, we count the approximate region the connection appears to come from (country, prefecture or state, and city or town) together with the page that was opened. We do this to learn which regions are interested in the project, and to use that for outreach and planning.",
        "We do not store or log the IP address itself. What we keep is only a count per day, per region and per page. It is not linked to your account or your stamps, and it is not handled in a way that identifies you. The region is estimated from the connection, so it can differ from where you really are.",
        "If your browser has \"Do Not Track\" or \"Global Privacy Control\" turned on, we only count that a page was opened and do not look up any region at all. Cities and towns with only a few visits are shown as a total without their name, so that nobody reading the totals can pick out a person.",
      ],
    },
    {
      heading: "Cookies and similar storage",
      paragraphs: [
        "We save small pieces of information (cookies) on your device to keep you signed in and to remember your language and display settings. We do not use advertising or tracking.",
      ],
    },
    {
      heading: "Outside services",
      items: [
        {
          term: "Map",
          text: "Showing the map loads map data from the Geospatial Information Authority of Japan, so your device's connection details (such as its IP address) reach that service.",
        },
        { term: "Video", text: "Videos load from YouTube or Vimeo only when you press play." },
        { term: "Navigation", text: "While you navigate, your position is sent to OpenRouteService to draw a path. It is not stored." },
        { term: "Usage counts", text: "The hosting provider's analytics (Vercel) and our own regional count described above tally page views and similar events in a form that does not identify anyone. Neither uses cookies." },
        {
          term: "Sending email",
          text: "Sign-in codes are sent through an email delivery company. Its name will be written here before the app is published.",
        },
      ],
    },
    {
      heading: "Sharing with others",
      paragraphs: [
        "Except where the law requires it, we do not give information that identifies you to anyone without your consent. We may use totals that identify no one to improve the app and to report to the organizers.",
      ],
    },
    {
      heading: "Viewing, correcting and deleting",
      paragraphs: [
        "You can change your name, where you come from, age range and gender at any time from the Stamps page.",
        "You can also ask for your account and records to be deleted. How to ask will be written here before the app is published.",
      ],
    },
    {
      heading: "Changes to this text",
      paragraphs: ["If we change it, we will say so on this page."],
    },
  ],
};

export function privacyPolicy(locale: string): Policy {
  return locale === "ja" ? ja : en;
}
