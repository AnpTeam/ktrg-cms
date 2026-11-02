"use client";

import { useLingui } from "@lingui/react/macro";
import { isKanji, isPerKanji, partsFor, serializeRuby, type RubyPart } from "@/lib/ruby";

const tiny = "inline-flex h-11 min-h-0 min-w-0 items-center justify-center rounded-md border border-line px-3 text-sm font-bold hover:bg-surface";
const box = "h-11 min-h-0 min-w-0 rounded-lg border-2 border-line bg-paper px-2 text-base";

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
  const hasKanjiRun = parts.some((p) => isKanji(p.text[0] ?? ""));

  if (name.trim() === "" || !hasKanjiRun) return <p className="text-base text-muted">{t`日本語の名前に漢字があると、ここで読みを入れられます。`}</p>;
  return (
    <div className="flex flex-col gap-2">
      {/* The name in one row, a reading box under each run of kanji, and the split / join buttons under those. */}
      <div role="group" aria-label={t`漢字ごとの読み`} className="grid w-fit max-w-full items-center gap-x-1.5 gap-y-1 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${parts.length}, auto)` }}>
        {parts.map((p, i) => (
          <label key={`t${i}`} htmlFor={`ruby-${i}`} className="px-1 text-center text-xl font-bold leading-tight">
            {p.text}
          </label>
        ))}
        {parts.map((p, i) =>
          isKanji(p.text[0] ?? "") ? (
            <input key={`r${i}`} id={`ruby-${i}`} type="text" value={p.reading ?? ""} onChange={(e) => patch(i, e.target.value)} maxLength={40} placeholder={t`よみ`} lang="ja" size={Math.max(4, [...p.text].length * 3)} className={box} />
          ) : (
            <span key={`r${i}`} />
          ),
        )}
        {parts.map((p, i) => (
          <span key={`b${i}`} className="flex flex-wrap justify-center gap-1">
            {isKanji(p.text[0] ?? "") && [...p.text].length > 1 ? (
              <button type="button" onClick={() => split(i)} className={tiny} title={t`1文字ずつ、別の読みを入れます`}>
                {t`1文字ずつ`}
              </button>
            ) : null}
            {isKanji(p.text[0] ?? "") && parts[i + 1] && isKanji(parts[i + 1]!.text[0] ?? "") ? (
              <button type="button" onClick={() => join(i)} className={tiny} title={t`となりの漢字と、ひとつの読みにします`}>
                {t`つなぐ`}
              </button>
            ) : null}
          </span>
        ))}
      </div>
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
