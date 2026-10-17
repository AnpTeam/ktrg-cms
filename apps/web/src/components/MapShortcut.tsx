"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { MapIcon } from "./icons";

// How far down the page (in px) the visitor must have scrolled before the shortcut slides in.
const SHOW_AFTER = 700;

/**
 * "See the map": a button that slides in from the left once the visitor has scrolled well down the home page, so
 * they need not scroll all the way back up to reach the map. It floats above the tab bar, on a phone only (a wide
 * screen has the Map item in the side rail all the time), and slides away again near the top, where the page's own
 * buttons are. It is out of the tab order while hidden.
 */
export function MapShortcut({ href }: { href: string }) {
  const { t } = useLingui();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Link
      href={href}
      data-shown={shown}
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      className="map-shortcut tap-target fixed bottom-24 left-3 z-10 inline-flex items-center gap-2 rounded-full bg-ink px-5 text-lg font-bold text-paper shadow-lg md:hidden [&>svg]:size-6"
    >
      <MapIcon />
      {t`地図を見る`}
    </Link>
  );
}
