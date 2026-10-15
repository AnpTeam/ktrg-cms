import type { Locale } from "../auth/user";

/** Emails come in the same languages as the app. */
export type EmailLocale = Locale;

export interface EmailContent {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Everything a template puts into the shared layout. All strings are plain text. */
export interface EmailParts {
  locale: EmailLocale;
  /** Hidden preview line most inboxes show next to the subject. */
  preheader: string;
  heading: string;
  /** Paragraphs before the highlighted block. */
  intro: string[];
  /** Large, monospaced block such as a one-time code. */
  highlight?: string;
  /** Label / value rows, e.g. name and time. */
  details?: { label: string; value: string }[];
  /** Paragraphs after the main content, shown smaller. */
  footnotes: string[];
}

const BRAND = "KTRG";

const footer: Record<EmailLocale, string> = {
  ja: "このメールは送信専用です。返信はできません。",
  en: "This mailbox is not monitored. Please do not reply.",
};

/** Escape for HTML text and attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** User-typed text: flatten it so it cannot add lines to the message, and cap its length. */
export function flattenUserText(value: string | null | undefined, max = 64): string | null {
  return value?.replace(/[\r\n\t\p{Zl}\p{Zp}]+/gu, " ").trim().slice(0, max) || null;
}

/** All times are shown in Japan time, where the trails are. */
export function formatJst(at: Date, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    timeZone: "Asia/Tokyo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(at);
}

export function subjectPrefix(locale: EmailLocale): string {
  return locale === "ja" ? `【${BRAND}】` : `[${BRAND}] `;
}

export function renderText(parts: EmailParts): string {
  const lines: string[] = [parts.heading, "", ...joinParagraphs(parts.intro)];
  if (parts.highlight) lines.push("", `    ${parts.highlight}`);
  if (parts.details?.length) {
    lines.push("", ...parts.details.map(({ label, value }) => `${label}: ${value}`));
  }
  lines.push("", ...joinParagraphs(parts.footnotes), "", "--", BRAND, footer[parts.locale]);
  return lines.join("\n");
}

/** Table-based, inline-styled HTML: the subset that renders in Gmail, Outlook and Apple Mail. */
export function renderHtml(parts: EmailParts): string {
  const e = escapeHtml;
  const font =
    parts.locale === "ja"
      ? "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif"
      : "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const p = (text: string, style = "margin:0 0 16px;font-size:15px;line-height:1.7;color:#1f2937;") =>
    `<p style="${style}">${e(text)}</p>`;

  const highlight = parts.highlight
    ? `<p style="margin:8px 0 24px;padding:16px;background:#f3f4f6;border-radius:8px;text-align:center;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;">${e(parts.highlight)}</p>`
    : "";

  const details = parts.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;font-size:15px;line-height:1.6;color:#1f2937;">${parts.details
        .map(
          ({ label, value }) =>
            `<tr><td style="padding:2px 16px 2px 0;color:#6b7280;white-space:nowrap;vertical-align:top;">${e(label)}</td><td style="padding:2px 0;word-break:break-word;">${e(value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  return `<!doctype html>
<html lang="${parts.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${e(parts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(parts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:${font};">
<tr><td style="padding:24px 32px 0;font-size:13px;font-weight:700;letter-spacing:2px;color:#6b7280;">${BRAND}</td></tr>
<tr><td style="padding:16px 32px 8px;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#111827;">${e(parts.heading)}</h1>
${parts.intro.map((t) => p(t)).join("\n")}
${highlight}
${details}
${parts.footnotes.map((t) => p(t, "margin:0 0 12px;font-size:13px;line-height:1.7;color:#4b5563;")).join("\n")}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#9ca3af;">${e(footer[parts.locale])}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderEmail(to: string, subject: string, parts: EmailParts): EmailContent {
  return { to, subject, text: renderText(parts), html: renderHtml(parts) };
}

function joinParagraphs(paragraphs: string[]): string[] {
  return paragraphs.flatMap((t, i) => (i === 0 ? [t] : ["", t]));
}
