import { initLingui } from "@/i18n/server";

// Shown by Next.js while a page is being fetched: grey blocks in the shape of a page (a heading, a few lines, two cards), so
// the wait looks like the page arriving, not like a stop. The header and the tab bar stay where they are. It appears after a
// short wait (.loading-fade), so a quick page change does not flash it. A screen reader hears 「読み込み中」 once.
export default async function Loading() {
  const i18n = await initLingui();
  const label = i18n.locale === "ja" ? "読み込み中" : "Loading";
  const block = "rounded bg-line/40 motion-safe:animate-pulse";

  return (
    <div role="status" aria-live="polite" className="loading-fade page-narrow flex flex-col gap-6 px-4 pt-2 wide:px-0">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className={`${block} h-6 w-24`} />
        <div className={`${block} h-10 w-3/4`} />
        <div className="flex flex-col gap-3">
          <div className={`${block} h-5 w-full`} />
          <div className={`${block} h-5 w-full`} />
          <div className={`${block} h-5 w-2/3`} />
        </div>
        <div className={`${block} h-40 w-full rounded-lg`} />
        <div className={`${block} h-40 w-full rounded-lg`} />
      </div>
    </div>
  );
}
