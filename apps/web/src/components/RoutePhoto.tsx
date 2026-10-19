import Image from "next/image";
import { Trans } from "@lingui/react/macro";
import { CameraOffIcon } from "./icons";

/**
 * A route's photo, filling the box around it (the box sets the size). When there is no photo yet it is a grey panel
 * with a crossed-out camera in the middle, so a card never looks broken while photos are still being collected.
 * An outside address is shown as it is (`unoptimized`), like the other photos: it may be on any host.
 */
export function RoutePhoto({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    return <Image src={src} alt={alt} fill sizes="(min-width: 768px) 36rem, 100vw" className="object-cover" unoptimized={src.startsWith("https://")} />;
  }
  return (
    <span
      role="img"
      aria-label={alt}
      className="absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--color-muted)_20%,var(--color-paper))] text-muted [&_svg]:size-14"
    >
      <CameraOffIcon />
      <span className="sr-only">
        <Trans>写真は、まだありません</Trans>
      </span>
    </span>
  );
}
