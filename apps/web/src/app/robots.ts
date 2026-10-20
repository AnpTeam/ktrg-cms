import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

// Everything may be read except what is only for one person (login, register, settings, the set-up screens)
// the admin area and the API.
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  const private_ = ["login", "register", "welcome", "settings", "stamps", "admin"].map((p) => `/${p}`);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", ...private_] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
