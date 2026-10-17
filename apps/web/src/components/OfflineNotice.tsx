"use client";

import { useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";

// "No signal" bar (WBS 3.5.5). Mountain signal comes and goes, so the app says so plainly instead of leaving the
// visitor to wonder why a button does nothing. It follows the browser's online and offline events; the offline
// pack itself (saved maps and queued stamps) is Phase B and not built yet, so this only informs.
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineNotice() {
  const { t } = useLingui();
  // On the server, and before the browser has answered, assume there is a connection.
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;

  return (
    <div role="status" className="sticky top-0 z-40 mb-3 bg-ink px-4 py-3 text-center text-lg font-bold text-paper">
      {t`いま、通信がつながっていません。つながると、また使えます。`}
    </div>
  );
}
