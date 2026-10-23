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

/** The day in Japan time as YYYY-MM-DD, for `formatDay`. */
export const japanDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(iso));

/** A full date and time in Japan time, for example "2026年10月23日 14:30" or "Oct 23, 2026, 14:30". */
export function formatDayTime(locale: string, iso: string): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return `${formatDay(locale, japanDay(iso))}${locale === "ja" ? NBSP : `,${NBSP}`}${time}`;
}

/**
 * A calendar day (YYYY-MM-DD) as people say it: "2026年10月16日" or "Oct 16, 2026". It is a plain date with
 * no time zone, so it is built from its parts and never shifted.
 */
export function formatDay(locale: string, day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const [year, month, date] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return locale === "ja" ? `${year}年${month}月${date}日` : `${monthsEn[month - 1]} ${date}, ${year}`;
}
