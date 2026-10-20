"use client";

import { useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";

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

export function TextInput({ id, value, onChange, lang, maxLength, placeholder, invalid }: { id: string; value: string; onChange: (v: string) => void; lang?: "ja" | "en"; maxLength?: number; placeholder?: string; invalid?: boolean }) {
  return (
    <input
      id={id}
      type="text"
      lang={lang}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${invalid ? "border-danger" : ""}`}
    />
  );
}

export function TextArea({ id, value, onChange, lang, rows = 6, maxLength = 20000 }: { id: string; value: string; onChange: (v: string) => void; lang?: "ja" | "en"; rows?: number; maxLength?: number }) {
  return <textarea id={id} lang={lang} rows={rows} maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} py-3 leading-7`} />;
}

/**
 * Japanese and English side by side. Japanese is the language of the site, English is optional: while it is empty
 * the public page shows the Japanese text, and this says so.
 */
export function BilingualField({
  id,
  label,
  ja,
  en,
  onJa,
  onEn,
  multiline = false,
  required = false,
  invalid = false,
}: {
  id: string;
  label: string;
  ja: string;
  en: string;
  onJa: (v: string) => void;
  onEn: (v: string) => void;
  multiline?: boolean;
  required?: boolean;
  invalid?: boolean;
}) {
  const { t } = useLingui();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-base font-bold">
        {label}
        {required ? <span className="ml-2 rounded-md bg-surface px-2 py-0.5 text-sm font-bold text-accent">{t`必須`}</span> : null}
      </legend>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-ja`} className="text-sm text-muted">
            {t`日本語`}
          </label>
          {multiline ? <TextArea id={`${id}-ja`} lang="ja" value={ja} onChange={onJa} /> : <TextInput id={`${id}-ja`} lang="ja" value={ja} onChange={onJa} invalid={invalid} maxLength={200} />}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-en`} className="text-sm text-muted">
            English
          </label>
          {multiline ? <TextArea id={`${id}-en`} lang="en" value={en} onChange={onEn} /> : <TextInput id={`${id}-en`} lang="en" value={en} onChange={onEn} maxLength={200} />}
          {en.trim() === "" ? <p className="text-sm text-muted">{t`英語は未入力です（日本語を表示します）`}</p> : null}
        </div>
      </div>
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
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  integer?: boolean;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  const shown = typing ?? (value === null ? "" : String(value));
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
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
