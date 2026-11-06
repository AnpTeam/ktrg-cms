"use client";

import { useLingui } from "@lingui/react/macro";
import { withFootnote, withLink, type Edit } from "@/lib/rich-text-edit";

/**
 * Two buttons over a rich text box: a link (wraps the selected words) and a footnote (marks the cursor and starts the
 * note at the end). They only write the markup the page already reads (lib/rich-text.ts), so typing it by hand still works.
 */
export function RichTextToolbar({ targetId, value, onChange }: { targetId: string; value: string; onChange: (v: string) => void }) {
  const { t } = useLingui();

  function apply(make: (box: HTMLTextAreaElement) => Edit) {
    const box = document.getElementById(targetId);
    if (!(box instanceof HTMLTextAreaElement)) return;
    const edit = make(box);
    onChange(edit.text);
    // The box is controlled: once the new text is drawn, put the selection back and keep the focus.
    requestAnimationFrame(() => {
      box.focus();
      box.setSelectionRange(edit.select[0], edit.select[1]);
    });
  }

  const button = "tap-target rounded-full border-2 border-line px-4 text-base font-bold";
  return (
    <div role="toolbar" aria-label={t`文章の書式`} aria-controls={targetId} className="mb-1 flex flex-wrap gap-2">
      <button type="button" className={button} onClick={() => apply((b) => withLink(value, b.selectionStart, b.selectionEnd))}>
        {t`リンク`}
      </button>
      <button type="button" className={button} onClick={() => apply((b) => withFootnote(value, b.selectionEnd))}>
        {t`注釈`}
      </button>
    </div>
  );
}
