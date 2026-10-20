import type { ListItem, ListMeta } from "./config";

// What the generic form holds and sends. The form keeps text ("" for empty) and ticks; the API takes null for an
// empty optional field, trimmed text and numbers. Read-only fields are shown, never sent. Pure, so it is
// unit-tested (form.test.ts).

export type FormValues = Record<string, string | boolean>;

/** The API field names one config field stands for. */
export function apiNames(config: ListMeta): string[] {
  return sent(config).flatMap((f) => (f.kind === "bilingual" || f.kind === "bilingual-long" ? [`${f.name}Ja`, `${f.name}En`] : [f.name]));
}

/** The fields the form sends (not the read-only ones). */
const sent = (config: ListMeta) => config.fields.filter((f) => !f.readOnly);

/** The form's starting values: an existing row, or an empty one (not public, no route). */
export function formValues(config: ListMeta, item: ListItem | null): FormValues {
  const out: FormValues = {};
  for (const f of sent(config)) {
    if (f.kind === "boolean") out[f.name] = item?.[f.name] === true;
    else if (f.kind === "select" && !item) out[f.name] = f.options?.[0]?.value ?? "";
    else for (const name of apiNames({ ...config, fields: [f] })) {
      const v = item?.[name];
      out[name] = typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
    }
  }
  return out;
}

/** Every field as the API takes it: trimmed text, null for an empty English, link, day or route. */
export function toPayload(config: ListMeta, values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const text = (name: string) => String(values[name] ?? "").trim();
  for (const f of sent(config)) {
    switch (f.kind) {
      case "bilingual":
      case "bilingual-long":
        out[`${f.name}Ja`] = text(`${f.name}Ja`);
        out[`${f.name}En`] = text(`${f.name}En`) || null;
        break;
      case "boolean":
        out[f.name] = values[f.name] === true;
        break;
      case "number":
      case "decimal":
        out[f.name] = text(f.name) === "" ? null : Number(text(f.name));
        break;
      default:
        out[f.name] = text(f.name) || (f.required ? "" : null);
    }
  }
  return out;
}

/** Only what differs from the saved row, for a PATCH. */
export function changedFields(config: ListMeta, values: FormValues, saved: ListItem): Record<string, unknown> {
  const now = toPayload(config, values);
  const before = toPayload(config, formValues(config, saved));
  return Object.fromEntries(Object.entries(now).filter(([k, v]) => v !== before[k]));
}

/** The required fields that are still empty (Japanese, for a bilingual field). */
export function missingRequired(config: ListMeta, values: FormValues): string[] {
  return sent(config)
    .filter((f) => f.required)
    .filter((f) => String(values[f.kind === "bilingual" || f.kind === "bilingual-long" ? `${f.name}Ja` : f.name] ?? "").trim() === "")
    .map((f) => f.name);
}
