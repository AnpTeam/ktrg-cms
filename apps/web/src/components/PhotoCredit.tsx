import { Trans } from "@lingui/react/macro";
import { CopyrightIcon, InfoIcon } from "@/components/icons";
import { Inlines } from "@/components/RichText";
import { parseRich } from "@/lib/rich-text";

/** The credit as one line of words and links (a note in a credit is not supported: they are ignored). */
function Words({ credit, linkClass }: { credit: string; linkClass?: string }) {
  return <Inlines parts={parseRich(credit).body} linkClass={linkClass} />;
}

/** Under a photo: "ⓘ who took it / where it is from". Nothing when there is no credit. */
export function CreditCaption({ credit, className = "" }: { credit: string | null | undefined; className?: string }) {
  if (!credit?.trim()) return null;
  return (
    <p className={`flex items-start gap-1.5 text-base leading-snug text-muted ${className}`}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-5">
        <InfoIcon />
      </span>
      <span className="min-w-0 break-words">
        <Words credit={credit} linkClass="underline underline-offset-4" />
      </span>
    </p>
  );
}

/**
 * On a photo, bottom left, small and faint: the hero banner's credit. White with a shadow, so it reads on any picture;
 * the link stays underlined. It sits in a box that is `relative`, and must not be inside a link.
 */
export function CreditBadge({ credit }: { credit: string | null | undefined }) {
  if (!credit?.trim()) return null;
  return (
    <p className="absolute bottom-2 left-3 flex max-w-[70%] items-start gap-1 text-sm leading-snug text-white/70 [text-shadow:0_1px_4px_rgb(0_0_0/0.8)]">
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">
        <InfoIcon />
      </span>
      <span className="line-clamp-2 min-w-0 break-words">
        <Words credit={credit} linkClass="underline underline-offset-4" />
      </span>
    </p>
  );
}

/**
 * On a photo, top right: only "©" until tapped, then who took it / where it is from. For a large photo the credit
 * would otherwise cover (the route page's cover). It sits in a box that is `relative`, and must not be inside a link.
 */
export function CreditToggle({ credit }: { credit: string | null | undefined }) {
  if (!credit?.trim()) return null;
  return (
    <details className="group absolute right-3 top-3 flex max-w-[85%] flex-col items-end">
      {/* The whole 3rem square answers a tap; only a smaller ring shows, so it does not sit heavy on the photo. */}
      <summary className="tap-target grid cursor-pointer list-none place-items-center text-white [&::-webkit-details-marker]:hidden">
        {/* ©, not ⓘ: on a phone it sits just under the top bar's own ⓘ button. */}
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-black/55">
          <CopyrightIcon size={26} />
        </span>
        <span className="sr-only">
          <Trans>写真の出典</Trans>
        </span>
      </summary>
      <p className="mt-1 rounded-lg bg-black/75 px-2 py-1 text-base leading-snug text-white">
        <Words credit={credit} linkClass="underline underline-offset-4" />
      </p>
    </details>
  );
}
