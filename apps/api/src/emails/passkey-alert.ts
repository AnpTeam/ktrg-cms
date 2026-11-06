import {
  flattenUserText,
  formatJst,
  renderEmail,
  subjectPrefix,
  type EmailContent,
  type EmailLocale,
} from "./layout";

export type PasskeyAlertAction = "added" | "removed";

/**
 * Security alert sent when a passkey is added to or removed from an account, so a
 * stolen session quietly changing passkeys gets noticed. It carries no link: the
 * owner should go to the site themselves.
 */
export function buildPasskeyAlertEmail(opts: {
  to: string;
  locale: EmailLocale;
  action: PasskeyAlertAction;
  label: string | null;
  at: Date;
}): EmailContent {
  const { to, locale, action, at } = opts;
  const label = flattenUserText(opts.label);
  const when = `${formatJst(at, locale)} (JST)`;
  const added = action === "added";

  if (locale === "ja") {
    const heading = added ? "顔・指紋のログインが追加されました" : "顔・指紋のログインが削除されました";
    return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
      locale,
      preheader: added ? "アカウントに新しい顔・指紋のログインが追加されました。" : "アカウントから顔・指紋のログインが削除されました。",
      heading,
      intro: [added ? "アカウントに顔・指紋のログインが追加されました。" : "アカウントから顔・指紋のログインが削除されました。"],
      details: [...(label ? [{ label: "名前", value: label }] : []), { label: "日時", value: when }],
      footnotes: [
        "ご自身の操作であれば、対応は不要です。",
        "心当たりがない場合は、すぐに葛城修験にログインしてログインの方法を確認し、不審なものを削除してください。",
      ],
    });
  }

  const heading = added ? "A face or fingerprint login was added to your account" : "A face or fingerprint login was removed from your account";
  return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
    locale,
    preheader: added ? "A new face or fingerprint login can now open your account." : "A face or fingerprint login can no longer open your account.",
    heading,
    intro: [`${heading}.`],
    details: [...(label ? [{ label: "Name", value: label }] : []), { label: "When", value: when }],
    footnotes: [
      "If this was you, there is nothing more to do.",
      "If this was not you, sign in to Katsuragi Shugen right away, review your ways to log in and remove any you do not recognise.",
    ],
  });
}
