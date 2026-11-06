import { describe, expect, test } from "bun:test";
import { initialState, type NavState } from "./session";
import { cueText, emptyCueMemory, nextCue, speaksByDefault, type CueMemory } from "./voice";

const st = (over: Partial<NavState>): NavState => ({ ...initialState(), targetId: "a", ...over });
const run = (states: NavState[]) => {
  let mem: CueMemory = emptyCueMemory();
  return states.map((s) => {
    const r = nextCue(mem, s);
    mem = r.mem;
    return r.cue?.kind ?? null;
  });
};
const turn = (inM: number) => st({ turn: { kind: "left", inM } });

describe("nextCue", () => {
  test("a turn is announced once at 200 m and once when it is near, never again", () => {
    expect(run([turn(260), turn(190), turn(150), turn(60), turn(25), turn(10)])).toEqual([null, "soon", null, null, "now", null]);
  });

  test("after the turn, the next one (even of the same kind) is announced afresh", () => {
    expect(run([turn(25), turn(5), turn(180), turn(120)])).toEqual(["now", null, "soon", null]);
  });

  test("off route is spoken on departure only, again after being back on the trail", () => {
    const off = st({ offRoute: true });
    const on = st({});
    expect(run([on, off, off, off, on, off])).toEqual([null, "offRoute", null, null, null, "offRoute"]);
  });

  test("arrival is spoken once per stop and the off-route cue wins when both happen", () => {
    const here = st({ inRadius: true });
    expect(run([st({}), here, here, st({}), here])).toEqual([null, "arrived", null, null, "arrived"]);
    expect(run([st({ offRoute: true, inRadius: true })])).toEqual(["offRoute"]);
  });

  test("nothing to say with no target", () => {
    expect(run([st({ targetId: null, turn: { kind: "left", inM: 10 } })])).toEqual([null]);
  });
});

describe("cueText", () => {
  test("ja and en, distances rounded to 50 m", () => {
    expect(cueText({ kind: "soon", inM: 187, turn: "right" }, "ja")).toBe("約200メートル先、右へ");
    expect(cueText({ kind: "soon", inM: 187, turn: "right" }, "en")).toBe("In about 200 meters, turn right");
    expect(cueText({ kind: "arrived" }, "ja", "加太神社")).toBe("加太神社に着きました");
    expect(cueText({ kind: "offRoute" }, "en")).toBe("You are off the trail");
  });
});

import { pickVoice } from "./voice";

describe("pickVoice", () => {
  const v = (name: string, lang: string, localService = true, def = false) => ({ name, lang, localService, default: def });
  test("a natural voice on the phone beats the robotic default", () => {
    expect(pickVoice([v("Kyoko", "ja-JP", true, true), v("Kyoko (Enhanced)", "ja-JP"), v("Samantha", "en-US")], "ja")?.name).toBe("Kyoko (Enhanced)");
  });
  test("a voice on the phone beats a natural one that needs the network", () => {
    expect(pickVoice([v("Google 日本語", "ja-JP", false), v("Microsoft Haruka", "ja-JP")], "ja")?.name).toBe("Microsoft Haruka");
  });
  test("only voices of the language count, written ja_JP or ja-JP; none gives null", () => {
    expect(pickVoice([v("Samantha (Enhanced)", "en-US"), v("O-ren", "ja_JP")], "ja")?.name).toBe("O-ren");
    expect(pickVoice([v("Samantha", "en-US")], "ja")).toBeNull();
    expect(pickVoice([v("Kyoko", "ja-JP"), v("Ava (Premium)", "en-US"), v("Fred", "en-US", true, true)], "en")?.name).toBe("Ava (Premium)");
  });
});

describe("voice by age", () => {
  test("on for 70 and over only; no answer stays off", () => {
    expect(["70plus", "70s", "80s", "90plus"].every(speaksByDefault)).toBe(true);
    expect(["60s", "under20", null, undefined].some(speaksByDefault)).toBe(false);
  });
});
