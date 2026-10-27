"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Tells the site a page was opened, once per page. It sends only the page's address: the server takes the visitor's
 * approximate region from the connection and keeps a count, never the address or anything about the person (see the
 * privacy policy). Nothing is shown, and a failure is ignored.
 */
export function VisitBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    try {
      void fetch("/api/v1/visits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: pathname }), keepalive: true, credentials: "omit" }).catch(() => undefined);
    } catch {
      // counting must never get in the way of the page
    }
  }, [pathname]);
  return null;
}
