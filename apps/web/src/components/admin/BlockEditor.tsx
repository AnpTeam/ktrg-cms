"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { JSONContent } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { NodeSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useLingui } from "@lingui/react/macro";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@/components/icons";
import { bodyToDoc, docToBody, moveBlock } from "@/lib/admin/block-doc";
import { isWebUrl } from "@/lib/format";
import { inputClass } from "./fields";
import { PhotoUpload } from "./PhotoUpload";

// A page's text as blocks, like a word processor: what is typed looks like the page, and nobody writes ## or **. The text
// saved is still the site's plain format (lib/admin/block-doc.ts). "＋ 追加" or a "/" on an empty line lists the blocks; the
// blocks move with buttons, not by dragging, so it works the same with a finger (and TipTap's drag handle needs its Yjs
// collaboration packages).

type Kind = "paragraph" | "h2" | "h3" | "list" | "rule" | "photo";
type Panel = { kind: "link"; href: string; bad: boolean } | { kind: "photo" } | { kind: "alt"; alt: string } | null;

const SHOWN =
  "tiptap-page min-h-72 rounded-xl border-2 border-line bg-paper p-4 text-lg leading-8 text-ink [&_a]:font-bold [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-5 [&_h2]:border-l-[6px] [&_h2]:border-accent [&_h2]:pl-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-snug [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-bold [&_hr]:my-6 [&_hr]:border-line [&_img]:my-4 [&_img]:rounded-xl [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_.ProseMirror-selectednode]:outline-4 [&_.ProseMirror-selectednode]:outline-accent";
const BUTTON = "tap-target inline-flex items-center gap-1 rounded-full border-2 border-line bg-paper px-4 text-base font-bold disabled:opacity-40";
const ACTIVE = "border-ink bg-ink text-paper";

/** Where a new block goes: over the empty line the cursor is on, else after the block it is in. */
function place(editor: Editor, block: JSONContent, caret: ((start: number) => void) | null) {
  const { $from } = editor.state.selection;
  const top = $from.depth >= 1;
  const emptyLine = $from.depth === 1 && $from.parent.isTextblock && $from.parent.content.size === 0;
  const start = emptyLine ? $from.before(1) : top ? $from.after(1) : editor.state.selection.to;
  editor.chain().focus().insertContentAt(emptyLine ? { from: start, to: $from.after(1) } : start, block).run();
  caret?.(start);
}

export function BlockEditor({ id, lang, label, value, onChange, closingNote = false }: { id: string; lang: string; label: string; value: string; onChange: (v: string) => void; /** How to play: the line starts the closing note. */ closingNote?: boolean }) {
  const written = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        italic: false,
        orderedList: false,
        strike: false,
        underline: false,
        heading: { levels: [2, 3] },
        link: { openOnClick: false },
      }),
      Image.configure({ allowBase64: false }),
    ],
    content: bodyToDoc(value),
    editorProps: {
      attributes: { id, lang, role: "textbox", "aria-multiline": "true", "aria-label": label, class: SHOWN },
    },
    onUpdate: ({ editor: e }) => {
      const next = docToBody(e.getJSON());
      if (next === written.current) return;
      written.current = next;
      onChange(next);
    },
  });

  // The other way: "back to the original text" and the like change the text from outside.
  useEffect(() => {
    if (!editor || value === written.current) return;
    written.current = value;
    editor.commands.setContent(bodyToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  // Only drawn once the editor exists: its state hook takes the editor it starts with and sees nothing until a transaction.
  return editor ? <Blocks editor={editor} id={id} closingNote={closingNote} /> : <div className={`${SHOWN} animate-pulse`} aria-busy="true" />;
}

function Blocks({ editor, id, closingNote }: { editor: Editor; id: string; closingNote: boolean }) {
  const { t } = useLingui();
  const [panel, setPanel] = useState<Panel>(null);
  const [plusAt, setPlusAt] = useState<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { selection } = e.state;
      const { $from, empty } = selection;
      return {
        style: e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("bulletList") ? "list" : "paragraph",
        bold: e.isActive("bold"),
        link: e.isActive("link"),
        photo: selection instanceof NodeSelection && selection.node.type.name === "image",
        // Both slashes: a Japanese keyboard types the wide one.
        slash: empty && $from.depth === 1 && $from.parent.type.name === "paragraph" && /^[/／]$/.test($from.parent.textContent),
        canUndo: e.can().undo(),
      };
    },
  });

  const items: { kind: Kind; name: string }[] = [
    { kind: "paragraph", name: t`本文` },
    { kind: "h2", name: t`見出し` },
    { kind: "h3", name: t`小見出し` },
    { kind: "list", name: t`箇条書き` },
    { kind: "photo", name: t`写真` },
    { kind: "rule", name: closingNote ? t`線（ここから下は注意書き）` : t`区切りの線` },
  ];
  const slashOpen = state.slash && !dismissed;
  if (!state.slash && dismissed) setDismissed(false);
  const menuOpen = slashOpen || plusAt !== null;

  function add(kind: Kind) {
    setPlusAt(null);
    setActive(0);
    if (state.slash) {
      const { $from } = editor.state.selection;
      editor.chain().deleteRange({ from: $from.start(), to: $from.end() }).run();
    }
    if (kind === "photo") setPanel({ kind: "photo" });
    else if (kind === "rule") place(editor, { type: "horizontalRule" }, (start) => editor.commands.setTextSelection(start + 2));
    else if (kind === "list") place(editor, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] }, (start) => editor.commands.setTextSelection(start + 3));
    else place(editor, kind === "paragraph" ? { type: "paragraph" } : { type: "heading", attrs: { level: kind === "h2" ? 2 : 3 } }, (start) => editor.commands.setTextSelection(start + 1));
  }

  // While the "/" list is open the arrows and Enter belong to it. Capturing: the editor must not see them.
  useEffect(() => {
    if (!slashOpen) return;
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") setActive((i) => (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
      else if (e.key === "Enter") add(items[active]!.kind);
      else if (e.key === "Escape") setDismissed(true);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    dom.addEventListener("keydown", onKey, true);
    return () => dom.removeEventListener("keydown", onKey, true);
  });

  const setStyle = (style: string) => {
    const chain = editor.chain().focus();
    if (style === "list") chain.toggleBulletList().run();
    else {
      if (state.style === "list") chain.toggleBulletList();
      (style === "paragraph" ? chain.setParagraph() : chain.setHeading({ level: style === "h2" ? 2 : 3 })).run();
    }
  };
  const move = (by: -1 | 1) => {
    const tr = moveBlock(editor.state, by);
    if (tr) editor.view.dispatch(tr);
    editor.commands.focus();
  };
  const openPlus = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setActive(0);
    setPlusAt(plusAt ? null : { x: box.left, y: box.bottom + 4 });
  };
  const applyLink = (href: string) => {
    const address = href.trim();
    if (!isWebUrl(address)) return setPanel({ kind: "link", href, bad: true });
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !state.link) chain.insertContent({ type: "text", text: address, marks: [{ type: "link", attrs: { href: address } }] }).run();
    else chain.extendMarkRange("link").setLink({ href: address }).run();
    setPanel(null);
  };
  const addPhoto = (src: string) => {
    place(editor, { type: "image", attrs: { src, alt: "" } }, (start) => editor.commands.setNodeSelection(start));
    setPanel({ kind: "alt", alt: "" });
  };

  // Under the caret for "/", under the button for "＋"; above the caret when there is no room below it.
  const caret = slashOpen ? editor.view.coordsAtPos(editor.state.selection.from) : null;
  const at = plusAt ?? (caret ? { x: caret.left, y: caret.bottom + 4 } : null);
  const room = typeof window === "undefined" ? 0 : window.innerHeight;

  return (
    <div className="flex flex-col gap-2">
      <div role="toolbar" aria-label={t`文章の書式`} aria-controls={id} className="sticky top-[4.75rem] z-10 flex flex-wrap items-center gap-2 bg-paper py-1">
        <button type="button" onClick={openPlus} aria-haspopup="menu" aria-expanded={menuOpen} className={`${BUTTON} border-ink`}>
          <PlusIcon size={20} />
          {t`追加`}
        </button>
        <select aria-label={t`この行の種類`} value={state.style} onChange={(e) => setStyle(e.target.value)} className="tap-target rounded-xl border-2 border-line bg-paper px-3 text-base font-bold">
          {items.slice(0, 4).map((item) => (
            <option key={item.kind} value={item.kind}>
              {item.name}
            </option>
          ))}
        </select>
        <button type="button" aria-pressed={state.bold} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} className={`${BUTTON} ${state.bold ? ACTIVE : ""}`}>
          {t`太字`}
        </button>
        <button
          type="button"
          aria-pressed={state.link}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPanel(panel?.kind === "link" ? null : { kind: "link", href: state.link ? String(editor.getAttributes("link").href ?? "") : "", bad: false })}
          className={`${BUTTON} ${state.link ? ACTIVE : ""}`}
        >
          {t`リンク`}
        </button>
        {state.photo ? (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setPanel({ kind: "alt", alt: String(editor.getAttributes("image").alt ?? "") })} className={BUTTON}>
            {t`写真の説明`}
          </button>
        ) : null}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => move(-1)} className={BUTTON}>
          <ChevronUpIcon size={20} />
          {t`上へ`}
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => move(1)} className={BUTTON}>
          <ChevronDownIcon size={20} />
          {t`下へ`}
        </button>
        <button type="button" disabled={!state.canUndo} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().undo().run()} className={BUTTON}>
          {t`元に戻す`}
        </button>
      </div>

      {panel ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3">
          {panel.kind === "link" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="url"
                  autoFocus
                  aria-label={t`リンク先のアドレス`}
                  placeholder="https://…"
                  value={panel.href}
                  onChange={(e) => setPanel({ kind: "link", href: e.target.value, bad: false })}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault(); // this box sits inside the page's form
                    applyLink(panel.href);
                  }}
                  className={`${inputClass} min-w-0 flex-1 basis-60`}
                />
                <button type="button" onClick={() => applyLink(panel.href)} className={`${BUTTON} ${ACTIVE}`}>
                  {t`入れる`}
                </button>
                {state.link ? (
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().extendMarkRange("link").unsetLink().run();
                      setPanel(null);
                    }}
                    className={BUTTON}
                  >
                    {t`リンクを外す`}
                  </button>
                ) : null}
                <button type="button" onClick={() => setPanel(null)} className={BUTTON}>
                  {t`閉じる`}
                </button>
              </div>
              {panel.bad ? (
                <p role="alert" className="text-base font-bold text-danger">
                  {t`https:// で始まるアドレスを入れてください。`}
                </p>
              ) : null}
            </>
          ) : panel.kind === "photo" ? (
            <div className="flex flex-wrap items-start gap-2">
              <PhotoUpload onUploaded={addPhoto} />
              <button type="button" onClick={() => setPanel(null)} className={BUTTON}>
                {t`閉じる`}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                aria-label={t`写真の説明`}
                placeholder={t`写真の説明（目の見えにくい方に読み上げられます）`}
                value={panel.alt}
                onChange={(e) => {
                  setPanel({ kind: "alt", alt: e.target.value });
                  editor.commands.updateAttributes("image", { alt: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  setPanel(null);
                }}
                className={`${inputClass} min-w-0 flex-1 basis-60`}
              />
              <button type="button" onClick={() => setPanel(null)} className={BUTTON}>
                {t`閉じる`}
              </button>
            </div>
          )}
        </div>
      ) : null}

      <EditorContent editor={editor} />
      <p className="text-base text-muted">{t`「追加」か、空の行で「/」を押すと、入れられるものの一覧が出ます。`}</p>

      {menuOpen && at ? (
        <>
          {plusAt ? <div className="fixed inset-0 z-30" onClick={() => setPlusAt(null)} /> : null}
          <ul role="menu" aria-label={t`追加するもの`} style={{ left: at.x, ...(at.y + 340 > room ? { bottom: room - at.y + 44 } : { top: at.y }) }} className="fixed z-40 flex w-64 flex-col gap-1 rounded-xl border-2 border-line bg-paper p-2 shadow-xl">
            {items.map((item, i) => (
              <li key={item.kind} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(item.kind)}
                  className={`tap-target w-full rounded-lg px-3 text-left text-lg font-bold ${i === active ? "bg-surface" : ""}`}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
