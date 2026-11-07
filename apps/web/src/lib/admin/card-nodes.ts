import { Node } from "@tiptap/core";

// A card in the block editor: a title line, then its text. The look is added by BlockEditor; these are the rules of the
// document, kept here so the tests use the same ones.

/** The plain title of a card. Enter goes on to the card's text, as a title has only one line. */
export const CardTitle = Node.create({
  name: "cardTitle",
  content: "text*",
  marks: "",
  defining: true,
  parseHTML: () => [{ tag: "div[data-card-title]" }],
  renderHTML: () => ["div", { "data-card-title": "" }, 0],
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        return $from.parent.type.name === "cardTitle" && editor.commands.setTextSelection($from.after() + 1);
      },
    };
  },
});

export const PageCard = Node.create({
  name: "pageCard",
  group: "block",
  content: "cardTitle (paragraph | bulletList | image)+",
  defining: true,
  isolating: true,
  addAttributes: () => ({ kind: { default: "card" } }),
  parseHTML: () => [{ tag: "div[data-card]" }],
  renderHTML: () => ["div", { "data-card": "" }, 0],
});
