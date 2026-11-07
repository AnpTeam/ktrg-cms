"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode } from "@/lib/api-error";
import type { PageKey, PageLang, PageText } from "@/lib/page-text";
import { BlockEditorLoader } from "./BlockEditorLoader";
import { Field, Section, TextInput } from "./fields";
import { HomeTextFields } from "./HomeTextFields";
import { PagePreview, type HomeData } from "./PagePreview";

import { confirmDialog } from "@/components/ConfirmDialog";
import { showToast } from "@/lib/admin/toast";

type Lang = "ja" | "en";

// 管理 > ページの文章 > one page. Each language has a title and a text. A language that was never written starts from
// the text the app has now, so nothing is typed from nothing; emptying both boxes brings the built-in page back.
export function PageTextEditor({ pageKey, saved, builtIn, locale, home }: { pageKey: PageKey; saved: PageText | null; home?: HomeData; builtIn: PageText; locale: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const start = (lang: Lang): PageLang => (saved && (saved[lang].title !== "" || saved[lang].body !== "") ? saved[lang] : builtIn[lang]);
  const [done, setDone] = useState<PageText>(() => ({ ja: start("ja"), en: start("en") }));
  const [text, setText] = useState<PageText>(done);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(text) !== JSON.stringify(done);
  const edit = (lang: Lang, patch: Partial<PageLang>) => {
    showToast(null);
    setText((cur) => ({ ...cur, [lang]: { ...cur[lang], ...patch } }));
  };

  useUnsavedGuard(dirty);

  const names: Record<PageKey, string> = { home: t`ホーム`, faq: t`よくあるご質問`, guide: t`遊び方`, terms: t`利用規約`, privacy: t`プライバシーポリシー` };
  const langs: { lang: Lang; name: string }[] = [
    { lang: "ja", name: t`日本語` },
    { lang: "en", name: "English" },
  ];

  async function save() {
    if (!(await confirmDialog({ title: t`サイトに反映しますか？`, body: t`この文章は、本番のサイトにすぐ反映されます。保存しますか？`, yes: t`保存する` }))) return;
    setBusy(true);
    showToast(null);
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
        showToast({ kind: "ok", text: t`保存しました。サイトに反映されています。` });
      } else showToast({ kind: "error", text: messages[json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json)] });
    } catch {
      showToast({ kind: "error", text: messages.network });
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
        <a href={pageKey === "home" ? "/" : `/${pageKey}`} target="_blank" rel="noreferrer" className="text-base font-bold text-accent underline underline-offset-4">
          {t`公開サイトで見る`}
        </a>
        <button type="button" onClick={save} disabled={!dirty || busy} className="tap-target rounded-full bg-ink px-8 text-xl font-bold text-paper disabled:opacity-40">
          {busy ? t`保存中…` : t`保存`}
        </button>
      </div>

      <p role="note" className="rounded-2xl border-2 border-caution bg-paper p-4 text-lg font-bold leading-snug">
        {t`ここは、本番のサイトの文章です。保存すると、すぐにすべての訪問者の画面が変わります。`}
      </p>
      {pageKey === "home" ? (
        <p className="rounded-2xl bg-surface p-4 text-base leading-7">{t`空の欄には、もとの文章が表示されます。写真はバナー、コースはルート、お知らせはお知らせの画面で変えられます。`}</p>
      ) : (
      <div className="rounded-2xl bg-surface p-4 text-base leading-7">
        <p className="font-bold">{t`書き方`}</p>
        <ul className="list-disc pl-6">
          <li>{t`見出しは、よくあるご質問では質問、遊び方では手順の名前になります。その下に、本文を書きます。`}</li>
          {pageKey === "guide" ? <li>{t`線から下は、いちばん下の注意書きになります。`}</li> : null}
          {pageKey === "terms" || pageKey === "privacy" ? <li>{t`書きかえると、「案です」の表示や更新日の表示は出なくなります。日付などは、本文に書いてください。`}</li> : null}
          <li>{t`題と本文の両方を空にして保存すると、もとの文章に戻ります。`}</li>
        </ul>
      </div>
      )}

      {/* Only the home page: it is boxes. The block editor already looks like the page. */}
      <div className={pageKey === "home" ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" : ""}>
      <div className="flex min-w-0 flex-col gap-5">
      {langs.map(({ lang, name }) => pageKey === "home" ? (
        <HomeTextFields key={lang} lang={lang} title={name} body={text[lang].body} showBuiltIn={lang === (locale === "en" ? "en" : "ja")} onBody={(body) => edit(lang, { body })} />
      ) : (
        <Section key={lang} title={name}>
          <Field label={t`題`} htmlFor={`${pageKey}-${lang}-title`}>
            <TextInput id={`${pageKey}-${lang}-title`} lang={lang} value={text[lang].title} onChange={(v) => edit(lang, { title: v })} maxLength={200} />
          </Field>
          <Field label={t`本文`} htmlFor={`${pageKey}-${lang}-body`}>
            <BlockEditorLoader id={`${pageKey}-${lang}-body`} lang={lang} label={`${name} ${t`本文`}`} value={text[lang].body} onChange={(v) => edit(lang, { body: v })} look={pageKey === "faq" || pageKey === "guide" ? pageKey : undefined} />
          </Field>
          <button type="button" onClick={() => edit(lang, { title: "", body: "" })} className="tap-target w-fit rounded-full border-2 border-line px-5 text-base font-bold">
            {t`${name}を空にして、もとの文章に戻す`}
          </button>
        </Section>
      ))}
      </div>
      {pageKey === "home" ? (
        <div className="lg:sticky lg:top-24 lg:self-start">
          <PagePreview text={text} locale={locale} home={home} />
        </div>
      ) : null}
      </div>
      <p className="text-base text-muted" lang={locale}>
        {t`ほかの言語（ドイツ語など）の訪問者には、English の文章が表示されます。`}
      </p>
    </div>
  );
}
