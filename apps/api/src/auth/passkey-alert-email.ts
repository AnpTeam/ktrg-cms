export type PasskeyAlertAction = "added" | "removed";

/**
 * Security alert sent when a passkey is added to or removed from an account, so a
 * stolen session quietly changing passkeys gets noticed. Plain placeholder wording
 * per language until the proper templates (WBS 2.1.2) land. The text carries no
 * link: the owner should go to the site themselves.
 */
export function buildPasskeyAlertEmail(opts: {
  to: string;
  locale: "ja" | "en";
  action: PasskeyAlertAction;
  label: string | null;
  at: Date;
}): { to: string; subject: string; text: string } {
  // The label is user-typed: flatten it so it cannot add lines to the message.
  const label = opts.label?.replace(/[\r\n\t]+/g, " ").trim().slice(0, 64) || null;
  const added = opts.action === "added";

  if (opts.locale === "ja") {
    const when = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(opts.at);
    return {
      to: opts.to,
      subject: added ? "【KTRG】パスキーが追加されました" : "【KTRG】パスキーが削除されました",
      text: [
        added ? "アカウントにパスキーが追加されました。" : "アカウントからパスキーが削除されました。",
        label ? `名前: ${label}` : null,
        `日時: ${when} (JST)`,
        "",
        "心当たりがない場合は、すぐにKTRGにログインしてパスキーを確認し、不審なものを削除してください。",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    };
  }

  const when = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(opts.at);
  return {
    to: opts.to,
    subject: added ? "[KTRG] A passkey was added to your account" : "[KTRG] A passkey was removed from your account",
    text: [
      added ? "A passkey was added to your account." : "A passkey was removed from your account.",
      label ? `Name: ${label}` : null,
      `When: ${when} (JST)`,
      "",
      "If this was not you, sign in to KTRG right away, review your passkeys and remove any you do not recognise.",
    ]
      .filter((line) => line !== null)
      .join("\n"),
  };
}
