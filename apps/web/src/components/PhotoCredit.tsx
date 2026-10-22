import { InfoIcon } from "@/components/icons";
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
 * On a photo, bottom right: "ⓘ who took it / where it is from". The colours are fixed (white on dark) like the other
 * text over photos, so it reads on any picture. It sits in a box that is `relative`, and must not be inside a link.
 */
export function CreditBadge({ credit }: { credit: string | null | undefined }) {
  if (!credit?.trim()) return null;
  return (
    <p className="absolute bottom-2 right-2 flex max-w-[85%] items-start gap-1.5 rounded-lg bg-black/75 px-2 py-1 text-base leading-snug text-white">
      <span className="mt-0.5 shrink-0 [&_svg]:size-5">
        <InfoIcon />
      </span>
      <span className="line-clamp-2 min-w-0 break-words">
        <Words credit={credit} linkClass="underline underline-offset-4" />
      </span>
    </p>
  );
}
