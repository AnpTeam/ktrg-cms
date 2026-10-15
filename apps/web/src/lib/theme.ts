// The theme switch: Auto follows the device, Light and Dark are the visitor's own choice.
// The choice lives in a cookie. The server reads it and writes data-theme on <html> itself, so
// the first paint already has the right colours: no script, no flash. Pure functions, unit-tested.

export const themes = ["auto", "light", "dark"] as const;
export type Theme = (typeof themes)[number];

export const themeCookie = "theme";

/** Auto, then Light, then Dark, then back to Auto: one button, three states. */
export function nextTheme(theme: Theme): Theme {
  return themes[(themes.indexOf(theme) + 1) % themes.length] as Theme;
}

/** The theme from one cookie value (what the server reads); anything unknown is Auto. */
export function themeFromValue(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : "auto";
}

/** The saved theme from a cookie header (`document.cookie`); anything unknown is Auto. */
export function parseTheme(cookies: string | null | undefined): Theme {
  const match = (cookies ?? "").match(new RegExp(`(?:^|;\\s*)${themeCookie}=([^;]*)`));
  const value = match?.[1];
  return value === "light" || value === "dark" ? value : "auto";
}

/** The cookie to write. Auto removes it, so the device setting decides again. */
export function themeCookieString(theme: Theme, secure: boolean): string {
  const base = `${themeCookie}=${theme === "auto" ? "" : theme}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
  return theme === "auto" ? `${base}; Max-Age=0` : `${base}; Max-Age=31536000`;
}
