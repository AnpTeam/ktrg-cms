import { describe, expect, test } from "bun:test";
import { homeTextIn, parseHomeText, writeHomeText } from "./home-text";

describe("home page words", () => {
  test("survive being written and read", () => {
    const text = { heroLine: "言葉", before1: "一行目\n二行目" };
    expect(parseHomeText(writeHomeText(text))).toEqual(text);
    expect(writeHomeText({})).toBe("");
  });

  test("anything else in the store is ignored", () => {
    expect(parseHomeText("")).toEqual({});
    expect(parseHomeText("not json")).toEqual({});
    expect(parseHomeText("null")).toEqual({});
    expect(parseHomeText('{"heroLine":3,"nope":"x","rallyLead":"ok"}')).toEqual({ rallyLead: "ok" });
  });

  test("the editor keeps spaces; the visitor's page does not show an empty box", () => {
    expect(parseHomeText('{"heroLine":"two "}')).toEqual({ heroLine: "two " });
    const page = { ja: { title: "", body: '{"heroLine":" 言葉 ","rallyLead":"   "}' }, en: { title: "", body: "" } };
    expect(homeTextIn(page, "ja")).toEqual({ heroLine: "言葉" });
    expect(homeTextIn(page, "en")).toEqual({});
    expect(homeTextIn(null, "ja")).toEqual({});
  });
});
