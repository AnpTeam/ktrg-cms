"use client";

import { useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "@/components/button";

type Gesture = "tap" | "drag" | "pinch" | "tilt";

const INK = "#2b2523";
const GLOVE = "#fcfaf5";

/** The fingers, index first: left edge, width, and how high the tip reaches when out and when curled. */
const FINGERS = [
  { x: 72, w: 33, out: 34, curled: 112 },
  { x: 107, w: 33, out: 20, curled: 104 },
  { x: 142, w: 31, out: 34, curled: 110 },
  { x: 175, w: 27, out: 62, curled: 124 },
];

/** The hand's shapes, with no colour of their own: drawn twice below, to make one outline. */
function HandShapes({ gesture }: { gesture: Gesture }) {
  const pinch = gesture === "pinch";
  const out = gesture === "tilt" ? 3 : 1;
  return (
    <>
      {FINGERS.map((f, i) => {
        const top = i < out ? f.out : f.curled;
        return <rect key={f.x} x={f.x} y={top} width={f.w} height={190 - top} rx={f.w / 2} className={pinch && i === 0 ? "tour-pinch-index" : undefined} />;
      })}
      <g transform={`rotate(${pinch ? -44 : -30} 84 206)`}>
        <rect x="66" y={pinch ? 92 : 118} width="36" height={pinch ? 124 : 98} rx="18" className={pinch ? "tour-pinch-thumb" : undefined} />
      </g>
      <rect x="72" y="118" width="130" height="126" rx="46" />
    </>
  );
}

/**
 * A cartoon glove, drawn for this app, doing one of the gestures. The shapes are painted twice, first thick in ink and then
 * in the glove's colour on top, so they join into one outline with a thin line left between the fingers. The gesture repeats
 * until the next step (it stands still with reduced motion).
 */
function GestureHand({ gesture }: { gesture: Gesture }) {
  const touches = gesture === "pinch" ? [] : FINGERS.slice(0, gesture === "tilt" ? 3 : 1);
  return (
    <svg viewBox="0 0 260 300" aria-hidden="true" className="h-full max-h-72 w-auto overflow-visible">
      <g className={`tour-${gesture}`}>
        {touches.map((f) => (
          <circle key={f.x} cx={f.x + f.w / 2} cy={f.out + 4} r="24" fill="#cc6256" fillOpacity="0.5" className="tour-touch" />
        ))}
        <g fill={INK} stroke={INK} strokeWidth="10" strokeLinejoin="round">
          <HandShapes gesture={gesture} />
        </g>
        <g fill={GLOVE}>
          <HandShapes gesture={gesture} />
        </g>
        <rect x="84" y="236" width="106" height="40" rx="10" fill="#cc6256" stroke={INK} strokeWidth="5" />
      </g>
    </svg>
  );
}

/** The (?) button under the zoom buttons: a short tour of the finger gestures, shown over the map. Phones only, since these are touch gestures. */
export function MapHelp() {
  const { t } = useLingui();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const steps: { gesture: Gesture; name: string; how: string }[] = [
    { gesture: "tap", name: t`区間を見る`, how: t`区間を選ぶと、道とスタンプの場所が見えます。` },
    { gesture: "drag", name: t`動かす`, how: t`1本の指でなぞります。` },
    { gesture: "pinch", name: t`大きくする・小さくする`, how: t`2本の指を広げたり、せばめたりします。` },
    { gesture: "tilt", name: t`傾ける`, how: t`3本の指で、上下になぞります。` },
  ];
  const current = steps[step]!;
  const last = step === steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStep(0);
          dialog.current?.showModal();
        }}
        aria-label={t`地図の使い方`}
        className="tap-target inline-flex items-center justify-center rounded-full border border-ink bg-paper text-2xl font-bold text-ink hover:bg-surface md:hidden"
      >
        ?
      </button>
      <dialog ref={dialog} aria-labelledby="map-help-title" className="m-0 h-dvh max-h-none w-full max-w-none flex-col gap-3 bg-transparent p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+var(--top-clear))] open:flex backdrop:bg-black/60">
        <div className="grid min-h-0 flex-1 place-items-center overflow-hidden">
          {/* key: each step starts its movement from the beginning. */}
          <GestureHand key={current.gesture} gesture={current.gesture} />
        </div>
        <div className="rounded-lg bg-paper p-5 text-ink">
          <p className="text-base font-bold tabular-nums text-muted">
            {step + 1} / {steps.length}
          </p>
          <h2 id="map-help-title" className="mt-1 text-2xl font-bold">
            {current.name}
          </h2>
          <p className="mt-2 min-h-[3.5rem] text-lg leading-snug">{current.how}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} className={buttonStyle("secondary", "md", "flex w-full")}>
                {t`戻る`}
              </button>
            ) : (
              <button type="button" onClick={() => dialog.current?.close()} className={buttonStyle("secondary", "md", "flex w-full")}>
                {t`閉じる`}
              </button>
            )}
            <button type="button" onClick={() => (last ? dialog.current?.close() : setStep(step + 1))} className={buttonStyle("primary", "md", "flex w-full")}>
              {last ? t`閉じる` : t`つぎへ`}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
