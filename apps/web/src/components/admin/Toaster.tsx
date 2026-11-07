"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import { AlertIcon, TickIcon, XIcon } from "@/components/icons";
import { readToast, showToast, subscribeToast } from "@/lib/admin/toast";

/** The message over every admin page: over the page, not in it, so it catches the eye wherever the page is scrolled to. */
export function Toaster() {
  const { t } = useLingui();
  const toast = useSyncExternalStore(subscribeToast, readToast, () => null);
  const pathname = usePathname();

  // An error is about the page it happened on; good news may follow a save that moved to a new page.
  useEffect(() => {
    if (readToast()?.kind === "error") showToast(null);
  }, [pathname]);

  if (!toast) return null;
  const error = toast.kind === "error";
  return (
    <div key={toast.id} className={`toast-in fixed inset-x-4 top-20 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-2xl border-2 border-paper/40 p-4 text-paper shadow-2xl ${error ? "bg-danger" : "bg-moss"}`}>
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-ink">
        {error ? <AlertIcon size={20} /> : <TickIcon size={20} />}
      </span>
      <p role={error ? "alert" : "status"} className="min-w-0 flex-1 pt-0.5 text-lg font-bold">
        {toast.text}
      </p>
      {toast.action ? (
        <button type="button" onClick={toast.action.run} className="tap-target shrink-0 rounded-full border-2 border-paper px-3 text-base font-bold">
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" onClick={() => showToast(null)} aria-label={t`閉じる`} className="tap-target shrink-0 rounded-full px-3 hover:bg-paper/20">
        <XIcon size={22} />
      </button>
    </div>
  );
}
