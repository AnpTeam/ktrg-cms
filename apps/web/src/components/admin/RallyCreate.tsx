"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import type { AdminRallyCourse, AdminRallyKind, AdminRallyPlace } from "@/lib/admin/types";
import type { Translations } from "@/lib/admin/content-locales";
import { MultilingualField, Section } from "./fields";
import { RallyMemberPicker } from "./RallyMemberPicker";

// A new rally: choose how it is made (places or courses: fixed afterwards), name it, tick what is in it, save once.
// It is saved as a draft; it is published from its own page.
export function RallyCreate({
  places,
  courses,
  routeNames,
  locale,
}: {
  places: AdminRallyPlace[];
  courses: AdminRallyCourse[];
  routeNames: Record<string, string>;
  locale: string;
}) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const router = useRouter();
  const [kind, setKind] = useState<AdminRallyKind>("course");
  const [nameJa, setNameJa] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [translations, setTranslations] = useState<Translations>({});
  const [picked, setPicked] = useState<Record<AdminRallyKind, string[]>>({ places: [], course: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (nameJa.trim() === "") return;
    setBusy(true);
    setError(null);
    const members = kind === "places" ? { spotIds: picked.places } : { routeIds: picked.course };
    const res = await outcome(api.admin.rallies.post({ kind, nameJa, nameEn: nameEn.trim() || null, translations, ...members }));
    setBusy(false);
    if (!res.ok) return setError(messages[res.key]);
    router.push(`/admin/rallies/${res.data.rally.id}`);
  }

  const choice = (value: AdminRallyKind, title: string, text: string) => (
    <label className={`tap-target flex flex-1 cursor-pointer flex-col gap-1 rounded-2xl border-2 p-4 ${kind === value ? "border-brand bg-paper" : "border-line"}`}>
      <span className="flex items-center gap-3 text-xl font-bold">
        <input type="radio" name="rally-kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="size-6 accent-[var(--color-brand)]" />
        {title}
      </span>
      <span className="text-base text-muted">{text}</span>
    </label>
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">{t`新しいラリー`}</h1>
      {error ? (
        <p role="alert" className="rounded-xl bg-surface p-4 text-lg font-bold text-danger">
          {error}
        </p>
      ) : null}

      <Section title={t`つくり方`}>
        <div className="flex flex-col gap-3 sm:flex-row">
          {choice("course", t`コースでつくる`, t`えらんだコースを全部歩き終えると達成。コースはスタンプの経由地を全部押すと完了。`)}
          {choice("places", t`経由地でつくる`, t`えらんだ経由地のスタンプを全部押すと達成（経塚のラリーなど）。`)}
        </div>
        <p className="text-base text-muted">{t`つくり方は、あとから変えられません。`}</p>
      </Section>

      <Section title={t`名前`}>
        <MultilingualField id="new-rally-name" label={t`ラリーの名前`} field="name" ja={nameJa} en={nameEn} translations={translations} onJa={setNameJa} onEn={setNameEn} onTranslations={setTranslations} required invalid={nameJa.trim() === ""} />
      </Section>

      <Section title={kind === "course" ? t`ラリーに入れるコース` : t`ラリーに入れる経由地`}>
        <RallyMemberPicker
          candidates={kind === "course" ? { kind: "course", items: courses } : { kind: "places", items: places }}
          selected={picked[kind]}
          onChange={(ids) => setPicked((p) => ({ ...p, [kind]: ids }))}
          routeNames={routeNames}
          locale={locale}
          disabled={busy}
        />
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || nameJa.trim() === ""}
          className="tap-target rounded-xl bg-ink px-6 text-lg font-bold text-paper disabled:opacity-50"
        >
          {busy ? t`作っています…` : t`下書きとして作る`}
        </button>
        <p className="text-base text-muted">{t`公開は、作ったあとのラリーの画面からできます。`}</p>
      </div>
    </div>
  );
}
