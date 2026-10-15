import { Trans } from "@lingui/react/macro";
import { sampleContentEnabled } from "@/lib/content";

/** Shown on every screen while sample content is on: it is invented or unchecked draft data, never confirmed information. */
export function SampleBanner() {
  if (!sampleContentEnabled()) return null;
  return (
    <p className="mx-4 mb-4 rounded-xl border-2 border-dashed border-line p-3 text-lg font-bold">
      <Trans>見本・下書きのデータを表示しています。確認前の情報を含みます。</Trans>
    </p>
  );
}
