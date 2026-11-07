import { formatJst, renderEmail, subjectPrefix, type EmailContent, type EmailLocale } from "./layout";

/**
 * Sent when an admin asks for an account to be deleted, a week ahead, so its owner can appeal. No link, as in every account
 * email: the owner goes to the site themselves, and the appeal is written on their profile page.
 */
export function buildAdminDeletionEmail(opts: { to: string; locale: EmailLocale; at: Date; deleteOn: Date }): EmailContent {
  const { to, locale, at, deleteOn } = opts;
  const when = `${formatJst(at, locale)} (JST)`;
  const due = `${formatJst(deleteOn, locale)} (JST)`;

  if (locale === "ja") {
    const heading = "管理者が、アカウントの削除を予約しました";
    return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
      locale,
      preheader: "7日後に、アカウントと、集めたスタンプなどのデータが削除されます。",
      heading,
      intro: [
        "管理者が、あなたのアカウントの削除を予約しました。7日後に、アカウントと、集めたスタンプなどのデータが削除されます。",
        "異議がある場合は、期限までにサイトへログインし、プロフィールの画面から理由を送ってください。管理者が確認します。",
      ],
      details: [
        { label: "日時", value: when },
        { label: "削除される日時", value: due },
      ],
      footnotes: ["この操作に心当たりがなくても、期限までに異議を送らないと削除されます。"],
    });
  }

  const heading = "An administrator has scheduled your account for deletion";
  return renderEmail(to, `${subjectPrefix(locale)}${heading}`, {
    locale,
    preheader: "Your account and its data, such as your stamps, will be deleted in 7 days.",
    heading,
    intro: [
      "An administrator has scheduled your account for deletion. Your account and its data, such as the stamps you collected, will be deleted in 7 days.",
      "If you disagree, sign in to the site before then and send your reason from your profile page. An administrator will read it.",
    ],
    details: [
      { label: "Time", value: when },
      { label: "Deletion date", value: due },
    ],
    footnotes: ["If you send nothing before then, the deletion goes ahead."],
  });
}
