import { Trans } from "@lingui/react/macro";
import { sampleContentEnabled } from "@/lib/content";

/** Shown on every screen while sample content is on, so it cannot be mistaken for real information. */
export function SampleBanner() {
  if (!sampleContentEnabled()) return null;
  return (
    <p className="mx-4 mb-4 rounded-xl border-2 border-dashed border-line p-3 text-lg font-bold">
      <Trans>見本のデータを表示しています。実際の情報ではありません。</Trans>
    </p>
  );
}
