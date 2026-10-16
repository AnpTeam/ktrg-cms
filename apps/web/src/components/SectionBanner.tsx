import type { ReactNode } from "react";

/**
 * A section heading as a red pill, like the pamphlet's: bold white words on the brand red, inside a
 * thin double line. The words sit on the red (about 3.9:1, fine for large bold text), never red on
 * the cream page (about 2.7:1), which is why headings are banners and not red text.
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
    <Tag
      className={`rounded-full bg-brand px-5 py-2 text-center font-serif text-xl font-bold leading-snug text-on-brand shadow-[0_0_0_2px_var(--color-paper),0_0_0_3.5px_var(--color-brand)] ${className}`}
    >
      {children}
    </Tag>
  );
}
