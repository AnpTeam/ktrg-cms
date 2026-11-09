/**
 * The page visitors see for an admin page: the same route, place, page or post, or the list they appear in. Null when the
 * admin page has no page of its own on the site (the dashboard, users, the waypoint list...): then no button is shown.
 */
export function publicPathFor(adminPath: string): string | null {
  const [, , area, id] = adminPath.split("/");
  const one = id && id !== "new" ? id : null;
  switch (area) {
    case "routes":
      return id === "new" ? null : one ? `/routes/${one}` : "/routes";
    case "places":
      return one ? `/spots/${one}` : null;
    case "pages":
      return one === "home" ? "/" : one ? `/${one}` : null;
    case "rallies":
      return id === "new" ? null : one ? `/rallies/${one}` : "/rallies";
    case "posts":
      return id === "new" ? null : one ? `/blog/${one}` : "/blog";
    case "notices":
      return "/notices";
    case "banners":
      return "/";
    default:
      return null;
  }
}
