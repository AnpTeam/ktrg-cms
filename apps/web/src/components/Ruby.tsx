import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Localized } from "@/components/Localized";
import type { Picked } from "@/lib/pick-text";
import { parseRuby, textOfRuby } from "@/lib/ruby";

/**
 * Furigana for hard kanji, shown in Japanese only (in English the child is
 * already the translated text). Use in headings of text-2xl or larger.
 */
export function Ruby({ reading, children }: { reading: string; children: ReactNode }) {
  const { i18n } = useLingui();
  if (i18n.locale !== "ja") return children;
  return (
    <ruby>
      {children}
      <rp>(</rp>
      <rt>{reading}</rt>
      <rp>)</rp>
    </ruby>
  );
}

/** A name with a reading over each of its kanji runs (see lib/ruby.ts). Japanese only, like `Ruby`. */
export function RubyParts({ parts }: { parts: readonly { text: string; reading: string | null }[] }) {
  const { i18n } = useLingui();
  return (
    <>
      {parts.map((p, i) =>
        p.reading && i18n.locale === "ja" ? (
          <ruby key={i}>
            {p.text}
            <rp>(</rp>
            <rt>{p.reading}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

/**
 * A course's or a place's name with the reading a person typed for it, over its kanji. Only over the real Japanese name:
 * a reading written per kanji is used when it spells this very name; an old one-reading-for-all goes over the whole name.
 * With no reading (or in English) it is the plain name.
 */
export function NameRuby({ title, reading }: { title: Picked | null; reading: string | null | undefined }) {
  const on = !!title && title.lang === "ja" && !title.fallback && !!reading;
  const perKanji = on ? parseRuby(reading!) : null;
  if (perKanji && textOfRuby(perKanji) === title!.text) return <RubyParts parts={perKanji} />;
  if (on && !perKanji && !reading!.includes("{")) return <Ruby reading={reading!}>{title!.text}</Ruby>;
  return <Localized value={title} />;
}
