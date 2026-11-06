"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { NavState } from "@/lib/navigation/session";
import { cueText, emptyCueMemory, nextCue, pickVoice } from "@/lib/navigation/voice";

// Voice and vibration cues for a running navigation. Off by default, on for walkers of 70 and over (speaksByDefault); the choice is kept on this device only
// (localStorage is fine for a per-viewer convenience). Uses the browser's own speech and vibration: nothing to download.

const KEY = "ktrg-nav-voice";

/** Is the voice on for this visitor: what they chose on this device, else the default for them. */
export const voiceIsOn = (byDefault: boolean) => {
  try {
    const saved = window.localStorage.getItem(KEY);
    return saved === null ? byDefault : saved === "1";
  } catch {
    return byDefault;
  }
};

// The phone's voices arrive late in some browsers (Chrome fills the list after a "voiceschanged" event), so the choice is
// made again whenever the list changes, and kept per language.
const chosen = new Map<string, SpeechSynthesisVoice | null>();
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => chosen.clear());
}
function voiceFor(locale: string): SpeechSynthesisVoice | null {
  if (!chosen.has(locale)) {
    const list = window.speechSynthesis.getVoices();
    if (list.length === 0) return null; // not loaded yet: the browser's default this time
    chosen.set(locale, pickVoice(list, locale));
  }
  return chosen.get(locale) ?? null;
}

export function say(text: string, locale: string) {
  const synth = window.speechSynthesis;
  synth.cancel(); // never queue behind an old phrase
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale === "ja" ? "ja-JP" : "en-US";
  const voice = voiceFor(locale);
  if (voice) u.voice = voice;
  // A touch slower than the default: easier to catch outdoors with the phone in a hand or a pocket.
  u.rate = 0.95;
  synth.speak(u);
}

export function useNavVoice(state: NavState | null, targetName: string | undefined, byDefault: boolean) {
  const { t, i18n } = useLingui();
  const [on, setOn] = useState(() => (typeof window === "undefined" ? false : voiceIsOn(byDefault)));
  const mem = useRef(emptyCueMemory());
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  useEffect(() => {
    if (!on || !supported || !state) return;
    const r = nextCue(mem.current, state);
    mem.current = r.mem;
    if (!r.cue) return;
    say(cueText(r.cue, i18n.locale, targetName), i18n.locale);
    if (canVibrate) navigator.vibrate(r.cue.kind === "arrived" ? [200, 100, 200] : 200);
  }, [state, on, supported, canVibrate, i18n.locale, targetName]);

  const toggle = useCallback(() => {
    const next = !on;
    setOn(next);
    mem.current = emptyCueMemory();
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // private window or blocked storage: the choice just lasts until the page closes
    }
    // Speaking inside the tap also unlocks speech on iPhone, which allows it only after a touch.
    if (next && supported) say(t`音声案内をオンにしました`, i18n.locale);
    else if (supported) window.speechSynthesis.cancel();
  }, [on, supported, t, i18n.locale]);

  return { on, toggle, supported, canVibrate };
}
