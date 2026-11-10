import type { ReactNode } from "react";

export type Ground = "story-ground-paper" | "story-ground-surface" | "story-ground-inverse";

/**
 * One chapter of a reading page (docs/design-language.md): its own ground, a headline set vertically for Japanese on a
 * tall screen (else across the top), and the words, which fade up together when StoryMotion is on (`data-reveal`).
 * On a phone the vertical headline floats at the right: the words run beside it and then use the full width under it,
 * so no column is kept for it. With room (@42rem), headline and words stand side by side as two columns. `wide` is for
 * what needs the full width (a map, a list of courses), under the words.
 */
export function Chapter({ ground, heading, id, children, wide }: { ground: Ground; heading: ReactNode; id: string; children: ReactNode; wide?: ReactNode }) {
  return (
    <section data-ground aria-labelledby={id} className={`${ground} @container flex flex-col gap-10 py-20 @[42rem]:py-28`}>
      <div className="mx-auto flow-root w-full max-w-5xl px-5 @[42rem]:px-10 tall:@[42rem]:flex tall:@[42rem]:flex-row-reverse tall:@[42rem]:items-start tall:@[42rem]:gap-16">
        <h2
          id={id}
          className="mb-8 font-serif text-3xl font-bold leading-snug tracking-widest text-inherit tall:float-right tall:mb-4 tall:ml-5 tall:max-h-[22rem] tall:[writing-mode:vertical-rl] @[42rem]:text-4xl tall:@[42rem]:float-none tall:@[42rem]:m-0"
        >
          {heading}
        </h2>
        {/* Plain block flow on a phone (a flex box would not wrap round the floating headline, only shrink beside it). */}
        <div data-reveal className="min-w-0 max-w-[40em] space-y-6 tall:@[42rem]:flex tall:@[42rem]:flex-1 tall:@[42rem]:flex-col tall:@[42rem]:gap-6 tall:@[42rem]:space-y-0">
          {children}
        </div>
      </div>
      {wide}
    </section>
  );
}
