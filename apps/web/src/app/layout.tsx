import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "葛城修験 / Katsuragi Shugendō",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// lang is fixed to "ja" until next-intl locale routing (/ja, /en) is added.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
