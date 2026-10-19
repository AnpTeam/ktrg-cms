import { KatsuragiLogo } from "@/components/KatsuragiLogo";
import { initLingui } from "@/i18n/server";

// Shown by Next.js while a page is being fetched, so a slow connection never looks like a frozen app. The
// header and the tab bar stay where they are. It appears after a short wait (see .loading-fade), so a quick
// page change does not flash it. A screen reader hears 「読み込み中」 once.
export default async function Loading() {
  const i18n = await initLingui();
  const label = i18n.locale === "ja" ? "読み込み中" : "Loading";

  return (
    <div role="status" aria-live="polite" className="loading-fade flex min-h-[60dvh] flex-col items-center justify-center gap-6 px-4">
      <div className="relative flex size-28 items-center justify-center">
        <span aria-hidden="true" className="loading-ring absolute inset-0 rounded-full border-4 border-shu opacity-0" />
        <span
          aria-hidden="true"
          className="loading-seal flex size-24 flex-col items-center justify-center rounded-full bg-shu text-on-shu shadow-[inset_0_0_0_3px_var(--color-shu),inset_0_0_0_5px_var(--color-on-shu)]"
        >
          <span className="text-3xl font-bold">葛城</span>
        </span>
      </div>
      <KatsuragiLogo compact className="h-auto w-48 opacity-90" />
      <p className="text-xl font-bold">{label}</p>
    </div>
  );
}
