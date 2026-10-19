import type { ReactNode } from "react";

/**
 * A section heading: bold deep-red text with a short bar of the brand red beside it. (It used to be a
 * red pill with white words; the team found that pamphlet look too busy. The name stayed so no screen
 * needed to change.) Text is the readable deep red on the page, never the lighter brand red.
 */
export function SectionBanner({
  children,
  as: Tag = "h2",
  className = "",
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag className={`border-l-4 border-brand pl-3 text-left text-xl font-bold leading-snug text-accent ${className}`}>
      {children}
    </Tag>
  );
}
