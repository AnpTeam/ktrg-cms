"use client";

import { useSyncExternalStore } from "react";

// How a stamp being pressed feels: a soft thud and a short buzz of the phone. The sound is off until the visitor turns it on
// (people walk in quiet places) and is kept on this device only. The buzz and the screen's movement stop with "calm".

const KEY = "ktrg-sound";
const CHANGED = "ktrg-sound-changed";

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage blocked: sound stays off
  }
};

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // blocked: the choice lasts only until the page closes (and the sound stays off)
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Whether the stamp sound is on (false while the server draws the page). */
export function useSound(): boolean {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener(CHANGED, fn);
      window.addEventListener("storage", fn);
      return () => {
        window.removeEventListener(CHANGED, fn);
        window.removeEventListener("storage", fn);
      };
    },
    read,
    () => false,
  );
}

let audio: AudioContext | null = null;

/** Call inside the tap itself: a phone only lets a page make sound once it was started by a touch. */
export function unlockAudio() {
  if (!read()) return;
  try {
    audio ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void audio.resume();
  } catch {
    // no Web Audio: no sound
  }
}

/** A low "thud" with a little paper-and-ink rustle, made on the spot (no sound file to load). */
export function playThud() {
  if (!read() || !audio) return;
  const t = audio.currentTime;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  gain.connect(audio.destination);
  const low = audio.createOscillator();
  low.frequency.setValueAtTime(150, t);
  low.frequency.exponentialRampToValueAtTime(45, t + 0.2);
  low.connect(gain);
  low.start(t);
  low.stop(t + 0.3);
  const noise = audio.createBufferSource();
  const buffer = audio.createBuffer(1, audio.sampleRate * 0.08, audio.sampleRate);
  buffer.getChannelData(0).forEach((_, i, d) => (d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)));
  noise.buffer = buffer;
  const rustle = audio.createGain();
  rustle.gain.value = 0.08;
  noise.connect(rustle).connect(audio.destination);
  noise.start(t);
}

/** A short buzz where the phone can (not on iPhone), and not for someone who chose calm. */
export function buzz() {
  if (document.documentElement.hasAttribute("data-calm")) return;
  navigator.vibrate?.(35);
}
