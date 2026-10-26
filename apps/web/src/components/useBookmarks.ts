"use client";

import { useCallback, useSyncExternalStore } from "react";
import { BOOKMARKS_KEY, parseBookmarks, toggleBookmark, type Bookmark } from "@/lib/bookmarks";

// The saved routes from localStorage, shared by every component that shows them; other tabs and this one stay in step.
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(BOOKMARKS_KEY);
  } catch {
    return null; // storage blocked (private window): the list is just empty
  }
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};

export function useBookmarks() {
  // The raw text is the snapshot (a string compares by value; a freshly parsed array would never settle).
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const toggle = useCallback((item: Bookmark) => {
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(toggleBookmark(parseBookmarks(read()), item)));
    } catch {
      return;
    }
    listeners.forEach((fn) => fn());
  }, []);
  return { list: parseBookmarks(raw), toggle };
}
