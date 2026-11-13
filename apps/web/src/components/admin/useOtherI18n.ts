"use client";

import { useEffect, useState } from "react";
import { setupI18n, type I18n } from "@lingui/core";

/**
 * The app's own words in the other language of the two (loaded the first time that language is asked for), so an editor
 * working in one language can see the originals of the other. `null` for the admin's own language or while loading.
 */
export function useOtherI18n(adminLang: "ja" | "en", want: "ja" | "en" | null): I18n | null {
  const [i18n, setI18n] = useState<I18n | null>(null);
  const other = want !== null && want !== adminLang;
  useEffect(() => {
    if (!other || i18n) return;
    let live = true;
    void import(`../../locales/${want}.po`).then(({ messages }) => {
      if (live) setI18n(setupI18n({ locale: want, messages: { [want]: messages } }));
    });
    return () => {
      live = false;
    };
  }, [other, want, i18n]);
  return other ? i18n : null;
}
