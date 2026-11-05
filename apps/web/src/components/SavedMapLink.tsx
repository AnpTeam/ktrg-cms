"use client";

import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { PAGES_CACHE } from "@/lib/offline-pack";

import { buttonStyle } from "@/components/button";
// On the page shown when nothing can load: a way into the map this phone saved (lib/offline-pack.ts), if there is one.
export function SavedMapLink() {
  const { t } = useLingui();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void caches
      .open(PAGES_CACHE)
      .then((c) => c.match("/map"))
      .then((hit) => setSaved(!!hit))
      .catch(() => undefined);
  }, []);
  if (!saved) return null;
  return (
    // A plain link on purpose: the worker answers this page load from the saved copy.
    <a href="/map" className={buttonStyle("secondary", "lg", "inline-flex w-fit")}>
      {t`保存した地図を開く`}
    </a>
  );
}
