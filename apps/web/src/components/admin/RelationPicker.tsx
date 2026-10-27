"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { matchChoices } from "@/lib/admin/lists/relation-search";
import { inputClass } from "./fields";

const SHOWN = 30;
/**
 * Picks one row of another list by typing part of its name, instead of scrolling a drop-down of hundreds. The matches
 * are shown below the box (the first few: type more to narrow them); arrow keys and Enter work, Escape closes it.
 * `choices` is what the page loaded (at most `max`); when that many were loaded the hint says the search covers those.
 */
export function RelationPicker({
  id,
  value,
  choices,
  max,
  noneLabel,
  onChange,
}: {
  id: string;
  value: string;
  choices: { id: string; name: string }[];
  max: number;
  noneLabel: string;
  onChange: (id: string) => void;
}) {
  const { t } = useLingui();
  const listId = useId();
  const box = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = choices.find((c) => c.id === value) ?? null;

  const matches = useMemo(() => matchChoices(choices, query), [choices, query]);
  const shown = matches.slice(0, SHOWN);

  const pick = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
  };
  const clamp = (n: number) => Math.max(0, Math.min(n, shown.length)); // index 0 is "none"

  return (
    <div className="relative flex flex-col gap-2">
      <p className="text-base">
        {selected ? <span className="font-bold">{selected.name}</span> : <span className="text-muted">{noneLabel}</span>}
        {selected ? (
          <button type="button" onClick={() => pick("")} className="ml-3 text-base font-bold text-accent underline underline-offset-4">
            {t`はずす`}
          </button>
        ) : null}
      </p>
      <input
        ref={box}
        id={id}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        placeholder={t`名前の一部を入れて探す`}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)} // after a click on a match has landed
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => clamp(a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => clamp(a - 1));
          } else if (e.key === "Enter" && open) {
            e.preventDefault(); // Enter must not save the whole form
            pick(active === 0 ? "" : (shown[active - 1]?.id ?? value));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={inputClass}
      />
      {open ? (
        <ul id={listId} role="listbox" className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-paper shadow-lg">
          <li role="option" aria-selected={!value} className={`cursor-pointer px-4 py-3 text-base text-muted ${active === 0 ? "bg-surface" : ""}`} onMouseDown={() => pick("")}>
            {noneLabel}
          </li>
          {shown.map((c, i) => (
            <li key={c.id} role="option" aria-selected={c.id === value} className={`cursor-pointer px-4 py-3 text-base ${active === i + 1 ? "bg-surface" : ""} ${c.id === value ? "font-bold" : ""}`} onMouseDown={() => pick(c.id)}>
              {c.name}
            </li>
          ))}
          {matches.length === 0 ? <li className="px-4 py-3 text-base text-muted">{t`見つかりませんでした。`}</li> : null}
          {matches.length > SHOWN ? <li className="px-4 py-3 text-base text-muted">{t`ほかにもあります。もう少し入れて絞ってください。`}</li> : null}
          {choices.length >= max ? <li className="px-4 py-3 text-base text-muted">{t`探せるのは、最初の${max}件までです。`}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
