"use client";

import type { MapPhoto } from "@/lib/map-screen";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createNavigationController, type NavigationController, type NavSnapshot } from "@/lib/navigation/controller";
import { requestPath, type PathAnswer } from "@/lib/navigation/path-client";
import type { AccessPoint } from "@/lib/access-points";
import type { NavModel } from "@/lib/navigation/session";
import { clearResume, saveResume } from "@/lib/navigation/resume";
import { fetchMyStamps } from "@/lib/stamp-client";

// The navigation session lives here, in the participant layout, so it keeps running while the visitor moves between
// the app's tabs (Home, Map, Routes, Stamps): layouts are not remounted on navigation. A hidden browser tab or a locked
// screen pauses the GPS and resumes it on return (position-watcher.ts). Only the map page starts and shows it.

export interface NavSession {
  routeId: string;
  routeName: string;
  /** How to get to the course, for the far-from-the-course card. */
  access: readonly AccessPoint[];
  /** Stop id -> its name in the visitor's language and its status, for the panel and the stamp button. */
  stops: Readonly<Record<string, NavStopInfo>>;
  /** The course as the guidance sees it, for the progress and time left. */
  model: NavModel;
  snapshot: NavSnapshot;
}

export interface NavStopInfo {
  name: string;
  nameLang: "ja" | "en";
  status: "open" | "caution" | "closed";
  /** Shown on the arrival card. */
  photo: MapPhoto | null;
}

interface NavigationApi {
  session: NavSession | null;
  start(input: { routeId: string; routeName: string; access: readonly AccessPoint[]; stops: Record<string, NavStopInfo>; model: NavModel }): void;
  stop(): void;
  /** After a successful stamp: head for the next nearest stop at once. */
  markStamped(stopId: string): void;
  /** Head for this stop instead of the nearest one; null goes back to the nearest. */
  setTarget(stopId: string | null): void;
  /** A stop was walked past: leave it behind, or go back to it. */
  skipPassed(): void;
  returnToPassed(): void;
  /** Voice guidance starts on for this visitor unless they have chosen (see speaksByDefault). */
  voiceByDefault: boolean;
  /** Far from the course, the visitor chose a walking route after all (signed-in visitors only: see `signedIn`). */
  chooseWalk(): void;
  signedIn: boolean;
  /** How tall the navigation toast is (0 when hidden), so a page can keep that room free at the bottom. */
  toastPx: number;
  setToastPx(px: number): void;
  /** How far down from the top of the screen the instruction banner reaches on the map (0 when none), so the sheet stops below it. */
  bannerPx: number;
  setBannerPx(px: number): void;
  /**
   * On the map, during a navigation, the bottom of the screen belongs to one thing at a time: the navigation controls, or the
   * sheet (a course's or a place's details). True while the sheet has it; the controls then slide away (NavigationHud).
   */
  sheetUp: boolean;
  setSheetUp(up: boolean): void;
}

const NavigationContext = createContext<NavigationApi>({ session: null, start: () => {}, stop: () => {}, markStamped: () => {}, setTarget: () => {}, skipPassed: () => {}, returnToPassed: () => {}, voiceByDefault: false, chooseWalk: () => {}, signedIn: false, toastPx: 0, setToastPx: () => {}, bannerPx: 0, setBannerPx: () => {}, sheetUp: false, setSheetUp: () => {} });

export function NavigationProvider({ children, signedIn, voiceByDefault = false }: { children: ReactNode; signedIn: boolean; voiceByDefault?: boolean }) {
  const controller = useRef<NavigationController | null>(null);
  const [session, setSession] = useState<NavSession | null>(null);
  const [toastPx, setToastPx] = useState(0);
  const [bannerPx, setBannerPx] = useState(0);
  const [sheetUp, setSheetUp] = useState(false);
  // Read when a path is wanted, so signing in or out during a session takes effect without restarting it.
  const signedInRef = useRef(signedIn);
  useEffect(() => {
    signedInRef.current = signedIn;
  }, [signedIn]);

  const stop = useCallback(() => {
    controller.current?.stop();
    controller.current = null;
    setSession(null);
    clearResume(typeof window === "undefined" ? undefined : window.localStorage); // ended by hand: do not pick it up again after a reload
  }, []);

  const start = useCallback<NavigationApi["start"]>(({ routeId, routeName, access, stops, model }) => {
    controller.current?.stop();
    const c = createNavigationController({
      model,
      geo: typeof navigator !== "undefined" ? navigator.geolocation : undefined,
      doc: document,
      now: () => Date.now(),
      loadStamps: fetchMyStamps,
      // Signed out: no request leaves the phone (the answer says "back off", so it is not asked again soon).
      fetchPath: (spotId, from): Promise<PathAnswer> => (signedInRef.current ? requestPath(spotId, from) : Promise.resolve({ ok: false, backOff: true })),
      onChange: (snapshot) => setSession((s) => (s && controller.current === c ? { ...s, snapshot } : s)),
    });
    controller.current = c;
    saveResume(typeof window === "undefined" ? undefined : window.localStorage, { routeId, at: Date.now() });
    setSession({ routeId, routeName, access, stops, model, snapshot: c.snapshot });
    void c.start();
  }, []);

  const markStamped = useCallback((stopId: string) => controller.current?.markStamped(stopId), []);
  const chooseWalk = useCallback(() => controller.current?.chooseWalk(), []);
  const setTarget = useCallback((stopId: string | null) => controller.current?.setTarget(stopId), []);
  const skipPassed = useCallback(() => controller.current?.skipPassed(), []);
  const returnToPassed = useCallback(() => controller.current?.returnToPassed(), []);

  // Leaving the site (or a full reload) ends the session; nothing is kept.
  useEffect(() => () => controller.current?.stop(), []);

  const api = useMemo(() => ({ session, start, stop, markStamped, setTarget, skipPassed, returnToPassed, voiceByDefault, chooseWalk, signedIn, toastPx, setToastPx, bannerPx, setBannerPx, sheetUp, setSheetUp }), [session, start, stop, markStamped, setTarget, skipPassed, returnToPassed, voiceByDefault, chooseWalk, signedIn, toastPx, bannerPx, sheetUp]);
  return <NavigationContext.Provider value={api}>{children}</NavigationContext.Provider>;
}

export const useNavigation = () => useContext(NavigationContext);
