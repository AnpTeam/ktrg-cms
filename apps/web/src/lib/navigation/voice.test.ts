import { describe, expect, test } from "bun:test";
import { initialState, type NavState } from "./session";
import { cueText, emptyCueMemory, nextCue, type CueMemory } from "./voice";

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
