"use client";

import { useLingui } from "@lingui/react/macro";
import { isKanji, isPerKanji, partsFor, serializeRuby, type RubyPart } from "@/lib/ruby";
import { TextInput } from "./fields";

const tiny = "tap-target rounded-lg border border-line px-2 text-sm font-bold hover:bg-surface";

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
      <ul className="flex flex-wrap items-end gap-x-2 gap-y-3">
        {parts.map((p, i) =>
          isKanji(p.text[0] ?? "") ? (
            <li key={i} className="flex w-32 flex-col gap-1 rounded-xl border border-line bg-paper p-2">
              <label htmlFor={`ruby-${i}`} className="text-center text-2xl font-bold">
                {p.text}
              </label>
              <TextInput id={`ruby-${i}`} value={p.reading ?? ""} onChange={(v) => patch(i, v)} maxLength={40} placeholder={t`よみ`} lang="ja" />
              <span className="flex gap-1">
                {[...p.text].length > 1 ? (
                  <button type="button" onClick={() => split(i)} className={tiny} title={t`1文字ずつ、別の読みを入れます`}>
                    {t`1文字ずつ`}
                  </button>
                ) : null}
                {parts[i + 1] && isKanji(parts[i + 1]!.text[0] ?? "") ? (
                  <button type="button" onClick={() => join(i)} className={tiny} title={t`となりの漢字と、ひとつの読みにします`}>
                    {t`つなぐ`}
                  </button>
                ) : null}
              </span>
            </li>
          ) : (
            <li key={i} className="pb-1 text-2xl font-bold">
              {p.text}
            </li>
          ),
        )}
      </ul>
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
