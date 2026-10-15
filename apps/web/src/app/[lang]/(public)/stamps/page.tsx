import { Trans } from "@lingui/react/macro";
import { Notice } from "@/components/Notice";
import { ProgressSummary } from "@/components/ProgressSummary";
import { StampGrid } from "@/components/StampGrid";
import { StampLegend } from "@/components/StampLegend";
import { initLingui } from "@/i18n/server";
import { TOTAL_STAMPS } from "@/lib/rally";

// Until accounts and the stamp API exist, nobody has stamps. In development only,
// `?demo=1,2,3,7` fills those slots so the stamped look can be reviewed.
// The production branch returns before searchParams is read, so the page stays static.
async function stampedNumbers(searchParams: Promise<{ demo?: string }>) {
  if (process.env.NODE_ENV === "production") return new Set<number>();
  const { demo } = await searchParams;
  const numbers = (demo ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_STAMPS);
  return new Set(numbers);
}

export default async function StampsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  await initLingui();
  const stamped = await stampedNumbers(searchParams);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="px-4 text-3xl font-bold">
        <Trans>スタンプカード</Trans>
      </h1>
      <ProgressSummary stamped={stamped.size} />
      <StampLegend />
      <StampGrid stamped={stamped} />
      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
    </div>
  );
}
