import Image from "next/image";
import { Trans } from "@lingui/react/macro";
import { Waves } from "@/components/landing/Decor";
import { CreditBadge } from "@/components/PhotoCredit";
import type { PanelPhoto } from "@/lib/landing-desktop";

/**
 * What a desktop adds to the journey's stage (docs/landing-desktop-design.md): the picture panel on the right (a course photo
 * under a veil of the panel's own colour, the wave band, and, from the stage, the ridge and its seals in front) and the step
 * marker at the bottom left. Both are drawn only on a desk-sized screen while the scene is live (globals.css, `[data-picture]`
 * and `[data-steps]`), so the stacked page, a phone and reduced motion never see them. The photo is a hint, never under words.
 * The credit is outside the hidden panel: it is attribution, and stays readable.
 */
export function DeskPanel({ photos }: { photos: PanelPhoto[] }) {
  return (
    <>
      <div data-picture="" aria-hidden="true">
        {photos.map((p, i) => (
          <div key={i} data-photo={i}>
            <Image src={p.src} alt="" fill sizes="60vw" className="object-cover" unoptimized={p.src.startsWith("http")} />
          </div>
        ))}
        <div data-veil="" />
        <Waves id="seigaiha-panel" className="z-0" />
      </div>
      <div data-picture-credit="">
        {photos.map((p, i) => (
          <div key={i} data-credit={i}>
            <CreditBadge credit={p.credit} />
          </div>
        ))}
      </div>
      <ol data-steps="" aria-hidden="true">
        <li data-step="0">
          <span>01</span> <Trans>海</Trans>
        </li>
        <li data-step="1">
          <span>02</span> <Trans>稜線</Trans>
        </li>
        <li data-step="2">
          <span>03</span> <Trans>経塚</Trans>
        </li>
      </ol>
    </>
  );
}
