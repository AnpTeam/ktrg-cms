import { describe, expect, test } from "bun:test";
import { fillEmpty, hasConflictMarkers, mergeCatalogs, translationsOf } from "./resolve-catalogs-lib";

const header = 'msgid ""\nmsgstr ""\n"Language: en\\n"';
const po = (...blocks: string[]) => [header, ...blocks].join("\n\n") + "\n";

describe("translationsOf", () => {
  test("reads the translated messages, with continuation lines, and skips the header and the empty ones", () => {
    const text = po('#: a.tsx:1\nmsgid "はい"\nmsgstr "Yes"', '#: b.tsx:2\nmsgid ""\n"長い"\n"文"\nmsgstr ""\n"A long"\n" sentence"', 'msgid "未"\nmsgstr ""');
    const got = translationsOf(text);
    expect([...got.keys()]).toEqual(['msgid "はい"', 'msgid ""\n"長い"\n"文"']);
    expect(got.get('msgid ""\n"長い"\n"文"')).toEqual(['msgstr ""', '"A long"', '" sentence"']);
  });

  test("reads Windows line endings too", () => {
    expect(translationsOf('msgid "はい"\r\nmsgstr "Yes"\r\n').get('msgid "はい"')).toEqual(['msgstr "Yes"']);
  });
});

describe("fillEmpty", () => {
  const known = translationsOf(po('msgid "新しい"\nmsgstr "New"', 'msgid "古い"\nmsgstr "Old (mine)"'));

  test("fills an empty msgstr from the known translation, keeps the comments, and counts", () => {
    const target = po('#: x.tsx:9\nmsgid "新しい"\nmsgstr ""', 'msgid "古い"\nmsgstr "Old (main)"', 'msgid "他"\nmsgstr ""');
    const { text, filled } = fillEmpty(target, known);
    expect(filled).toBe(1);
    expect(text).toContain('#: x.tsx:9\nmsgid "新しい"\nmsgstr "New"');
    expect(text).toContain('msgstr "Old (main)"'); // a translation already there is not replaced
    expect(text).toContain('msgid "他"\nmsgstr ""'); // nothing known for it: stays empty (check:catalogs reports it)
  });
});

describe("hasConflictMarkers", () => {
  test("finds the markers git leaves, not text that merely contains arrows", () => {
    expect(hasConflictMarkers('a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> main\n')).toBe(true);
    expect(hasConflictMarkers('msgid "a <<<<<<< b"\nmsgstr "x"\n')).toBe(false);
  });
});

describe("mergeCatalogs", () => {
  const m = (...blocks: string[]) => po(...blocks);
  const base = m('msgid "共通"\nmsgstr "Common"', 'msgid "消える"\nmsgstr "Gone"');
  const theirs = m('msgid "共通"\nmsgstr "Common"', 'msgid "主"\nmsgstr ""'); // main: dropped 消える, added 主 (not translated yet)
  const ours = m('msgid "共通"\nmsgstr "Common"', 'msgid "消える"\nmsgstr "Gone"', 'msgid "枝"\nmsgstr "Branch"', 'msgid "主"\nmsgstr "Main (mine)"');

  test("keeps main's messages, adds the branch's new ones, does not bring back what main dropped, fills English", () => {
    const out = mergeCatalogs(base, ours, theirs);
    expect(out).toContain('msgid "枝"\nmsgstr "Branch"');
    expect(out).toContain('msgid "主"\nmsgstr "Main (mine)"');
    expect(out).not.toContain("消える");
    expect(out.match(/msgid "共通"/g)).toHaveLength(1);
    expect(hasConflictMarkers(out)).toBe(false);
  });
});
