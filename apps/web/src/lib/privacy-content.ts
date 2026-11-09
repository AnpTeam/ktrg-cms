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
  updated: "2026年11月6日（案）",
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
        { term: "パスワード", text: "決めた方だけです。元に戻せない形に変えたものだけを保存し、パスワードそのものは保存しません。" },
        { term: "お名前", text: "アプリの中で表示します。ニックネームでかまいません。" },
        {
          term: "どちらからお越しか、年代、性別",
          text: "どれも任意で、答えなくてもアプリは使えます。「答えたくない」も選べます。どんな方がこのアプリを使っているかを知るために、個人が分からない形でまとめます。年代が70代以上の方は、ナビの音声案内が最初からオンになります（ナビの画面で、いつでも変えられます）。ほかの目的には使いません。",
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
        "プロフィールで「どちらからお越しですか」に答えていなくても、この集計では、接続元からおおよその市や町までが分かります。分かるのは市や町までです。このアプリがIPアドレスを読み取ったり保存したりすることはありません（地域は、ホスティング事業者が付ける情報から読み取ります）。",
        "IPアドレスそのものは、保存も記録もしません。保存するのは「日ごと・地域ごと・ページごとの回数」だけで、あなたのアカウントやスタンプとは結びつけず、個人を特定できる形では扱いません。地域は接続元から推定するため、実際にいる場所と違うことがあります。",
        "ブラウザで「トラッキングしない（Do Not Track）」や「Global Privacy Control」を有効にしている場合は、開かれた回数だけを数え、地域は一切調べません。人数が少ない市や町は、名前を出さず合計だけにして、集計を見る人にも個人が分からないようにしています。",
      ],
    },
    {
      heading: "アカウントの制限と、確認が必要なスタンプ",
      paragraphs: [
        "ほかの方に迷惑がかかる使い方や、スタンプの不正が疑われるときは、運営者がアカウントを制限することがあります。制限されたアカウントは、見ることはできますが、スタンプを押すなどの参加はできません。期限を決めることも、解除するまでとすることもできます。",
        "そのために、制限した日時、期限、運営者が書いた理由のメモを保存します。メモは管理者だけが見られ、ほかの利用者には見えません。制限を解除するか、アカウントを削除すると、この三つは消えます。制限をしたことそのものは、管理者用の変更の記録に残ります。",
        "不正が疑われるスタンプは、自動では止めません。運営者が確認できるように印をつけ、確認のうえで取り消すことがあります。印を見られるのは管理者だけです。",
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
  updated: "November 6, 2026 (draft)",
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
        { term: "Password", text: "Only if you choose to set one. We keep it only in a scrambled form that cannot be turned back, never the password itself." },
        { term: "Name", text: "Shown inside the app. A nickname is fine." },
        {
          term: "Where you come from, age range, gender",
          text: "All optional: the app works without them, and \"Prefer not to say\" is a choice. We put them together, in a form that does not identify anyone, to understand who uses the app. If your age range is 70 or over, voice guidance starts on (you can change it on the navigation screen at any time). We use them for nothing else.",
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
        "Even if you have not told us where you come from in your profile, this count still shows roughly which city or town a visit comes from. It never goes finer than the city or town. The app never reads or stores your IP address (the region comes from information the hosting provider adds).",
        "We do not store or log the IP address itself. What we keep is only a count per day, per region and per page. It is not linked to your account or your stamps, and it is not handled in a way that identifies you. The region is estimated from the connection, so it can differ from where you really are.",
        "If your browser has \"Do Not Track\" or \"Global Privacy Control\" turned on, we only count that a page was opened and do not look up any region at all. Cities and towns with only a few visits are shown as a total without their name, so that nobody reading the totals can pick out a person.",
      ],
    },
    {
      heading: "Account restrictions and stamps to review",
      paragraphs: [
        "If an account is used in a way that troubles others, or a stamp looks dishonest, the operator may restrict the account. A restricted account can look around but cannot take part, for example by stamping. The restriction can have an end date or last until it is lifted.",
        "For this we store when the restriction began, its end date, and a short note the operator wrote as the reason. Only administrators can see the note. Other users cannot. When the restriction is lifted, or the account is deleted, these three are erased. The fact that a restriction was made stays in the administrators' change log.",
        "A stamp that looks dishonest is not stopped automatically. It is marked so the operator can review it, and the operator may cancel it after checking. Only administrators can see the mark.",
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
