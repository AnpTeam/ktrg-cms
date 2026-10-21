"use client";

import { useLingui } from "@lingui/react/macro";
import { photoLinkLooksValid } from "@/lib/admin/save-plan";

// A 16:9 frame for a photo link: the picture when the link is a usable https address, else a plain "no photo" frame.
// The box beside it holds the photo's https link: typed, or filled in by uploading a file (PhotoUpload).
export function PhotoSlot({ url, className = "" }: { url: string; className?: string }) {
  const { t } = useLingui();
  const ok = url.trim() !== "" && photoLinkLooksValid(url);
  return (
    <div className={`flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-paper text-base text-muted ${className}`}>
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element -- an editor's preview of an address typed by hand; any host
        <img src={url.trim()} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        <span>{url.trim() === "" ? t`写真はまだありません` : t`このリンクは使えません`}</span>
      )}
    </div>
  );
}
