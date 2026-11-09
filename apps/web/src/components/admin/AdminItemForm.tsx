"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { useReauth } from "@/components/auth/ReauthDialog";
import { useErrorMessages } from "@/components/useErrorMessages";
import { displayValue, MAX_RELATION_CHOICES, pick, type FieldUi, type ListItem, type ListMeta } from "@/lib/admin/lists/config";
import { changedFields, formValues, missingRequired, toPayload, type FormValues } from "@/lib/admin/lists/form";
import { listRequest, type ListAnswer, type ListPage, type OneItem } from "@/lib/admin/lists/list-client";
import { translationsChange, type Translations } from "@/lib/admin/content-locales";
import { RubyEditor } from "./RubyEditor";
import { Check, Field, inputClass, MultilingualField, NumberInput, Section, TextInput } from "./fields";
import { HoursInput } from "./HoursInput";
import { PhotoSlot } from "./PhotoSlot";
import { PhotoLinkDetails } from "./PhotoLinkDetails";
import { PhotoUpload } from "./PhotoUpload";
import { PositionMap } from "./PositionMap";
import { RelationPicker } from "./RelationPicker";
import { UserActions } from "./UserActions";

import { confirmDialog } from "@/components/ConfirmDialog";
import { showToast } from "@/lib/admin/toast";


// The form for one row of any generic admin list, drawn from its description (GET /admin/lists) like the rally
// editor. A new row is created in one go and then opens as its own page; a change sends only what changed, with the
// updatedAt it loaded, so nobody overwrites a newer save. Read-only fields are shown as text. When the API asks for a
// fresh login (a role change), the "confirm it is you" dialog opens and the save is tried again.
/** How each list's long text is drawn for visitors, which decides its editor. Anything else is shown as typed: a plain box. */
const LONG_TEXT: Record<string, "blocks" | "short"> = { posts: "blocks", directory: "short" };

export function AdminItemForm({ meta: config, initial, locale, choices }: { meta: ListMeta; initial: ListItem | null; locale: string; choices: Record<string, { id: string; name: string; detail?: string }[]> }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const router = useRouter();
  const { guard, dialog } = useReauth();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState<FormValues>(() => formValues(config, initial));
  // The other content languages of the bilingual fields ({ de: { title } }), kept beside the plain values.
  const [words, setWords] = useState<Translations>(() => (initial?.translations ?? {}) as Translations);
  const [busy, setBusy] = useState(false);
  // A form with `side` fields shows them on a second tab (詳細), so the text keeps the whole width.
  const [tab, setTab] = useState<"main" | "side">("main");

  const missing = missingRequired(config, values);
  const wordChange = saved ? translationsChange((saved.translations ?? {}) as Translations, words) : null;
  const changes = saved ? { ...changedFields(config, values, saved), ...(wordChange ? { translations: wordChange } : {}) } : null;
  const editable = config.fields.some((f) => !f.readOnly) && (saved ? config.ops.edit : config.ops.create);
  const canSave = !busy && editable && missing.length === 0 && (changes === null || Object.keys(changes).length > 0);
  // Unsaved work: a change to a saved row, or anything typed into a new one.
  const dirty = saved ? Object.keys(changes ?? {}).length > 0 : JSON.stringify(values) !== JSON.stringify(formValues(config, null)) || Object.keys(words).length > 0;
  const set = (name: string) => (v: string | boolean) => setValues((now) => ({ ...now, [name]: v }));
  const text = (name: string) => String(values[name] ?? "");
  const routeName = (id: string, field: string) => choices[field]?.find((r) => r.id === id)?.name ?? null;

  useUnsavedGuard(dirty);

  // Ctrl+S / ⌘S saves, even from inside a box. The latest save is kept in a ref so the listener is added once.
  const saveNow = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** After saving a place, open the next one still waiting for its position to be checked. */
  async function openNext(currentId: string) {
    const res = await listRequest<ListPage>("GET", `${config.key}?filter=positionVerified:false`);
    if (!res.ok) return showToast({ kind: "error", text: messages[res.key] });
    const at = res.data.items.findIndex((i) => i.id === currentId);
    const target = res.data.items[at + 1] ?? res.data.items.find((i) => i.id !== currentId);
    if (target) router.push(`/admin/${config.key}/${target.id}`);
    else showToast({ kind: "ok", text: t`保存しました。次に確認する場所はありません。` });
  }

  async function save(andNext = false) {
    setBusy(true);
    showToast(null);
    const got: { item: ListItem | null } = { item: null };
    const send = async () => {
      const res: ListAnswer<OneItem> = saved
        ? await listRequest<OneItem>("PATCH", `${config.key}/${saved.id}`, { updatedAt: saved.updatedAt, ...changes })
        : await listRequest<OneItem>("POST", config.key, { ...toPayload(config, values), ...(Object.keys(words).length ? { translations: words } : {}) });
      if (!res.ok) return { ok: false as const, code: res.key };
      got.item = res.data.item;
      return { ok: true as const };
    };
    const outcome = await guard(send);
    setBusy(false);
    const item = got.item;
    if (!outcome.ok || !item) return outcome.ok || outcome.code === "cancelled" ? undefined : showToast({ kind: "error", text: messages[outcome.code] });
    if (!saved) return router.push(`/admin/${config.key}/${item.id}`);
    setSaved(item);
    setValues(formValues(config, item));
    setWords((item.translations ?? {}) as Translations);
    showToast({ kind: "ok", text: t`保存しました。` });
    if (andNext) await openNext(item.id);
  }

  async function remove() {
    if (!saved || (config.deleteWarning && !(await confirmDialog({ title: t`削除しますか？`, body: pick(config.deleteWarning, locale), yes: t`削除する` })))) return;
    setBusy(true);
    const res = await listRequest("DELETE", `${config.key}/${saved.id}`);
    setBusy(false);
    if (!res.ok) return showToast({ kind: "error", text: messages[res.key] });
    router.push(`/admin/${config.key}`);
  }

  useEffect(() => {
    saveNow.current = () => {
      if (canSave) void save();
    };
  });
  const reviewable = config.fields.some((f) => f.name === "positionVerified");

  const sideFields = config.fields.filter((f) => f.side);

  function input(f: FieldUi) {
    const id = `${config.key}-${f.name}`;
    const label = pick(f.label, locale);
    const hint = f.hint ? pick(f.hint, locale) : undefined;
    if (f.readOnly || !editable) {
      const shown = f.kind === "boolean" ? (saved?.[f.name] === true ? "✓" : "—") : saved ? (displayValue(f, saved, locale, routeName) ?? "—") : "—";
      return (
        <div key={f.name} className="flex flex-col gap-1">
          <p className="text-base font-bold">{label}</p>
          <p className="break-all text-lg">{shown}</p>
        </div>
      );
    }
    switch (f.kind) {
      case "bilingual":
      case "bilingual-long":
        return (
          <div key={f.name} className="flex flex-col gap-1">
            <MultilingualField
              id={id}
              label={label}
              field={f.name}
              ja={text(`${f.name}Ja`)}
              en={text(`${f.name}En`)}
              translations={words}
              onJa={set(`${f.name}Ja`)}
              onEn={set(`${f.name}En`)}
              onTranslations={setWords}
              long={f.kind === "bilingual-long" ? (LONG_TEXT[config.key] ?? "plain") : undefined}
              notes={config.key === "posts"}
              required={f.required}
              invalid={missing.includes(f.name)}
            />
            {hint ? <p className="text-base text-muted">{hint}</p> : null}
          </div>
        );
      case "boolean":
        return (
          <Check key={f.name} id={id} checked={values[f.name] === true} onChange={set(f.name)}>
            {label}
          </Check>
        );
      case "relation":
        // A row of another list (a waypoint, a place, a writer): found by typing, not by scrolling a drop-down.
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <RelationPicker id={id} to={f.to ?? ""} locale={locale} value={text(f.name)} choices={choices[f.name] ?? []} max={MAX_RELATION_CHOICES} noneLabel={f.noneLabel ? pick(f.noneLabel, locale) : "—"} onChange={set(f.name)} />
          </Field>
        );
      case "relations": {
        // Any number of rows of a short list (tags): tick boxes, not a search.
        const picked = new Set(text(f.name).split(",").filter(Boolean));
        const all = choices[f.name] ?? [];
        return (
          <fieldset key={f.name} className="flex flex-col gap-2">
            <legend className="text-lg font-bold">{label}</legend>
            {hint ? <p className="text-base text-muted">{hint}</p> : null}
            {all.length === 0 ? <p className="text-base text-muted">{t`まだ、ありません。`}</p> : null}
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {all.map((c) => (
                <label key={c.id} className="tap-target inline-flex items-center gap-2 text-lg">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={picked.has(c.id)}
                    disabled={busy}
                    onChange={() => set(f.name)(all.filter((x) => (x.id === c.id ? !picked.has(c.id) : picked.has(x.id))).map((x) => x.id).join(","))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        );
      }
      case "ruby":
        // The reading over the Japanese name, typed per run of kanji (the same editor as a course's name).
        return (
          <Field key={f.name} label={label} hint={hint}>
            <RubyEditor name={text(f.of ?? "nameJa")} value={text(f.name)} onChange={set(f.name)} />
          </Field>
        );
      case "hours":
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id}>
            <HoursInput id={id} value={text(f.name)} onChange={set(f.name)} disabled={busy} />
          </Field>
        );
      case "select":
      case "route":
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <select id={id} value={text(f.name)} onChange={(e) => set(f.name)(e.target.value)} className={inputClass}>
              {f.kind === "route" ? <option value="">{f.noneLabel ? pick(f.noneLabel, locale) : "—"}</option> : null}
              {(f.kind === "route" ? (choices[f.name] ?? []).map((r) => ({ value: r.id, text: r.name })) : (f.options ?? []).map((o) => ({ value: o.value, text: pick(o.label, locale) }))).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.text}
                </option>
              ))}
            </select>
          </Field>
        );
      case "number":
      case "decimal": {
        const field = (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <NumberInput id={id} integer={f.kind === "number"} value={text(f.name) === "" ? null : Number(text(f.name))} onChange={(v) => set(f.name)(v === null ? "" : String(v))} />
          </Field>
        );
        if (f.name !== "lng" || !config.fields.some((x) => x.name === "lat")) return field;
        const lat = text("lat") === "" ? null : Number(text("lat"));
        const lng = text("lng") === "" ? null : Number(text("lng"));
        return [
          field,
          <PositionMap key="position-map" lat={lat} lng={lng} onChange={(la, ln) => setValues((now) => ({ ...now, lat: String(la), lng: String(ln) }))} />,
        ];
      }
      case "date":
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <input id={id} type="date" value={text(f.name)} onChange={(e) => set(f.name)(e.target.value)} aria-invalid={missing.includes(f.name) || undefined} className={`${inputClass} max-w-60`} />
          </Field>
        );
      case "image":
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <PhotoUpload onUploaded={set(f.name)} disabled={busy} />
            <div className="mt-2">
              <PhotoLinkDetails open={missing.includes(f.name)}>
                <TextInput id={id} value={text(f.name)} onChange={set(f.name)} maxLength={500} placeholder="https://" invalid={missing.includes(f.name)} />
              </PhotoLinkDetails>
            </div>
            <PhotoSlot url={text(f.name)} className="mt-2 max-w-md" />
          </Field>
        );
      default:
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <TextInput id={id} value={text(f.name)} onChange={set(f.name)} maxLength={500} placeholder={f.kind === "url" ? "https://" : undefined} invalid={missing.includes(f.name)} />
          </Field>
        );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* The save button stays in reach, and its answer is a toast over the page (like the route editor's). */}
      {editable ? (
        <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-3 border-b border-line bg-paper px-4 py-3 lg:-mx-8 lg:px-8">
          <p className="mr-auto text-base text-muted" aria-live="polite">
            {dirty ? t`保存していない変更があります` : saved ? t`保存済み` : ""}
          </p>
          {saved && reviewable ? (
            <button type="button" onClick={() => void save(true)} disabled={!canSave} className="tap-target rounded-full border-2 border-ink px-6 text-lg font-bold disabled:opacity-40">
              {t`保存して次へ`}
            </button>
          ) : null}
          <button type="button" onClick={() => void save()} disabled={!canSave} className="tap-target rounded-full bg-ink px-8 text-xl font-bold text-paper disabled:opacity-40">
            {busy ? t`保存中…` : saved ? t`保存` : t`作成`}
          </button>
        </div>
      ) : null}

      {sideFields.length > 0 ? (
        <div role="tablist" aria-label={t`編集する内容`} className="flex flex-wrap gap-2">
          {(["main", "side"] as const).map((id) => {
            const unfilled = missing.filter((name) => config.fields.some((f) => f.name === name && Boolean(f.side) === (id === "side"))).length;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`form-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`form-panel-${id}`}
                onClick={() => setTab(id)}
                className={`tap-target inline-flex items-center gap-2 rounded-full border-2 px-5 text-lg font-bold ${tab === id ? "border-ink bg-ink text-paper" : "border-line"}`}
              >
                {id === "main" ? t`本文` : t`詳細`}
                {/* Only on the other tab: what is missing there cannot be seen from here. */}
                {editable && unfilled > 0 && tab !== id ? <span className="rounded-full bg-danger px-2 text-base text-paper">{unfilled}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {/* Both panels stay drawn (one hidden), so the editor and what was typed survive a switch. */}
      <div id="form-panel-main" role={sideFields.length > 0 ? "tabpanel" : undefined} aria-labelledby={sideFields.length > 0 ? "form-tab-main" : undefined} hidden={sideFields.length > 0 && tab !== "main"}>
        <Section title={t`内容`}>
          {config.fields.filter((f) => !f.side).map(input)}
          {editable && missing.length > 0 ? <p className="text-base text-muted">{t`「必須」の欄をすべて入れると保存できます。`}</p> : null}
        </Section>
      </div>
      {sideFields.length > 0 ? (
        <div id="form-panel-side" role="tabpanel" aria-labelledby="form-tab-side" hidden={tab !== "side"}>
          <Section title={t`公開と記事の情報`}>{sideFields.map(input)}</Section>
        </div>
      ) : null}

      {saved && config.ops.delete ? (
        <Section title={t`削除`}>
          <button type="button" onClick={remove} disabled={busy} className="tap-target w-fit rounded-full border-2 border-danger px-6 text-lg font-bold text-danger disabled:opacity-50">
            {t`削除する`}
          </button>
        </Section>
      ) : null}
      {saved && config.key === "users" ? (
        <UserActions
          item={saved}
          locale={locale}
          onItem={(item) => {
            setSaved(item);
            setValues(formValues(config, item));
          }}
        />
      ) : null}
      {dialog}
    </div>
  );
}
