import { Trans } from "@lingui/react/macro";
import type { Picked } from "@/lib/content";

/**
 * CMS text in the visitor's language. English that was never entered falls back
 * to Japanese; the text is then marked lang="ja" for screen readers and tagged,
 * so nobody wonders why a few words are in Japanese.
 */
export function Localized({ value, tag = true }: { value: Picked | null; tag?: boolean }) {
  if (!value) return null;
  return (
    <>
      <span lang={value.lang}>{value.text}</span>
      {value.fallback && tag ? (
        <span className="ml-2 inline-block rounded border-2 border-line px-1.5 align-middle text-base font-normal text-muted">
          <Trans>日本語のみ</Trans>
        </span>
      ) : null}
    </>
  );
}
