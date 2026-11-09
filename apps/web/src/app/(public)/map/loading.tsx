import { initLingui } from "@/i18n/server";

// The map's own loading screen: a plain grey area where the map will be, plus the `map-screen` marker that globals.css uses
// to lock the page from scrolling. Without it a swipe during the wait scrolled the page, and the map then came up on a page
// that was already shifted (only a reopen put it back).
export default async function MapLoading() {
  const i18n = await initLingui();
  return (
    <>
      <div aria-hidden="true" className="map-screen" />
      <div role="status" aria-live="polite" className="loading-fade fixed inset-0 -z-10 bg-surface motion-safe:animate-pulse">
        <span className="sr-only">{i18n.locale === "ja" ? "読み込み中" : "Loading"}</span>
      </div>
    </>
  );
}
