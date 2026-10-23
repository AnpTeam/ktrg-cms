import { expect, test } from "bun:test";
import { parseRich } from "./rich-text";
import { nextNote, withFootnote, withLink } from "./rich-text-edit";

test("a link wraps the selected words and selects the address", () => {
  const r = withLink("see the shrine here", 8, 14);
  expect(r.text).toBe("see the [shrine](https://) here");
  expect(r.text.slice(...r.select)).toBe("https://");
  expect(withLink("", 0, 0).text).toBe("[リンクの文字](https://)");
});

test("a footnote adds [^n] at the cursor and a note line at the end, numbered after the ones there", () => {
  expect(nextNote("a[^1] b[^3]")).toBe(4);
  expect(nextNote("plain")).toBe(1);
  const r = withFootnote("A day walk.", 5);
  expect(r.text).toBe("A day[^1] walk.\n[^1]: ");
  expect(r.select).toEqual([r.text.length, r.text.length]);
  expect(withFootnote("x[^1]\n[^1]: one", 1).text).toContain("[^2]");
});

test("what the buttons write is read back as a link and a note by the page", () => {
  const link = parseRich(withLink("go", 0, 2).text.replace("https://", "https://example.com"));
  expect(link.body).toContainEqual({ href: "https://example.com", label: "go" });
  const note = parseRich(withFootnote("fact", 4).text + "the source");
  expect(note.notes).toHaveLength(1);
  expect(note.body).toContainEqual({ note: 1 });
});
