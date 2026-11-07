"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { NodeSelection } from "@tiptap/pm/state";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type Editor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useLingui } from "@lingui/react/macro";
import { ChevronDownIcon, ChevronUpIcon, ImageIcon, LinkIcon, ListIcon, PlusIcon, TrashIcon, UndoIcon } from "@/components/icons";
import { bodyToDoc, docToBody, moveBlock } from "@/lib/admin/block-doc";
import { isWebUrl } from "@/lib/format";
import { inputClass } from "./fields";
import { PhotoUpload } from "./PhotoUpload";

// A page's text as blocks, like a word processor: what is typed looks like the page, and nobody writes ## or **. The text
// saved is still the site's plain format (lib/admin/block-doc.ts). "＋ 追加" or a "/" on an empty line lists the blocks; the
// blocks move with buttons, not by dragging, so it works the same with a finger (and TipTap's drag handle needs its Yjs
// collaboration packages).

type Kind = "paragraph" | "h2" | "h3" | "list" | "rule" | "photo";
type Panel = { kind: "link"; href: string; bad: boolean } | { kind: "photo" } | null;

const SHOWN =
  "tiptap-page min-h-72 rounded-xl border-2 border-line bg-paper p-4 text-lg leading-8 text-ink [&_a]:font-bold [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-5 [&_h2]:border-l-[6px] [&_h2]:border-accent [&_h2]:pl-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-snug [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-bold [&_hr]:my-6 [&_hr]:border-line [&_img]:my-4 [&_img]:rounded-xl [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_.ProseMirror-selectednode]:outline-4 [&_.ProseMirror-selectednode]:outline-accent";
const BUTTON = "tap-target inline-flex items-center gap-1 rounded-full border-2 border-line bg-paper px-4 text-base font-bold disabled:opacity-40";
const ACTIVE = "border-ink bg-ink text-paper";

/** A photo in the text, its description right under it: nobody has to look for a button or scroll to write one. */
function PhotoBlock({ node, selected, updateAttributes, deleteNode, editor, getPos }: NodeViewProps) {
  const { t } = useLingui();
  const box = useRef<HTMLInputElement>(null);
  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  // A photo just added, or chosen with nothing written yet, goes straight to its description.
  useEffect(() => {
    if (selected && !alt) box.current?.focus();
    // Only when it becomes selected: emptying the box must not pull the caret back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  // The picture arrives after the box has the focus, and pushes it down.
  const keepBoxInView = () => {
    if (document.activeElement === box.current) box.current?.scrollIntoView({ block: "center" });
  };
  return (
    <NodeViewWrapper className="relative my-3 flex w-fit max-w-full flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- the editor's own picture: any uploaded link, shown as it is */}
      <img src={src} alt={alt} onLoad={keepBoxInView} className="max-h-[50dvh] w-auto max-w-full self-start" />
      <button type="button" onClick={deleteNode} aria-label={t`写真を消す`} className="tap-target absolute right-2 top-2 inline-grid place-items-center rounded-full bg-paper text-ink shadow">
        {/* The click must land on the button itself: the editor only leaves a button alone, not an icon inside it. */}
        <span className="pointer-events-none">
          <TrashIcon />
        </span>
      </button>
      <input
        ref={box}
        aria-label={t`写真の説明`}
        placeholder={t`写真の説明（目の見えにくい方に読み上げられます）`}
        value={alt}
        onChange={(e) => updateAttributes({ alt: e.target.value })}
        onFocus={() => {
          const at = getPos();
          if (typeof at === "number") editor.commands.setNodeSelection(at); // so 上へ and 下へ move this photo
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault(); // this box sits inside the page's form
          editor.commands.focus();
        }}
        className={inputClass}
      />
    </NodeViewWrapper>
  );
}

const Photo = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PhotoBlock);
  },
});

/** One button of the toolbar: an icon, with its name for screen readers and in a tooltip of our own. */
function Tool({ name, pressed, disabled, onClick, children }: { name: string; pressed?: boolean; disabled?: boolean; onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`group tap-target relative inline-grid place-items-center rounded-full text-lg font-bold disabled:opacity-40 ${pressed ? "bg-ink text-paper" : "hover:bg-surface"}`}
    >
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-base font-bold text-paper group-hover:block group-focus-visible:block">
        {name}
      </span>
    </button>
  );
}

const GAP = <span aria-hidden="true" className="mx-1 h-7 w-px bg-line" />;

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
      Photo.configure({ allowBase64: false }),
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
        style: selection instanceof NodeSelection ? null : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("bulletList") ? "list" : "paragraph",
        bold: e.isActive("bold"),
        link: e.isActive("link"),
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
    setPanel(null);
  };

  // Under the caret for "/", under the button for "＋"; above the caret when there is no room below it.
  const caret = slashOpen ? editor.view.coordsAtPos(editor.state.selection.from) : null;
  const at = plusAt ?? (caret ? { x: caret.left, y: caret.bottom + 4 } : null);
  const room = typeof window === "undefined" ? 0 : window.innerHeight;

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-[4.75rem] z-10 flex flex-col gap-2">
        <div role="toolbar" aria-label={t`文章の書式`} aria-controls={id} className="flex flex-wrap items-center gap-1 rounded-xl border-2 border-line bg-paper p-1">
          <Tool name={t`追加`} pressed={menuOpen} onClick={openPlus}>
            <PlusIcon size={24} />
          </Tool>
          {GAP}
          {items.slice(0, 4).map((item) => (
            <Tool key={item.kind} name={item.name} pressed={state.style === item.kind} onClick={() => setStyle(item.kind)}>
              {item.kind === "list" ? <ListIcon /> : { paragraph: "¶", h2: "H2", h3: "H3" }[item.kind as string]}
            </Tool>
          ))}
          {GAP}
          <Tool name={t`太字`} pressed={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <span className="text-xl font-black">B</span>
          </Tool>
          <Tool name={t`リンク`} pressed={state.link} onClick={() => setPanel(panel?.kind === "link" ? null : { kind: "link", href: state.link ? String(editor.getAttributes("link").href ?? "") : "", bad: false })}>
            <LinkIcon />
          </Tool>
          <Tool name={t`写真`} pressed={panel?.kind === "photo"} onClick={() => setPanel(panel?.kind === "photo" ? null : { kind: "photo" })}>
            <ImageIcon />
          </Tool>
          {GAP}
          <Tool name={t`上へ`} onClick={() => move(-1)}>
            <ChevronUpIcon size={24} />
          </Tool>
          <Tool name={t`下へ`} onClick={() => move(1)}>
            <ChevronDownIcon size={24} />
          </Tool>
          {GAP}
          <Tool name={t`元に戻す`} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
            <UndoIcon />
          </Tool>
        </div>

        {panel ? (
          <div className="flex flex-col gap-2 rounded-xl border-2 border-line bg-surface p-3 shadow-lg">
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
            ) : (
              <div className="flex flex-wrap items-start gap-2">
                <PhotoUpload onUploaded={addPhoto} />
                <button type="button" onClick={() => setPanel(null)} className={BUTTON}>
                  {t`閉じる`}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

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
