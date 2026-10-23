"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { SidebarIcon } from "@/components/icons";

const KEY = "admin-sidebar-hidden";
const Sidebar = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });

/**
 * The grid of every admin page: the menu on the left and the page. The menu can be hidden (on a wide screen) to give
 * the page the whole width; the choice is remembered in this browser (a convenience, so a blocked store just means "shown").
 */
export function AdminFrame({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "1") setHidden(true);
    } catch {
      // Not stored: the menu starts shown.
    }
  }, []);
  const toggle = () =>
    setHidden((was) => {
      try {
        window.localStorage.setItem(KEY, was ? "0" : "1");
      } catch {
        // Not stored.
      }
      return !was;
    });

  return (
    <Sidebar.Provider value={{ hidden, toggle }}>
      <div className={`min-h-screen bg-paper text-ink lg:grid ${hidden ? "lg:grid-cols-1" : "lg:grid-cols-[16rem_1fr]"}`}>
        <aside id="admin-sidebar" className={`border-b border-line p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r ${hidden ? "lg:hidden" : ""}`}>
          {aside}
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Sidebar.Provider>
  );
}

/** The button in the top bar that hides or shows the menu (wide screens only: a narrow screen has its own menu button). */
export function SidebarToggle() {
  const { t } = useLingui();
  const { hidden, toggle } = useContext(Sidebar);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!hidden}
      aria-controls="admin-sidebar"
      className="tap-target hidden items-center gap-2 rounded-xl border-2 border-line px-3 text-base font-bold lg:inline-flex"
    >
      <SidebarIcon />
      {hidden ? t`メニューを出す` : t`メニューを隠す`}
    </button>
  );
}
