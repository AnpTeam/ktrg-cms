import { useId } from "react";
import { Trans } from "@lingui/react/macro";
import { RIDGE_HEIGHT, RIDGE_WIDTH, type Ridge } from "@/lib/ridge";

/**
 * Where this course sits on the whole trail: the ridge of every course drawn fine, this course's stretch drawn thick in
 * the brand red (docs/design-language.md, Motifs 1). Thick, not only red, so it never rests on colour alone. Nothing is
 * drawn when this course has no heights yet.
 */
export function RidgeMark({ ridge, order }: { ridge: Ridge; order: number }) {
  const clip = useId();
  const span = ridge.spans.get(order);
  if (!span) return null;
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${RIDGE_WIDTH} ${RIDGE_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" className="h-12 w-full overflow-visible">
        <defs>
          <clipPath id={clip}>
            <rect x={span[0]} y={-RIDGE_HEIGHT} width={span[1] - span[0]} height={RIDGE_HEIGHT * 3} />
          </clipPath>
        </defs>
        <path d={ridge.d} fill="none" className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <path d={ridge.d} fill="none" className="stroke-brand" strokeWidth={4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clip})`} />
      </svg>
      <figcaption className="text-base text-muted">
        <Trans>海から山への道のうち、太い線がこの区間です。</Trans>
      </figcaption>
    </figure>
  );
}
