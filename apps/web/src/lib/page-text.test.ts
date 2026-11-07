import { helpContent } from "./help-content";
import { helpWith, ownText, policyWith, termsWith } from "./page-content";
import { describe, expect, test } from "bun:test";
import { parsePageBody, writePageBody } from "./page-text";

const body = "Opening one.\n\nOpening two.\n\n## Question A\nAnswer A1.\n\nAnswer A2.\n\n## Question B\nAnswer B.\n\n---\nClosing note.";

describe("page text", () => {
  test("reads the opening, the sections and the closing note", () => {
    expect(parsePageBody(body, true)).toEqual({
      lead: ["Opening one.", "Opening two."],
      sections: [
        { heading: "Question A", paragraphs: ["Answer A1.", "Answer A2."] },
        { heading: "Question B", paragraphs: ["Answer B."] },
      ],
      note: ["Closing note."],
    });
  });

  test("writing it back and reading again gives the same document", () => {
    expect(parsePageBody(writePageBody(parsePageBody(body, true)), true)).toEqual(parsePageBody(body, true));
  });

  test("a body with no heading is all opening text, and CRLF line ends are fine", () => {
    expect(parsePageBody("One.\r\n\r\nTwo.")).toEqual({ lead: ["One.", "Two."], sections: [], note: [] });
  });
});

describe("page content (the public pages and the live preview)", () => {
  const text = { ja: { title: "題", body: "はじめに\n\n## 一\n答え\n\n---\n注意" }, en: { title: "", body: "" } };

  test("a language with no title or body falls back to the built-in page", () => {
    expect(ownText(text, "ja")?.title).toBe("題");
    expect(ownText(text, "en")).toBeNull();
    expect(ownText(null, "ja")).toBeNull();
    expect(helpWith("en", null, ownText(text, "en")).faqTitle).toBe(helpContent("en").faqTitle);
    expect(termsWith(ownText(text, "en")).builtIn).toBe(true);
  });

  test("typed text fills the page's own shape", () => {
    const own = ownText(text, "ja", true);
    expect(helpWith("ja", own, null).steps).toEqual([{ title: "一", text: "答え" }]);
    expect(helpWith("ja", own, null).guideNote).toBe("注意");
    expect(helpWith("ja", null, own).faqs).toEqual([{ question: "一", answer: "答え" }]);
    expect(termsWith(own)).toMatchObject({ lead: "", intro: ["はじめに"], builtIn: false, updated: null });
    expect(policyWith("ja", own).draftNotice).toBe("");
  });
});

test("a card stays whole across its blank lines, and steps stay together", () => {
  const doc = parsePageBody(":::card 題\n一\n\n二\n:::\n\n:::step あ\n一\n:::\n\n:::step い\n二\n:::\n\n後");
  expect(doc.lead).toEqual([":::card 題\n一\n\n二\n:::", ":::step あ\n一\n:::\n\n:::step い\n二\n:::", "後"]);
});
