"use client";

import { useLingui } from "@lingui/react/macro";
import { useHomeWords } from "@/components/landing/useHomeWords";
import { parseHomeText, writeHomeText, type HomeSlot } from "@/lib/home-text";
import { Field, Section, TextArea, TextInput } from "./fields";

const LONG: readonly HomeSlot[] = ["rallyText", "storyText"];

/** One language's boxes for the home page, in the page's own order. An empty box shows the app's words, given here as a hint. */
export function HomeTextFields({ lang, title, body, showBuiltIn, onBody }: { lang: "ja" | "en"; title: string; body: string; showBuiltIn: boolean; onBody: (body: string) => void }) {
  const { t } = useLingui();
  const builtIn = useHomeWords();
  const text = parseHomeText(body);
  const groups: { name: string; slots: { slot: HomeSlot; label: string }[] }[] = [
    { name: t`いちばん上`, slots: [{ slot: "heroLine", label: t`写真の上の言葉` }] },
    {
      name: t`スタンプラリー`,
      slots: [
        { slot: "rallyHeading", label: t`見出し` },
        { slot: "rallyLead", label: t`大きな文字の一文` },
        { slot: "rallyText", label: t`説明` },
      ],
    },
    {
      name: t`区間と地図`,
      slots: [
        { slot: "routesHeading", label: t`区間の見出し` },
        { slot: "mapHeading", label: t`地図の見出し` },
      ],
    },
    {
      name: t`葛城修験とは`,
      slots: [
        { slot: "storyHeading", label: t`見出し` },
        { slot: "storyText", label: t`説明` },
        { slot: "storyCaption", label: t`写真の説明` },
      ],
    },
    {
      name: t`そのほかの見出し`,
      slots: [
        { slot: "videoHeading", label: t`動画` },
        { slot: "officialHeading", label: t`公式サイト` },
        { slot: "tourismHeading", label: t`観光情報` },
        { slot: "startHeading", label: t`いちばん下（新規登録の上）` },
      ],
    },
    {
      name: t`出かける前に`,
      slots: [
        { slot: "beforeHeading", label: t`見出し` },
        { slot: "before1", label: t`1つ目` },
        { slot: "before2", label: t`2つ目` },
        { slot: "before3", label: t`3つ目` },
        { slot: "beforeNotice", label: t`下の注意書き` },
      ],
    },
  ];
  const edit = (slot: HomeSlot, value: string) => {
    const next = { ...text };
    if (value === "") delete next[slot];
    else next[slot] = value;
    onBody(writeHomeText(next));
  };

  return (
    <Section title={title}>
      {groups.map((group) => (
        <fieldset key={group.name} className="flex flex-col gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
          <legend className="text-lg font-bold">{group.name}</legend>
          {group.slots.map(({ slot, label }) => {
            const id = `home-${lang}-${slot}`;
            const hint = showBuiltIn ? builtIn[slot] : undefined;
            return (
              <Field key={slot} label={label} htmlFor={id}>
                {LONG.includes(slot) ? (
                  <TextArea id={id} lang={lang} rows={4} maxLength={1000} value={text[slot] ?? ""} onChange={(v) => edit(slot, v)} placeholder={hint} />
                ) : (
                  <TextInput id={id} lang={lang} value={text[slot] ?? ""} onChange={(v) => edit(slot, v)} maxLength={200} placeholder={hint} />
                )}
              </Field>
            );
          })}
        </fieldset>
      ))}
    </Section>
  );
}
