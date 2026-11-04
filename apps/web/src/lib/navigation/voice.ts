// Spoken and felt cues for a navigation session (docs/navigation-plan.md, N5). Pure: which cue comes next from the
// state (once per turn, once per departure, once per arrival), and its words in ja and en. The browser's own
// speechSynthesis and vibration do the rest (NavigationHud). Off by default; no audio files, no library.

import type { TurnKind } from "./geometry";
import type { NavState } from "./session";

export type Cue = { kind: "soon"; inM: number; turn: TurnKind } | { kind: "now"; turn: TurnKind } | { kind: "offRoute" } | { kind: "arrived" };

export interface CueMemory {
  /** The turn already announced "in 200 m" / "now", as `targetId:kind`. */
  soonKey: string | null;
  nowKey: string | null;
  /** Metres to the turn at the last fix: a jump up means the turn was passed and the next one is a new turn. */
  lastInM: number | null;
  off: boolean;
  arrivedAt: string | null;
}

export const emptyCueMemory = (): CueMemory => ({ soonKey: null, nowKey: null, lastInM: null, off: false, arrivedAt: null });

/** A turn is announced from this far ("soon") and again when it is this close ("now"). */
export const SOON_M = 200;
export const NOW_M = 30;

/** The next cue to give for this state, if any, and the memory to carry to the next fix. At most one cue per call. */
export function nextCue(mem: CueMemory, state: NavState): { cue: Cue | null; mem: CueMemory } {
  if (state.targetId === null) return { cue: null, mem: { ...emptyCueMemory(), off: state.offRoute } };
  let m = { ...mem };

  if (state.offRoute && !m.off) return { cue: { kind: "offRoute" }, mem: { ...m, off: true } };
  if (!state.offRoute) m.off = false;

  if (state.inRadius && m.arrivedAt !== state.targetId) return { cue: { kind: "arrived" }, mem: { ...m, arrivedAt: state.targetId } };
  if (!state.inRadius) m.arrivedAt = null;

  const turn = state.turn;
  if (!turn || (m.lastInM !== null && turn.inM > m.lastInM + 30)) m = { ...m, soonKey: null, nowKey: null };
  m.lastInM = turn ? turn.inM : null;
  if (!turn) return { cue: null, mem: m };

  const key = `${state.targetId}:${turn.kind}`;
  if (turn.inM <= NOW_M && m.nowKey !== key) return { cue: { kind: "now", turn: turn.kind }, mem: { ...m, nowKey: key, soonKey: key } };
  if (turn.inM <= SOON_M && turn.inM > NOW_M && m.soonKey !== key && m.nowKey !== key) return { cue: { kind: "soon", inM: turn.inM, turn: turn.kind }, mem: { ...m, soonKey: key } };
  return { cue: null, mem: m };
}

// shortcut: the spoken words live here as a small ja/en table, not in the Lingui catalogues, because this module is pure
// and runs outside React; add them to the catalogues if a third language is ever spoken.
const TURN: Record<"ja" | "en", Record<TurnKind, string>> = {
  ja: { "slight-left": "やや左へ", left: "左へ", "sharp-left": "大きく左へ", "slight-right": "やや右へ", right: "右へ", "sharp-right": "大きく右へ", "u-turn": "引き返します" },
  en: { "slight-left": "bear left", left: "turn left", "sharp-left": "turn sharp left", "slight-right": "bear right", right: "turn right", "sharp-right": "turn sharp right", "u-turn": "make a U-turn" },
};

/** What to say for a cue, in the app's language. `name` is the stop's name, said on arrival when known. */
export function cueText(cue: Cue, locale: string, name?: string): string {
  const l = locale === "ja" ? "ja" : "en";
  const ja = l === "ja";
  switch (cue.kind) {
    case "soon": {
      const m = Math.max(50, Math.round(cue.inM / 50) * 50);
      return ja ? `約${m}メートル先、${TURN.ja[cue.turn]}` : `In about ${m} meters, ${TURN.en[cue.turn]}`;
    }
    case "now":
      return ja ? `まもなく、${TURN.ja[cue.turn]}` : `Now, ${TURN.en[cue.turn]}`;
    case "offRoute":
      return ja ? "道からはずれています" : "You are off the trail";
    case "arrived":
      return ja ? `${name ?? "スタンプの場所"}に着きました` : `You have reached ${name ?? "the stamp place"}`;
  }
}
