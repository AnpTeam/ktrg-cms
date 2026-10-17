import type { MetadataRoute } from "next";
import { locales } from "@/i18n/locales";
import { siteOrigin } from "@/lib/site";

// Everything may be read except what is only for one person (login, register, settings, the set-up screens)
// and the API.
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  const private_ = ["login", "register", "welcome", "settings", "stamps"].flatMap((p) => locales.map((l) => `/${l}/${p}`));
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", ...private_] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
