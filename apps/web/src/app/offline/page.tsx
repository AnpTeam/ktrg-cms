import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { SavedMapLink } from "@/components/SavedMapLink";
import { buttonStyle } from "@/components/button";

export const metadata: Metadata = { title: "オフライン / Offline", robots: { index: false } };

// What the service worker shows when a page cannot be loaded at all (no signal). It is kept on the phone, so it says what
// still works in both languages at once (it cannot know the visitor's language offline).
export default async function OfflinePage() {
  await initLingui(); // Trans in a server page needs the language set up first
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-3xl font-bold leading-snug">
        <Trans>いま、通信がつながっていません</Trans>
      </h1>
      <p className="text-xl leading-9">
        <Trans>ページを開けませんでした。電波のある場所で、もう一度お試しください。</Trans>
      </p>
      <p className="text-xl leading-9">
        <Trans>電波がないときに押したスタンプは、この端末に残り、つながると自動で送られます。</Trans>
      </p>
      <p lang="en" className="text-lg leading-8 text-muted">
        No connection right now. The page could not be opened; try again where there is signal. Stamps you pressed with no signal are kept on this phone and sent automatically when you are back online.
      </p>
      <SavedMapLink />
      {/* A plain link on purpose: a full page load is the retry (a client-side navigation would not ask the network again). */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className={buttonStyle("primary", "lg", "inline-flex w-fit")}>
        <Trans>もう一度ひらく</Trans>
      </a>
    </main>
  );
}
