import { describe, expect, test } from "bun:test";
import { parsePageBody, writePageBody } from "./page-text";

const body = "Opening one.\n\nOpening two.\n\n## Question A\nAnswer A1.\n\nAnswer A2.\n\n## Question B\nAnswer B.\n\n---\nClosing note.";

describe("page text", () => {
  test("reads the opening, the sections and the closing note", () => {
    expect(parsePageBody(body)).toEqual({
      lead: ["Opening one.", "Opening two."],
      sections: [
        { heading: "Question A", paragraphs: ["Answer A1.", "Answer A2."] },
        { heading: "Question B", paragraphs: ["Answer B."] },
      ],
      note: ["Closing note."],
    });
  });

  test("writing it back and reading again gives the same document", () => {
    expect(parsePageBody(writePageBody(parsePageBody(body)))).toEqual(parsePageBody(body));
  });

  test("a body with no heading is all opening text, and CRLF line ends are fine", () => {
    expect(parsePageBody("One.\r\n\r\nTwo.")).toEqual({ lead: ["One.", "Two."], sections: [], note: [] });
  });
});
