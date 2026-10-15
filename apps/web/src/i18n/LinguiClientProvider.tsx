"use client";

import { useState, type ReactNode } from "react";
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
  const [i18n] = useState(() =>
    setupI18n({ locale: initialLocale, messages: { [initialLocale]: initialMessages } }),
  );
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
