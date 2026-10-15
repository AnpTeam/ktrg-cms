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
    const heading = added ? "パスキーが追加されました" : "パスキーが削除されました";
    return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
      locale,
      preheader: added ? "アカウントに新しいパスキーが追加されました。" : "アカウントからパスキーが削除されました。",
      heading,
      intro: [added ? "アカウントにパスキーが追加されました。" : "アカウントからパスキーが削除されました。"],
      details: [...(label ? [{ label: "名前", value: label }] : []), { label: "日時", value: when }],
      footnotes: [
        "ご自身の操作であれば、対応は不要です。",
        "心当たりがない場合は、すぐにKTRGにログインしてパスキーを確認し、不審なものを削除してください。",
      ],
    });
  }

  const heading = added ? "A passkey was added to your account" : "A passkey was removed from your account";
  return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
    locale,
    preheader: added ? "A new passkey can now sign in to your account." : "A passkey can no longer sign in to your account.",
    heading,
    intro: [`${heading}.`],
    details: [...(label ? [{ label: "Name", value: label }] : []), { label: "When", value: when }],
    footnotes: [
      "If this was you, there is nothing more to do.",
      "If this was not you, sign in to KTRG right away, review your passkeys and remove any you do not recognise.",
    ],
  });
}
