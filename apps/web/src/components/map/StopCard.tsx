"use client";

import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import { StatusWord } from "@/components/StatusWord";
import type { SpotStatus } from "@/lib/content";
import { WarningIcon, XIcon } from "@/components/icons";
import { buttonStyle } from "@/components/button";

/** The small card shown over the map (at its bottom) when a stop is tapped. The full sheet is its own page. */
export function StopCard({
  order,
  name,
  nameLang,
  status,
  href,
  noStamp = false,
  draft,
  onClose,
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
  /** Given when the card lies over the map: a close button at its corner. */
  onClose?: () => void;
}) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-line bg-paper p-3" role="status">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xl font-bold leading-snug">
          {order === null ? "" : `${order}. `}<span lang={nameLang}>{name}</span>
        </p>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label={t`閉じる`} className="tap-target -mr-2 -mt-2 inline-flex shrink-0 items-center justify-center">
            <XIcon />
          </button>
        ) : null}
      </div>
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
