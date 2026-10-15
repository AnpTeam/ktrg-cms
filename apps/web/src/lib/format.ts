// A non-breaking space: date and time never split across two lines.
const NBSP = String.fromCharCode(160);
const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A status timestamp in Japan time (CLAUDE.md: dates are shown in Asia/Tokyo),
 * for example "10月15日 14:30" or "Oct 15, 14:30". Built from parts rather than a
 * locale pattern, so it does not change with the ICU data of the runtime.
 */
export function formatUpdated(locale: string, iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const month = Number(get("month"));
  const time = `${get("hour")}:${get("minute")}`;
  return locale === "ja" ? `${month}月${get("day")}日${NBSP}${time}` : `${monthsEn[month - 1]} ${get("day")},${NBSP}${time}`;
}
