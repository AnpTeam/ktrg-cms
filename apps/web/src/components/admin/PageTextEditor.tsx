"use client";

import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode } from "@/lib/api-error";
import type { PageKey, PageLang, PageText } from "@/lib/page-text";
import { Field, Section, TextArea, TextInput } from "./fields";
import { RichTextToolbar } from "./RichTextToolbar";
import { AlertIcon, TickIcon, XIcon } from "@/components/icons";

type Lang = "ja" | "en";
type Notice = { kind: "saved" | "error"; text: string } | null;

// 管理 > ページの文章 > one page. Each language has a title and a text. A language that was never written starts from
// the text the app has now, so nothing is typed from nothing; emptying both boxes brings the built-in page back.
export function PageTextEditor({ pageKey, saved, builtIn, locale }: { pageKey: PageKey; saved: PageText | null; builtIn: PageText; locale: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const start = (lang: Lang): PageLang => (saved && (saved[lang].title !== "" || saved[lang].body !== "") ? saved[lang] : builtIn[lang]);
  const [done, setDone] = useState<PageText>(() => ({ ja: start("ja"), en: start("en") }));
  const [text, setText] = useState<PageText>(done);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const dirty = JSON.stringify(text) !== JSON.stringify(done);
  const edit = (lang: Lang, patch: Partial<PageLang>) => {
    setNotice(null);
    setText((cur) => ({ ...cur, [lang]: { ...cur[lang], ...patch } }));
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const names: Record<PageKey, string> = { faq: t`よくあるご質問`, guide: t`遊び方`, terms: t`利用規約`, privacy: t`プライバシーポリシー` };
  const langs: { lang: Lang; name: string }[] = [
    { lang: "ja", name: t`日本語` },
    { lang: "en", name: "English" },
  ];

  async function save() {
    if (!window.confirm(t`この文章は、本番のサイトにすぐ反映されます。保存しますか？`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/admin/settings/pages/${pageKey}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(text),
      });
      const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null;
      if (res.ok && json?.ok === true) {
        setDone(text);
        setNotice({ kind: "saved", text: t`保存しました。サイトに反映されています。` });
      } else setNotice({ kind: "error", text: messages[json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json)] });
    } catch {
      setNotice({ kind: "error", text: messages.network });
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3 lg:-mx-8 lg:px-8">
        <h1 className="min-w-0 flex-1 text-2xl font-bold">{names[pageKey]}</h1>
        <p className="text-base text-muted" aria-live="polite">
          {dirty ? t`保存していない変更があります` : t`保存済み`}
        </p>
        <a href={`/${pageKey}`} target="_blank" rel="noreferrer" className="text-base font-bold text-accent underline underline-offset-4">
          {t`公開サイトで見る`}
        </a>
        <button type="button" onClick={save} disabled={!dirty || busy} className="tap-target rounded-full bg-ink px-8 text-xl font-bold text-paper disabled:opacity-40">
          {busy ? t`保存中…` : t`保存`}
        </button>
        {notice ? (
          <div className={`fixed inset-x-4 top-20 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-2xl border-2 border-white/40 p-4 text-white shadow-2xl ${notice.kind === "error" ? "bg-[#8f1818]" : "bg-[#14532d]"}`}>
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-ink">
              {notice.kind === "error" ? <AlertIcon size={20} /> : <TickIcon size={20} />}
            </span>
            <p role={notice.kind === "error" ? "alert" : "status"} className="min-w-0 flex-1 pt-0.5 text-lg font-bold">
              {notice.text}
            </p>
            <button type="button" onClick={() => setNotice(null)} aria-label={t`閉じる`} className="tap-target shrink-0 rounded-full px-3 hover:bg-white/20">
              <XIcon size={22} />
            </button>
          </div>
        ) : null}
      </div>

      <p role="note" className="rounded-2xl border-2 border-caution bg-paper p-4 text-lg font-bold leading-snug">
        {t`ここは、本番のサイトの文章です。保存すると、すぐにすべての訪問者の画面が変わります。`}
      </p>
      <div className="rounded-2xl bg-surface p-4 text-base leading-7">
        <p className="font-bold">{t`書き方`}</p>
        <ul className="list-disc pl-6">
          <li>{t`段落は、空の行で区切ります。`}</li>
          <li>{t`「## 」で始まる行は、見出しです（よくあるご質問では質問、遊び方では手順の名前）。その下に、本文を書きます。`}</li>
          {pageKey === "guide" ? <li>{t`「---」だけの行から下は、いちばん下の注意書きになります。`}</li> : null}
          <li>{t`リンクは [表示する文字](https://…) の形で書けます（下のボタンでも入れられます）。`}</li>
          {pageKey === "terms" || pageKey === "privacy" ? <li>{t`書きかえると、「案です」の表示や更新日の表示は出なくなります。日付などは、本文に書いてください。`}</li> : null}
          <li>{t`題と本文の両方を空にして保存すると、もとの文章に戻ります。`}</li>
        </ul>
      </div>

      {langs.map(({ lang, name }) => (
        <Section key={lang} title={name}>
          <Field label={t`題`} htmlFor={`${pageKey}-${lang}-title`}>
            <TextInput id={`${pageKey}-${lang}-title`} lang={lang} value={text[lang].title} onChange={(v) => edit(lang, { title: v })} maxLength={200} />
          </Field>
          <Field label={t`本文`} htmlFor={`${pageKey}-${lang}-body`}>
            <RichTextToolbar targetId={`${pageKey}-${lang}-body`} value={text[lang].body} onChange={(v) => edit(lang, { body: v })} />
            <TextArea id={`${pageKey}-${lang}-body`} lang={lang} rows={22} maxLength={30000} value={text[lang].body} onChange={(v) => edit(lang, { body: v })} />
          </Field>
          <button type="button" onClick={() => edit(lang, { title: "", body: "" })} className="tap-target w-fit rounded-full border-2 border-line px-5 text-base font-bold">
            {t`${name}を空にして、もとの文章に戻す`}
          </button>
        </Section>
      ))}
      <p className="text-base text-muted" lang={locale}>
        {t`ほかの言語（ドイツ語など）の訪問者には、English の文章が表示されます。`}
      </p>
    </div>
  );
}
