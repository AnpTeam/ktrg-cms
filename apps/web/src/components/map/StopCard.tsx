"use client";

import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { StatusWord } from "@/components/StatusWord";
import type { SpotStatus } from "@/lib/content";
import { WarningIcon } from "@/components/icons";

/** The small card shown under the map when a stop is tapped. The full sheet is its own page. */
export function StopCard({
  order,
  name,
  nameLang,
  status,
  href,
  draft,
}: {
  order: number;
  name: string;
  nameLang: "ja" | "en";
  status: SpotStatus;
  href: string;
  draft: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-line bg-paper p-4" role="status">
      <p className="text-xl font-bold leading-snug">
        {order}. <span lang={nameLang}>{name}</span>
      </p>
      <p className="text-lg">
        <StatusWord status={status} />
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
        className="tap-target inline-flex items-center justify-center self-start rounded-lg bg-ink px-5 text-lg font-bold text-paper"
      >
        <Trans>この場所を見る</Trans>
      </Link>
    </div>
  );
}
