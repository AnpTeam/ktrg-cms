"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createNavigationController, type NavigationController, type NavSnapshot } from "@/lib/navigation/controller";
import { requestPath, type PathAnswer } from "@/lib/navigation/path-client";
import type { NavModel } from "@/lib/navigation/session";
import { fetchMyStamps } from "@/lib/stamp-client";

// The navigation session lives here, in the participant layout, so it keeps running while the visitor moves between
// the app's tabs (Home, Map, Routes, Stamps): layouts are not remounted on navigation. A hidden browser tab or a locked
// screen pauses the GPS and resumes it on return (position-watcher.ts). Only the map page starts and shows it.

export interface NavSession {
  routeId: string;
  routeName: string;
  /** Stop id -> its name in the visitor's language and its status, for the panel and the stamp button. */
  stops: Readonly<Record<string, NavStopInfo>>;
  snapshot: NavSnapshot;
}

export interface NavStopInfo {
  name: string;
  nameLang: "ja" | "en";
  status: "open" | "caution" | "closed";
}

interface NavigationApi {
  session: NavSession | null;
  start(input: { routeId: string; routeName: string; stops: Record<string, NavStopInfo>; model: NavModel }): void;
  stop(): void;
  /** After a successful stamp: head for the next nearest stop at once. */
  markStamped(stopId: string): void;
}

const NavigationContext = createContext<NavigationApi>({ session: null, start: () => {}, stop: () => {}, markStamped: () => {} });

export function NavigationProvider({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  const controller = useRef<NavigationController | null>(null);
  const [session, setSession] = useState<NavSession | null>(null);
  // Read when a path is wanted, so signing in or out during a session takes effect without restarting it.
  const signedInRef = useRef(signedIn);
  useEffect(() => {
    signedInRef.current = signedIn;
  }, [signedIn]);

  const stop = useCallback(() => {
    controller.current?.stop();
    controller.current = null;
    setSession(null);
  }, []);

  const start = useCallback<NavigationApi["start"]>(({ routeId, routeName, stops, model }) => {
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
    setSession({ routeId, routeName, stops, snapshot: c.snapshot });
    void c.start();
  }, []);

  const markStamped = useCallback((stopId: string) => controller.current?.markStamped(stopId), []);

  // Leaving the site (or a full reload) ends the session; nothing is kept.
  useEffect(() => () => controller.current?.stop(), []);

  const api = useMemo(() => ({ session, start, stop, markStamped }), [session, start, stop, markStamped]);
  return <NavigationContext.Provider value={api}>{children}</NavigationContext.Provider>;
}

export const useNavigation = () => useContext(NavigationContext);
