import { expect, test } from "bun:test";
import { missingTranslations } from "./check-catalogs";

test("finds messages with no English text, ignoring the header and multi-line texts", () => {
  const po = `msgid ""\nmsgstr ""\n"Language: en\\n"\n\n#: a.tsx:1\nmsgid "完了"\nmsgstr "Done"\n\n#: a.tsx:2\nmsgid "未訳"\nmsgstr ""\n\n#: a.tsx:3\nmsgid ""\n"長い"\n"文"\nmsgstr ""\n"A long "\n"text"\n`;
  expect(missingTranslations(po)).toEqual(["未訳"]);
});
