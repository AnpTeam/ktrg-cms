import { defineConfig } from "@lingui/cli";
import { defaultLocale, locales } from "./src/i18n/locales";

export default defineConfig({
  locales: [...locales],
  // Japanese is the source language; untranslated English falls back to it.
  sourceLocale: defaultLocale,
  fallbackLocales: { default: defaultLocale },
  catalogs: [{ path: "src/locales/{locale}", include: ["src/"] }],
});
