import { renderEmail, subjectPrefix, type EmailContent, type EmailLocale } from "./layout";

/** The one-time login code. It carries no link: the code is typed on the page that asked for it. */
export function buildOtpEmail(opts: {
  to: string;
  locale: EmailLocale;
  code: string;
  ttlMinutes: number;
}): EmailContent {
  const { to, locale, code, ttlMinutes } = opts;

  if (locale === "ja") {
    return renderEmail(to, `${subjectPrefix(locale)}確認コード`, {
      locale,
      preheader: `確認コードは ${code} です（${ttlMinutes}分間有効）`,
      heading: "確認コード",
      intro: ["KTRGにログインするには、次のコードを入力してください。"],
      highlight: code,
      footnotes: [
        `このコードは${ttlMinutes}分間有効で、1回だけ使えます。`,
        "コードは誰にも教えないでください。KTRGのスタッフがコードを尋ねることはありません。",
        "心当たりがない場合は、このメールを無視してください。アカウントは変更されません。",
      ],
    });
  }

  return renderEmail(to, `${subjectPrefix(locale)}Your verification code`, {
    locale,
    preheader: `Your code is ${code} (valid for ${ttlMinutes} minutes)`,
    heading: "Your verification code",
    intro: ["Enter this code to sign in to KTRG."],
    highlight: code,
    footnotes: [
      `The code is valid for ${ttlMinutes} minutes and can be used once.`,
      "Never share this code. KTRG staff will never ask you for it.",
      "If you did not request it, you can ignore this email. Nothing on your account has changed.",
    ],
  });
}
