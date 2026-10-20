"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useReauth } from "@/components/auth/ReauthDialog";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode, type ErrorKey } from "@/lib/api-error";
import { displayValue, pick, type FieldUi, type ListItem, type ListMeta } from "@/lib/admin/lists/config";
import { changedFields, formValues, missingRequired, toPayload, type FormValues } from "@/lib/admin/lists/form";
import { listRequest, type ListAnswer, type OneItem } from "@/lib/admin/lists/list-client";
import { BilingualField, Check, Field, inputClass, NumberInput, Section, TextInput } from "./fields";
import { PhotoSlot } from "./PhotoSlot";

type Notice = { kind: "saved" | "error"; text: string } | null;

/** Send a photo to POST /admin/uploads; its public https link, or why not. */
async function uploadPhoto(file: File): Promise<{ ok: true; url: string } | { ok: false; key: ErrorKey }> {
  try {
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/v1/admin/uploads", { method: "POST", credentials: "same-origin", body: form });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; upload?: { url?: unknown } } | null;
    if (res.ok && json?.ok === true && typeof json.upload?.url === "string") return { ok: true, url: json.upload.url };
    return { ok: false, key: json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json) };
  } catch {
    return { ok: false, key: "network" };
  }
}

// The form for one row of any generic admin list, drawn from its description (GET /admin/lists) like the rally
// editor. A new row is created in one go and then opens as its own page; a change sends only what changed, with the
// updatedAt it loaded, so nobody overwrites a newer save. Read-only fields are shown as text. When the API asks for a
// fresh login (a role change), the "confirm it is you" dialog opens and the save is tried again.
export function AdminItemForm({ meta: config, initial, locale, routes }: { meta: ListMeta; initial: ListItem | null; locale: string; routes: { id: string; name: string }[] }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const router = useRouter();
  const { guard, dialog } = useReauth();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState<FormValues>(() => formValues(config, initial));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const missing = missingRequired(config, values);
  const changes = saved ? changedFields(config, values, saved) : null;
  const editable = config.fields.some((f) => !f.readOnly) && (saved ? config.ops.edit : config.ops.create);
  const canSave = !busy && editable && missing.length === 0 && (changes === null || Object.keys(changes).length > 0);
  const set = (name: string) => (v: string | boolean) => setValues((now) => ({ ...now, [name]: v }));
  const text = (name: string) => String(values[name] ?? "");
  const routeName = (id: string) => routes.find((r) => r.id === id)?.name ?? null;

  async function save() {
    setBusy(true);
    setNotice(null);
    const got: { item: ListItem | null } = { item: null };
    const send = async () => {
      const res: ListAnswer<OneItem> = saved
        ? await listRequest<OneItem>("PATCH", `${config.key}/${saved.id}`, { updatedAt: saved.updatedAt, ...changes })
        : await listRequest<OneItem>("POST", config.key, toPayload(config, values));
      if (!res.ok) return { ok: false as const, code: res.key };
      got.item = res.data.item;
      return { ok: true as const };
    };
    const outcome = await guard(send);
    setBusy(false);
    const item = got.item;
    if (!outcome.ok || !item) return outcome.ok || outcome.code === "cancelled" ? undefined : setNotice({ kind: "error", text: messages[outcome.code] });
    if (!saved) return router.push(`/${locale}/admin/${config.key}/${item.id}`);
    setSaved(item);
    setValues(formValues(config, item));
    setNotice({ kind: "saved", text: t`保存しました。` });
  }

  async function remove() {
    if (!saved || (config.deleteWarning && !window.confirm(pick(config.deleteWarning, locale)))) return;
    setBusy(true);
    const res = await listRequest("DELETE", `${config.key}/${saved.id}`);
    setBusy(false);
    if (!res.ok) return setNotice({ kind: "error", text: messages[res.key] });
    router.push(`/${locale}/admin/${config.key}`);
  }

  async function upload(name: string, file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    const res = await uploadPhoto(file);
    setBusy(false);
    if (!res.ok) return setNotice({ kind: "error", text: messages[res.key] });
    set(name)(res.url);
  }

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
            <BilingualField
              id={id}
              label={label}
              ja={text(`${f.name}Ja`)}
              en={text(`${f.name}En`)}
              onJa={set(`${f.name}Ja`)}
              onEn={set(`${f.name}En`)}
              multiline={f.kind === "bilingual-long"}
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
      case "select":
      case "route":
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <select id={id} value={text(f.name)} onChange={(e) => set(f.name)(e.target.value)} className={inputClass}>
              {f.kind === "route" ? <option value="">{f.noneLabel ? pick(f.noneLabel, locale) : "—"}</option> : null}
              {(f.kind === "route" ? routes.map((r) => ({ value: r.id, text: r.name })) : (f.options ?? []).map((o) => ({ value: o.value, text: pick(o.label, locale) }))).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.text}
                </option>
              ))}
            </select>
          </Field>
        );
      case "number":
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <NumberInput id={id} integer value={text(f.name) === "" ? null : Number(text(f.name))} onChange={(v) => set(f.name)(v === null ? "" : String(v))} />
          </Field>
        );
      case "date":
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <input id={id} type="date" value={text(f.name)} onChange={(e) => set(f.name)(e.target.value)} aria-invalid={missing.includes(f.name) || undefined} className={`${inputClass} max-w-60`} />
          </Field>
        );
      case "image":
        return (
          <Field key={f.name} label={label} hint={hint} htmlFor={id} required={f.required}>
            <TextInput id={id} value={text(f.name)} onChange={set(f.name)} maxLength={500} placeholder="https://" invalid={missing.includes(f.name)} />
            <label className="tap-target mt-2 inline-flex w-fit cursor-pointer items-center rounded-xl border-2 border-line px-5 text-lg font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent">
              {t`写真をアップロード`}
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => void upload(f.name, e.target.files?.[0])} className="sr-only" />
            </label>
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
      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-xl bg-surface p-4 text-lg font-bold ${notice.kind === "error" ? "text-danger" : "text-moss"}`}>
          {notice.text}
        </p>
      ) : null}

      <Section title={t`内容`}>
        {config.fields.map(input)}
        {editable ? (
          <button type="button" onClick={save} disabled={!canSave} className="tap-target w-fit rounded-xl bg-brand px-6 text-lg font-bold text-on-brand disabled:opacity-50">
            {saved ? t`保存` : t`作成`}
          </button>
        ) : null}
        {editable && missing.length > 0 ? <p className="text-base text-muted">{t`「必須」の欄をすべて入れると保存できます。`}</p> : null}
      </Section>

      {saved && config.ops.delete ? (
        <Section title={t`削除`}>
          <button type="button" onClick={remove} disabled={busy} className="tap-target w-fit rounded-xl border-2 border-danger px-6 text-lg font-bold text-danger disabled:opacity-50">
            {t`削除する`}
          </button>
        </Section>
      ) : null}
      {dialog}
    </div>
  );
}
