import { formatJst, renderEmail, subjectPrefix, type EmailContent, type EmailLocale } from "./layout";

/**
 * Sent when the account owner asks for their account to be deleted (DELETE /me), so a
 * request made from a stolen or forgotten session gets noticed while it can still be
 * cancelled. No link: the owner should go to the site themselves.
 */
export function buildDeletionRequestEmail(opts: { to: string; locale: EmailLocale; at: Date; deleteOn: Date }): EmailContent {
  const { to, locale, at, deleteOn } = opts;
  const when = `${formatJst(at, locale)} (JST)`;
  const due = `${formatJst(deleteOn, locale)} (JST)`;

  if (locale === "ja") {
    const heading = "アカウント削除のリクエストを受け付けました";
    return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
      locale,
      preheader: "アカウントと、集めたスタンプなどのデータが削除されます。",
      heading,
      intro: [
        "あなたのアカウントの削除リクエストを受け付けました。アカウントと、集めたスタンプやパスキーなどのデータは、3日後にすべて削除されます。それまでは取り消せます。",
      ],
      details: [
        { label: "日時", value: when },
        { label: "削除される日時", value: due },
      ],
      footnotes: [
        "削除されるまでは取り消せます。KTRGにログインし、設定から削除リクエストを取り消してください。",
        "心当たりがない場合は、すぐにKTRGにログインして削除リクエストを取り消し、パスキーを確認してください。",
      ],
    });
  }

  const heading = "We received your request to delete your account";
  return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
    locale,
    preheader: "Your account and its data, such as your stamps, will be deleted.",
    heading,
    intro: [
      "We received a request to delete your account. Your account and all its data, such as your stamps and passkeys, will be deleted in 3 days. Until then you can cancel.",
    ],
    details: [
      { label: "When", value: when },
      { label: "Deleted on", value: due },
    ],
    footnotes: [
      "Until then you can change your mind: sign in to KTRG and cancel the request in your settings.",
      "If this was not you, sign in to KTRG right away, cancel the request and review your passkeys.",
    ],
  });
}
