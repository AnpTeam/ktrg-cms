"use client";

import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { StatusWord } from "@/components/StatusWord";
import type { SpotStatus } from "@/lib/content";
import { WarningIcon } from "@/components/icons";

import { buttonStyle } from "@/components/button";
/** The small card shown under the map when a stop is tapped. The full sheet is its own page. */
export function StopCard({
  order,
  name,
  nameLang,
  status,
  href,
  noStamp = false,
  draft,
}: {
  /** null for a side trip (寄り道): no number. */
  order: number | null;
  name: string;
  nameLang: "ja" | "en";
  status: SpotStatus;
  href: string;
  /** A place where no stamp can be collected. */
  noStamp?: boolean;
  draft: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-line bg-paper p-4" role="status">
      <p className="text-xl font-bold leading-snug">
        {order === null ? "" : `${order}. `}<span lang={nameLang}>{name}</span>
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg">
        <StatusWord status={status} />
        {noStamp ? (
          <span className="rounded-lg border-2 border-dashed border-line px-2 text-base font-bold">
            <Trans>スタンプなし</Trans>
          </span>
        ) : null}
      </p>
      {draft ? (
        <p className="flex items-start gap-2 text-base text-muted">
          <span className="shrink-0 text-caution">
            <WarningIcon />
          </span>
          <Trans>この場所の位置は仮のもので、まだ確認されていません。</Trans>
        </p>
      ) : null}
      <Link
        href={href}
        className={buttonStyle("primary", "md", "inline-flex self-start")}
      >
        <Trans>この場所を見る</Trans>
      </Link>
    </div>
  );
}
