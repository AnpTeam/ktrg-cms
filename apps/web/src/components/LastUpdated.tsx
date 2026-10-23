import { Trans } from "@lingui/react/macro";
import { formatDay, japanDay } from "@/lib/format";

/** "Last updated: Oct 16, 2026" in Japan time; nothing when there is no date. */
export function LastUpdated({ iso, locale, className = "" }: { iso: string | null | undefined; locale: string; className?: string }) {
  if (!iso) return null;
  const day = formatDay(locale, japanDay(iso));
  return (
    <p className={`text-base text-muted ${className}`}>
      <Trans>最終更新：{day}</Trans>
    </p>
  );
}
