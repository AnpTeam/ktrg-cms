// The browser side of "furigana everywhere": finds the page's Japanese text, asks the API for readings (/api/v1/furigana)
// and draws them. React owns the page's text nodes, so none is ever removed or replaced: the original text node is emptied
// and a <span data-furi> holding the ruby is put beside it. When React changes or removes that text, the change is seen
// here and the span is redrawn or taken away. Switching it off puts every text back.

export interface Part {
  t: string;
  r?: string;
}

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/u;
const SKIP = "script,style,textarea,input,select,ruby,rt,rp,[contenteditable],[data-furi],[data-no-furigana],noscript";
const MAX_KEPT = 1500;
const STORE_KEY = "ktrg-furigana-v1";

const memory = new Map<string, Part[]>();

function loadStored() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as [string, Part[]][];
    for (const [k, v] of stored) memory.set(k, v);
  } catch {
    // storage blocked or damaged: start empty
  }
}
function saveStored() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...memory].slice(-MAX_KEPT)));
  } catch {
    // full or blocked: the in-memory copy still serves this visit
  }
}

async function fetchReadings(texts: string[]): Promise<void> {
  for (let i = 0; i < texts.length; i += 40) {
    const batch = texts.slice(i, i + 40);
    try {
      const res = await fetch("/api/v1/furigana", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts: batch }) });
      const body = (await res.json()) as { ok?: boolean; readings?: Part[][] };
      if (!res.ok || !body.ok || !body.readings) continue;
      batch.forEach((t, j) => memory.set(t, body.readings![j]!));
    } catch {
      // offline or the service is down: the page simply stays without furigana
    }
  }
  saveStored();
}

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
  loadStored();
  const done = new Map<Text, { original: string; span: HTMLSpanElement }>();
  let timer: number | undefined;

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

  const run = async () => {
    for (const [node] of done) if (!node.isConnected) restore(node);
    const nodes = candidates();
    const missing = [...new Set(nodes.map((n) => n.data).filter((t) => t.trim() && t.length <= 400 && !memory.has(t)))];
    if (missing.length > 0) await fetchReadings(missing);
    observer.disconnect();
    for (const node of nodes) {
      const parts = memory.get(node.data);
      if (!parts || !parts.some((p) => p.r) || !node.isConnected) continue;
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
    window.setTimeout(() => {
      run();
    }, 1200);
  };
  if (document.readyState === "complete") begin();
  else window.addEventListener("load", begin, { once: true });
  watch();

  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
    window.removeEventListener("load", begin);
    for (const [node] of [...done]) restore(node);
  };
}
