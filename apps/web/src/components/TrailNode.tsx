import type { NodeState } from "@/lib/ribbon";

const SIZE = 44;
const R = 19;
const CIRC = 2 * Math.PI * R;

/**
 * One stop on the trail. Always a circle with the route's number; the state is the
 * shape, never colour alone:
 *  complete    solid vermilion seal (the rally is done)
 *  inProgress  ring with a moss arc for the share collected
 *  notStarted  plain ring        neutral  the same, when signed out
 *  soon        dashed ring (準備中)
 */
export function TrailNode({ state, order, share }: { state: NodeState; order: number; share: number }) {
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="block">
      {state === "complete" ? (
        <>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 1} className="fill-shu" />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 5} fill="none" className="stroke-paper" strokeWidth="1.5" opacity="0.7" />
        </>
      ) : (
        <>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className="fill-paper" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            className="stroke-line"
            strokeWidth="3"
            strokeDasharray={state === "soon" ? "4 4" : undefined}
          />
          {state === "inProgress" ? (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              className="stroke-moss"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${CIRC * share} ${CIRC}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          ) : null}
        </>
      )}
      <text
        x={SIZE / 2}
        y={SIZE / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="17"
        fontWeight="700"
        className={state === "complete" ? "fill-paper" : state === "soon" ? "fill-muted" : "fill-ink"}
      >
        {order}
      </text>
    </svg>
  );
}
