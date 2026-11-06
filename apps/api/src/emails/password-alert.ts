import { formatJst, renderEmail, subjectPrefix, type EmailContent, type EmailLocale } from "./layout";

export type PasswordAlertAction = "set" | "changed" | "removed";

/** Sent whenever the password changes. Set or changed: it carries the link that undoes it, for when it was not the owner. */
export function buildPasswordAlertEmail(opts: { to: string; locale: EmailLocale; action: PasswordAlertAction; at: Date; undoUrl?: string }): EmailContent {
  const { to, locale, action, at, undoUrl } = opts;
  const when = `${formatJst(at, locale)} (JST)`;

  if (locale === "ja") {
    const heading = { set: "パスワードが設定されました", changed: "パスワードが変更されました", removed: "パスワードが削除されました" }[action];
    return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
      locale,
      preheader: heading,
      heading,
      intro: [`${heading}。`],
      details: [{ label: "日時", value: when }],
      link: undoUrl ? { label: "自分の操作ではありません", href: undoUrl } : undefined,
      footnotes: [
        "ご自身の操作であれば、対応は不要です。",
        undoUrl
          ? "心当たりがない場合は、上のボタンを押してください。パスワードを消して、すべての端末からログアウトします。このボタンは7日間使えます。"
          : "心当たりがない場合は、メールの番号でログインして、ログインの方法を確認してください。",
      ],
    });
  }

  const heading = { set: "A password was set on your account", changed: "Your password was changed", removed: "Your password was removed" }[action];
  return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
    locale,
    preheader: heading,
    heading,
    intro: [`${heading}.`],
    details: [{ label: "When", value: when }],
    link: undoUrl ? { label: "This was not me", href: undoUrl } : undefined,
    footnotes: [
      "If this was you, there is nothing to do.",
      undoUrl
        ? "If this was not you, press the button above. It removes the password and logs out every device. It works for 7 days."
        : "If this was not you, log in with an emailed number and check your ways to log in.",
    ],
  });
}
