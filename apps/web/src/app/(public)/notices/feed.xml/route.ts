import { noticeFeed } from "@/lib/notice-feed";
import { listNotices } from "@/lib/notices";
import { siteOrigin } from "@/lib/site";

// The notices as an Atom feed (?route=<id> keeps one route's; ?lang=en for English). Public, like the notices themselves.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const xml = noticeFeed(await listNotices(), { site: siteOrigin(), locale: searchParams.get("lang") === "en" ? "en" : "ja", routeId: searchParams.get("route") });
  return new Response(xml, { headers: { "content-type": "application/atom+xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}
