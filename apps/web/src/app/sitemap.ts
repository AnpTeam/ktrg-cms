import type { MetadataRoute } from "next";
import { listPlaces, listRoutes } from "@/lib/content";
import { listPosts } from "@/lib/posts";
import { siteOrigin } from "@/lib/site";

// The pages a search engine may list: the home page, the routes, and the help and legal pages.
// One address per page: the language follows the visitor, not the address.
// Pages for one person (stamps, profile, login, settings) are left out.
const PAGES = ["", "/map", "/routes", "/blog", "/places", "/notices", "/sitemap", "/guide", "/faq", "/licenses", "/terms", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const [routes, posts, places] = await Promise.all([listRoutes(), listPosts(), listPlaces()]);
  const paths = [
    ...PAGES,
    ...routes.filter((r) => r.status === "ready").map((r) => `/routes/${r.id}`),
    ...posts.map((p) => `/blog/${p.id}`),
    ...places.filter((p) => p.status !== "gone").map((p) => `/places/${p.id}`),
  ];
  return paths.map((path) => ({ url: `${origin}${path}` }));
}
