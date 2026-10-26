"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/lib/api";
import { BOOKMARKS_KEY, mergeBookmarks, parseBookmarks, toggleBookmark } from "@/lib/bookmarks";

// The visitor's bookmarks, one source for every component that shows them: the account's list when signed in (the server
// sends it with each page), the device's (localStorage) when not. At login the device's list is merged into the account's.
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(BOOKMARKS_KEY);
  } catch {
    return null; // storage blocked (private window): the list is just empty
  }
};
const write = (ids: string[]) => {
  try {
    if (ids.length === 0) localStorage.removeItem(BOOKMARKS_KEY);
    else localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(ids));
  } catch {
    return;
  }
  listeners.forEach((fn) => fn());
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};

const Context = createContext<{ list: string[]; toggle: (id: string) => void }>({ list: [], toggle: () => {} });

export function BookmarkProvider({ signedIn, ids, children }: { signedIn: boolean; ids: string[]; children: ReactNode }) {
  const router = useRouter();
  // The raw text is the snapshot (a string compares by value; a freshly parsed array would never settle).
  const raw = useSyncExternalStore(subscribe, read, () => null);
  // A change just made, shown at once until the page comes back with the account's new list.
  const [pending, setPending] = useState<{ base: string[]; value: string[] } | null>(null);
  const device = parseBookmarks(raw);
  const list = signedIn ? (pending && pending.base === ids ? pending.value : ids) : device;

  const save = useCallback(
    async (next: string[]) => {
      try {
        await api.me.patch({ bookmarks: next });
      } finally {
        router.refresh();
      }
    },
    [router],
  );

  const toggle = (id: string) => {
    const next = toggleBookmark(list, id);
    if (!signedIn) return write(next);
    setPending({ base: ids, value: next });
    void save(next);
  };

  // Signed in with bookmarks still on the device: move them to the account, once.
  const held = signedIn ? raw : null;
  useEffect(() => {
    const onDevice = parseBookmarks(held);
    if (onDevice.length === 0) return;
    write([]);
    void save(mergeBookmarks(ids, onDevice));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per arrival of device bookmarks
  }, [held]);

  return <Context.Provider value={{ list, toggle }}>{children}</Context.Provider>;
}

export const useBookmarks = () => useContext(Context);
