"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

// Whether the menu panel is open. The menu has two buttons that open it (the pill at the top of the page on a
// phone, an item in the side rail on a wide screen), so the state lives above both.
const MenuContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} });

export function MenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Going to another page closes the menu. Adjusted here, in the component that owns the state, while
  // rendering (the pattern React recommends); doing it from the header would update this component mid-render.
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  return <MenuContext.Provider value={{ open, setOpen }}>{children}</MenuContext.Provider>;
}

export const useMenu = () => useContext(MenuContext);
