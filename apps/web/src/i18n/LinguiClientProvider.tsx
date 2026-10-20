"use client";

import { useMemo, type ReactNode } from "react";
import { setupI18n, type Messages } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

// An I18n instance cannot be serialized to the browser, so the client gets the
// active locale and its messages and builds its own.
export function LinguiClientProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: ReactNode;
  initialLocale: string;
  initialMessages: Messages;
}) {
  // Rebuilt when the language changes (the switcher refreshes the page in place).
  const i18n = useMemo(
    () => setupI18n({ locale: initialLocale, messages: { [initialLocale]: initialMessages } }),
    [initialLocale, initialMessages],
  );
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
