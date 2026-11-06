import { pickText } from "./pick-text";
import type { TrailNotice } from "./notices";
import { isWebUrl } from "./format";

// The trail notices as an Atom feed, so people can follow closures in a feed reader. Pure; the route handler gives it the
// notices, the site address and the language.

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** `routeId`: only the notices about that route (and the ones for the whole trail). */
export function noticeFeed(notices: readonly TrailNotice[], opts: { site: string; locale: string; routeId?: string | null; now?: Date }): string {
  const list = notices.filter((n) => !opts.routeId || n.routeId === null || n.routeId === opts.routeId);
  const title = opts.locale === "en" ? "Katsuragi Shugen trail notices" : "葛城修験 お知らせ";
  const self = `${opts.site}/notices/feed.xml${opts.routeId ? `?route=${encodeURIComponent(opts.routeId)}` : ""}`;
  // A notice is dated by the day a person last checked it, at the start of that day in Japan.
  const at = (day: string) => `${day}T00:00:00+09:00`;
  const updated = list[0] ? at(list[0].verifiedOn) : (opts.now ?? new Date()).toISOString();
  const entries = list
    .map((n) => {
      const heading = pickText(opts.locale, n.titleJa, n.titleEn)?.text ?? n.titleJa;
      const body = pickText(opts.locale, n.bodyJa, n.bodyEn)?.text ?? n.bodyJa;
      return `  <entry>
    <id>${escapeXml(`${opts.site}/notices/${n.id}`)}</id>
    <title>${escapeXml(heading)}</title>
    <updated>${at(n.verifiedOn)}</updated>
    <summary>${escapeXml(body)}</summary>${isWebUrl(n.sourceUrl) ? `\n    <link rel="related" href="${escapeXml(n.sourceUrl)}"/>` : ""}
  </entry>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(self)}</id>
  <title>${escapeXml(title)}</title>
  <updated>${updated}</updated>
  <link rel="self" href="${escapeXml(self)}"/>
${entries}
</feed>
`;
}
