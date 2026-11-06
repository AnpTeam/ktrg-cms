"use client";

import { useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { BlockEditorLoader } from "./BlockEditorLoader";
import { RichTextToolbar } from "./RichTextToolbar";
import { ADDED_LOCALES, LOCALE_NAMES, MAX_LANGUAGES, moveLanguage, nextLanguage, startLanguages, withTranslation, type AddedLocale, type Translations } from "@/lib/admin/content-locales";
import { PlusIcon } from "@/components/icons";

// The small pieces every admin form is made of. Big controls, a visible label, and a hint line when it helps.

export const inputClass = "tap-target w-full rounded-xl border-2 border-line bg-paper px-4 text-lg text-ink disabled:opacity-60";

export function Field({ label, hint, children, htmlFor, required = false }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string; required?: boolean }) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-base font-bold">
        {label}
        {required ? <span className="ml-2 rounded-md bg-surface px-2 py-0.5 text-sm font-bold text-accent">{t`必須`}</span> : null}
      </label>
      {children}
      {hint ? <p className="text-base text-muted">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ id, value, onChange, lang, maxLength, placeholder, invalid, ariaLabel }: { id: string; value: string; onChange: (v: string) => void; lang?: string; maxLength?: number; placeholder?: string; invalid?: boolean; ariaLabel?: string }) {
  return (
    <input
      id={id}
      type="text"
      lang={lang}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${invalid ? "border-danger" : ""}`}
    />
  );
}

export function TextArea({ id, value, onChange, lang, rows = 6, maxLength = 20000, ariaLabel, placeholder }: { id: string; value: string; onChange: (v: string) => void; lang?: string; placeholder?: string; rows?: number; maxLength?: number; ariaLabel?: string }) {
  return <textarea id={id} lang={lang} rows={rows} maxLength={maxLength} value={value} aria-label={ariaLabel} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${inputClass} py-3 leading-7`} />;
}

/**
 * A text in several languages. Japanese is the language of the site and comes first; "＋ 言語を追加" beside it adds
 * a row below with a language picker (English, Deutsch, Français, ไทย, Español), up to MAX_LANGUAGES boxes in all.
 * English is stored in its own fields (`en` / `onEn`), the others in the item's `translations` map under `field`.
 * Removing a row clears its text. Visitors see Japanese where English is empty; the other languages are not shown
 * to visitors yet.
 */
export function MultilingualField({
  id,
  label,
  field,
  ja,
  en,
  translations,
  onJa,
  onEn,
  onTranslations,
  multiline = false,
  blocks = false,
  required = false,
  invalid = false,
}: {
  id: string;
  label: string;
  /** The field's name in `translations` ("name", "description", ...). */
  field: string;
  ja: string;
  en: string;
  translations: Translations | undefined;
  onJa: (v: string) => void;
  onEn: (v: string) => void;
  onTranslations: (next: Translations) => void;
  multiline?: boolean;
  /** A page's text: the block editor instead of a plain box. */
  blocks?: boolean;
  required?: boolean;
  invalid?: boolean;
}) {
  const { t } = useLingui();
  const [shown, setShown] = useState<AddedLocale[]>(() => startLanguages(en, translations, field));
  const next = nextLanguage(shown);
  const valueOf = (l: AddedLocale) => (l === "en" ? en : (translations?.[l]?.[field] ?? ""));

  // Moving text from one language to another (or clearing it): the parent gets one update per place that changed.
  function move(from: AddedLocale, to: AddedLocale | null) {
    const before = { en, translations: translations ?? {} };
    const after = moveLanguage(before, field, from, to);
    if (after.en !== before.en) onEn(after.en);
    if (after.translations !== before.translations) onTranslations(after.translations);
  }
  const box = (boxId: string, lang: string, value: string, onChange: (v: string) => void, ariaLabel?: string) =>
    blocks ? (
      <BlockEditorLoader id={boxId} lang={lang} label={ariaLabel ?? label} value={value} onChange={onChange} />
    ) : multiline ? (
      <>
        <RichTextToolbar targetId={boxId} value={value} onChange={onChange} />
        <TextArea id={boxId} lang={lang} value={value} onChange={onChange} ariaLabel={ariaLabel} />
      </>
    ) : (
      <TextInput id={boxId} lang={lang} value={value} onChange={onChange} maxLength={200} invalid={lang === "ja" && invalid} ariaLabel={ariaLabel} />
    );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-base font-bold">
        {label}
        {required ? <span className="ml-2 rounded-md bg-surface px-2 py-0.5 text-sm font-bold text-accent">{t`必須`}</span> : null}
      </legend>
      <div className={`mt-2 flex flex-wrap items-start gap-2 ${multiline ? "" : "sm:flex-nowrap"}`}>
        {/* Japanese is always there, so it is a fixed label in the place the other rows have their picker. */}
        <label htmlFor={`${id}-ja`} className={`${inputClass} flex basis-full items-center sm:w-40 sm:basis-auto`}>
          {LOCALE_NAMES.ja}
        </label>
        <div className={`min-w-0 flex-1 basis-full ${multiline ? "order-last" : "sm:basis-auto"}`}>{box(`${id}-ja`, "ja", ja, onJa)}</div>
          <button
            type="button"
            disabled={next === null}
            onClick={() => next && setShown([...shown, next])}
            className="tap-target shrink-0 rounded-full border-2 border-line px-4 text-base font-bold disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1">
              <PlusIcon size={20} />
              {t`言語を追加`}
            </span>
          </button>
      </div>
      {shown.map((l) => (
        <div key={l} className={`flex flex-wrap items-start gap-2 ${multiline ? "" : "sm:flex-nowrap"}`}>
          <select
            aria-label={t`${label}の言語`}
            value={l}
            onChange={(e) => {
              const to = e.target.value as AddedLocale;
              move(l, to);
              setShown(shown.map((x) => (x === l ? to : x)));
            }}
            className={`${inputClass} basis-full sm:w-40 sm:basis-auto`}
          >
            {ADDED_LOCALES.filter((o) => o === l || !shown.includes(o)).map((o) => (
              <option key={o} value={o}>
                {LOCALE_NAMES[o]}
              </option>
            ))}
          </select>
          <div className={`min-w-0 flex-1 basis-full ${multiline ? "order-last" : "sm:basis-auto"}`}>
            {box(`${id}-${l}`, l, valueOf(l), (v) => (l === "en" ? onEn(v) : onTranslations(withTranslation(translations, l, field, v))), `${label}（${LOCALE_NAMES[l]}）`)}
          </div>
          <button
            type="button"
            onClick={() => {
              move(l, null);
              setShown(shown.filter((x) => x !== l));
            }}
            aria-label={t`${LOCALE_NAMES[l]}を削除`}
            className="tap-target shrink-0 rounded-full border-2 border-line px-4 text-base font-bold"
          >
            {t`削除`}
          </button>
        </div>
      ))}
      <p className="text-sm text-muted">
        {shown.includes("en") ? null : `${t`英語は未入力です（日本語を表示します）`} `}
        {t`言語は${MAX_LANGUAGES}つまで（日本語を含む）。英語以外は、まだ訪れる人には表示されません。`}
      </p>
    </fieldset>
  );
}

/**
 * A number box that lets you clear it and type decimals. While you are typing it keeps your text; when you leave it
 * shows the number it understood.
 */
export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  integer = false,
  ariaLabel,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  integer?: boolean;
  /** For a box with no visible label of its own (a table cell). */
  ariaLabel?: string;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  const shown = typing ?? (value === null ? "" : String(value));
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step ?? (integer ? 1 : "any")}
        value={shown}
        onFocus={() => setTyping(value === null ? "" : String(value))}
        onBlur={() => setTyping(null)}
        onChange={(e) => {
          setTyping(e.target.value);
          const n = e.target.value === "" ? null : Number(e.target.value);
          if (n === null || Number.isFinite(n)) onChange(n === null ? null : integer ? Math.round(n) : n);
        }}
        className={`${inputClass} max-w-40`}
      />
      {suffix ? <span className="text-lg">{suffix}</span> : null}
    </div>
  );
}

export function Check({ id, checked, onChange, children, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="tap-target flex items-center gap-3 text-lg">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-6 accent-[var(--color-brand)]" />
      <span>{children}</span>
    </label>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="flex flex-col gap-4 rounded-2xl bg-surface p-4 sm:p-5">
      <h2 className="text-xl font-bold text-accent">{title}</h2>
      {children}
    </section>
  );
}
