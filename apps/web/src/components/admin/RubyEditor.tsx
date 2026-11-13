"use client";

import { useLingui } from "@lingui/react/macro";
import { Fragment, type ReactNode } from "react";
import { isKanji, isPerKanji, partsFor, serializeRuby, type RubyPart } from "@/lib/ruby";
import { LinkIcon } from "../icons";

const tiny = "inline-flex h-11 min-h-0 items-center justify-center whitespace-nowrap rounded-full border border-line px-3 text-sm font-bold hover:bg-surface";
// Round, icon only: it sits in the gap between two reading boxes, which says what it joins.
const link = "inline-flex size-11 min-h-0 min-w-0 items-center justify-center rounded-full border border-line text-ink hover:bg-surface [&_svg]:size-5";
// A real minimum width, so a reading is never cut off; a long name scrolls sideways instead.
const box = "h-11 min-h-0 w-full min-w-[3.5em] rounded-full border border-line bg-paper px-2 text-base";

/**
 * The reading of a name, typed over each run of kanji (葛城 → かつらぎ), not for the whole name. A run can be split into
 * single kanji (葛 → かつ, 城 → らぎ) and joined again. What is typed is stored as 葛城{かつらぎ}… in the reading field.
 */
export function RubyEditor({ name, value, onChange }: { name: string; value: string; onChange: (markup: string) => void }) {
  const { t } = useLingui();
  const parts = partsFor(name, value);
  const legacy = value !== "" && !isPerKanji(value);
  const commit = (next: RubyPart[]) => onChange(serializeRuby(next));
  const patch = (i: number, reading: string) => commit(parts.map((p, j) => (j === i ? { ...p, reading: reading.trim() === "" ? null : reading } : p)));
  const split = (i: number) => commit(parts.flatMap((p, j) => (j === i ? [...p.text].map((ch) => ({ text: ch, reading: null })) : [p])));
  const join = (i: number) => commit(parts.flatMap((p, j) => (j === i ? [{ text: p.text + parts[i + 1]!.text, reading: null }] : j === i + 1 ? [] : [p])));
  const kanjiAt = (i: number) => isKanji(parts[i]?.text[0] ?? "");
  const joinable = (i: number) => kanjiAt(i) && kanjiAt(i + 1);
  const hasKanjiRun = parts.some((_, i) => kanjiAt(i));
  // A row of the grid: one cell per part, with a narrow gap cell between neighbours (where the join button sits).
  const row = (cell: (i: number) => ReactNode, gap: (i: number) => ReactNode = () => null) =>
    parts.flatMap((_, i) => [<Fragment key={`c${i}`}>{cell(i)}</Fragment>, i < parts.length - 1 ? <Fragment key={`g${i}`}>{gap(i) ?? <span />}</Fragment> : null]);

  if (name.trim() === "" || !hasKanjiRun) return <p className="text-base text-muted">{t`漢字を入れると、ここで漢字ごとに読みを入れられます。`}</p>;
  return (
    <div className="flex flex-col gap-2">
      {/* The name in one row, a reading box under each run of kanji with a join button between two neighbouring boxes, and the split buttons under the boxes. */}
      <div role="group" aria-label={t`漢字ごとの読み`} className="grid w-fit max-w-full items-center gap-x-1 gap-y-1 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${parts.length * 2 - 1}, auto)` }}>
        {row((i) => (
          <label htmlFor={`ruby-${i}`} className="px-1 text-center text-xl font-bold leading-tight">
            {parts[i]!.text}
          </label>
        ))}
        {row(
          (i) =>
            kanjiAt(i) ? (
              <input id={`ruby-${i}`} type="text" value={parts[i]!.reading ?? ""} onChange={(e) => patch(i, e.target.value)} maxLength={40} placeholder={t`よみ`} lang="ja" size={Math.max(4, [...parts[i]!.text].length * 3)} className={box} />
            ) : (
              <span />
            ),
          (i) =>
            joinable(i) ? (
              <button type="button" onClick={() => join(i)} className={link} aria-label={t`となりの漢字と、ひとつの読みにします`} title={t`となりの漢字と、ひとつの読みにします`}>
                <LinkIcon />
              </button>
            ) : null,
        )}
        {row((i) =>
          kanjiAt(i) && [...parts[i]!.text].length > 1 ? (
            <button type="button" onClick={() => split(i)} className={tiny} title={t`1文字ずつ、別の読みを入れます`}>
              {t`1文字ずつ`}
            </button>
          ) : (
            <span />
          ),
        )}
      </div>
      {parts.some((_, i) => joinable(i)) ? (
        <p className="flex items-center gap-2 text-base text-muted">
          <span className="shrink-0 [&_svg]:size-5">
            <LinkIcon />
          </span>
          {t`となりの漢字と、ひとつの読みにします（例：粉 ＋ 河 → こかわ）。`}
        </p>
      ) : null}
      {legacy ? (
        <p className="text-base text-muted">
          {t`いまの読み（名前全体にひとつ）：${value}。上に入れると、漢字ごとの読みに置き換わります。`}
          <button type="button" onClick={() => onChange("")} className="ml-2 font-bold underline underline-offset-4">
            {t`消す`}
          </button>
        </p>
      ) : null}
    </div>
  );
}
