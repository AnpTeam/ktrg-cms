// The browser side of "furigana everywhere": finds the page's Japanese text and draws the readings from our own word list
// (furigana-words.json, see furigana-words.ts) over the words that have one. React owns the page's text nodes, so none is
// ever removed or replaced: the original text node is emptied and a <span data-furi> holding the ruby is put beside it.
// When React changes or removes that text, the change is seen here and the span is redrawn or taken away. Switching it
// off puts every text back.

import { wordMatcher, type Part } from "./furigana-words";

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/u;
const SKIP = "script,style,textarea,input,select,ruby,rt,rp,[contenteditable],[data-furi],[data-no-furigana],noscript";

function build(parts: Part[]): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.furi = "";
  for (const p of parts) {
    if (!p.r) {
      span.append(p.t);
      continue;
    }
    const ruby = document.createElement("ruby");
    ruby.append(p.t);
    const open = document.createElement("rp");
    open.textContent = "(";
    const rt = document.createElement("rt");
    rt.textContent = p.r;
    const close = document.createElement("rp");
    close.textContent = ")";
    ruby.append(open, rt, close);
    span.append(ruby);
  }
  return span;
}

/** Starts furigana on the page; returns the function that stops it and restores the text. */
export function startFurigana(root: HTMLElement = document.body): () => void {
  const done = new Map<Text, { original: string; span: HTMLSpanElement }>();
  const drawn = new Map<string, Part[]>(); // a text and how it is cut, kept: the page repeats its texts a lot
  let cut: ((text: string) => Part[]) | null = null;
  let timer: number | undefined;
  let stopped = false;

  const restore = (node: Text) => {
    const d = done.get(node);
    if (!d) return;
    d.span.remove();
    if (node.nodeValue === "") node.nodeValue = d.original;
    done.delete(node);
  };

  const candidates = (): Text[] => {
    const found: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n as Text;
      if (!KANJI.test(text.data) || text.parentElement?.closest(SKIP)) continue;
      found.push(text);
    }
    return found;
  };

  const run = () => {
    if (stopped || !cut) return;
    for (const [node] of done) if (!node.isConnected) restore(node);
    observer.disconnect();
    for (const node of candidates()) {
      let parts = drawn.get(node.data);
      if (!parts) drawn.set(node.data, (parts = cut(node.data)));
      if (!parts.some((p) => p.r) || !node.isConnected) continue;
      const span = build(parts);
      done.set(node, { original: node.data, span });
      node.after(span);
      node.nodeValue = "";
    }
    watch();
  };

  const later = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 250);
  };
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      // A text that React changed is shown again by React: take our copy away and draw it afresh.
      if (r.type === "characterData" && done.has(r.target as Text) && (r.target as Text).data !== "") restore(r.target as Text);
    }
    later();
  });
  const watch = () => observer.observe(root, { childList: true, subtree: true, characterData: true });

  // Wait until the page has finished starting up in the browser: changing text before React has taken it over would break that.
  const begin = () => {
    window.setTimeout(async () => {
      const list = (await import("./furigana-words.json")).default as Record<string, string>;
      cut = wordMatcher(list);
      run();
    }, 1200);
  };
  if (document.readyState === "complete") begin();
  else window.addEventListener("load", begin, { once: true });
  watch();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    observer.disconnect();
    window.removeEventListener("load", begin);
    for (const [node] of [...done]) restore(node);
  };
}
