"use client";

import { useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import { nextTheme, parseTheme, themeCookieString, type Theme } from "@/lib/theme";
import { AutoThemeIcon, MoonIcon, SunIcon } from "./icons";

// The theme lives in a cookie and on <html data-theme>. This tiny store lets every
// switcher on the page re-render when it changes.
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = (): Theme => parseTheme(document.cookie);

function write(theme: Theme) {
  document.cookie = themeCookieString(theme, window.location.protocol === "https:");
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  listeners.forEach((listener) => listener());
}

/** One button: shows the current choice (Auto, Light or Dark) and cycles on tap. */
export function ThemeSwitcher() {
  const { t } = useLingui();
  // The server cannot know the cookie, so it renders "auto"; the browser then corrects it.
  const theme = useSyncExternalStore(subscribe, read, () => "auto" as Theme);

  const label = theme === "light" ? t`ライト` : theme === "dark" ? t`ダーク` : t`自動`;
  const icon = theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <AutoThemeIcon />;

  return (
    <button
      type="button"
      onClick={() => write(nextTheme(theme))}
      aria-label={t`画面の明るさ：${label}。押すと切り替わります。`}
      className="inline-flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-ink bg-paper px-3.5 text-base font-bold text-ink hover:bg-surface [&>svg]:size-5"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** The three choices as separate joined buttons (Auto | Light | Dark), the chosen one in ink: the menu's version. */
export function ThemeChoice() {
  const { t } = useLingui();
  const theme = useSyncExternalStore(subscribe, read, () => "auto" as Theme);
  const options: { value: Theme; text: string }[] = [
    { value: "auto", text: t`自動` },
    { value: "light", text: t`ライト` },
    { value: "dark", text: t`ダーク` },
  ];
  return (
    <span role="group" aria-label={t`画面の明るさ`} className="flex overflow-hidden rounded-full border border-ink">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={theme === o.value}
          onClick={() => write(o.value)}
          className={`tap-target min-w-0 flex-1 whitespace-nowrap px-0.5 text-base font-bold ${theme === o.value ? "bg-selected text-on-selected" : "bg-paper text-ink hover:bg-surface"}`}
        >
          {o.text}
        </button>
      ))}
    </span>
  );
}
