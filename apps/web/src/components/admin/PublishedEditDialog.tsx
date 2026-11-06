"use client";

import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";

const SKIP_KEY = "published-edit-skip";

/** Whether the person asked not to be warned again (this browser only; a convenience, so a blocked store just means "ask"). */
export function skipsPublishedWarning(): boolean {
  try {
    return window.localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Asked before the first edit of a published waypoint: the edit turns it back into a draft (visitors stop seeing it once
 * this is saved) until it is published again. A native <dialog>, so focus, Escape and the backdrop come for free.
 */
export function PublishedEditDialog({ name, onProceed, onCancel }: { name: string | null; onProceed: () => void; onCancel: () => void }) {
  const { t } = useLingui();
  const ref = useRef<HTMLDialogElement>(null);
  const [never, setNever] = useState(false);
  const open = name !== null;
  const label = name ?? "";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function proceed() {
    if (never) {
      try {
        window.localStorage.setItem(SKIP_KEY, "1");
      } catch {
        // Not stored: it asks again next time.
      }
    }
    setNever(false);
    onProceed();
  }

  return (
    <dialog ref={ref} aria-labelledby="published-edit-title" onCancel={onCancel} onClose={onCancel} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border-2 border-ink bg-paper p-5 text-ink backdrop:bg-black/60">
      <h2 id="published-edit-title" className="text-xl font-bold">
        {t`公開中の経由地を編集します`}
      </h2>
      <p className="mt-3 text-lg">{t`「${label}」は公開中です。編集すると、この経由地は下書きに戻ります。保存した時点から、利用者には表示されなくなります（スタンプの記録は残ります）。`}</p>
      <p className="mt-2 text-lg">{t`もう一度公開するときは、「経由地」タブで「公開する」を押してください。`}</p>
      <label className="mt-4 flex items-center gap-2 text-base">
        <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="size-5" />
        {t`今後はこの確認を表示しない`}
      </label>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={proceed} className="tap-target rounded-full bg-ink px-5 text-lg font-bold text-paper">
          {t`編集して下書きに戻す`}
        </button>
        <button type="button" onClick={onCancel} className="tap-target rounded-full border-2 border-line px-5 text-lg font-bold">
          {t`やめる`}
        </button>
      </div>
    </dialog>
  );
}
