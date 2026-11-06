import { renderEmail, subjectPrefix, type EmailContent, type EmailLocale } from "./layout";

/**
 * Fresh-login code: the account is already logged in and is about to do something that
 * needs a recent proof it is really them (such as changing someone's role). No link.
 */
export function buildReauthEmail(opts: {
  to: string;
  locale: EmailLocale;
  code: string;
  ttlMinutes: number;
}): EmailContent {
  const { to, locale, code, ttlMinutes } = opts;

  if (locale === "ja") {
    return renderEmail(to, `${subjectPrefix(locale)}本人確認の番号`, {
      locale,
      preheader: `本人確認の番号は ${code} です（${ttlMinutes}分間有効）`,
      heading: "本人確認の番号",
      intro: [
        "重要な操作（アカウントの権限の変更など）を続けるには、ご本人の確認が必要です。",
        "次の番号を入力してください。",
      ],
      highlight: code,
      footnotes: [
        `この番号は${ttlMinutes}分間有効で、1回だけ使えます。`,
        "番号は誰にも教えないでください。スタッフが番号を尋ねることはありません。",
        "心当たりがない場合は、番号を入力しないでください。ログインしたままの端末を誰かが使っている可能性があります。",
      ],
    });
  }

  return renderEmail(to, `${subjectPrefix(locale)}Confirm it's you`, {
    locale,
    preheader: `Your confirmation code is ${code} (valid for ${ttlMinutes} minutes)`,
    heading: "Confirm it's you",
    intro: [
      "You are about to make an important change, such as changing an account's role.",
      "Enter this code to confirm it's you.",
    ],
    highlight: code,
    footnotes: [
      `The code is valid for ${ttlMinutes} minutes and can be used once.`,
      "Never share this code. Our staff will never ask you for it.",
      "If this was not you, do not enter the code: someone may be using a device where you are still signed in.",
    ],
  });
}
