import type { Prefecture } from "@/lib/content";

/**
 * Small line drawings for the prefecture filter and the headings of the route list, in the same stroke as the
 * other icons. They are our own drawings, simple on purpose and decorative (the name is always beside them):
 *  all        a trail between two points
 *  wakayama   waves (the sea at Tomogashima and Kada, where the trail begins)
 *  osaka      a ridge (the Izumi mountains)
 *  nara       twin peaks (the shape of Mt. Nijo)
 * Nothing religious is drawn: the subject is sacred to many people, so we keep to the land.
 */
export function PrefectureIcon({ value, size = 24 }: { value: Prefecture | "all"; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {value === "all" ? (
        <>
          <path d="M5 18c5 0 4-5 8-5s3-6 6-7" />
          <circle cx="5" cy="18" r="1.6" />
          <circle cx="19" cy="6" r="1.6" />
        </>
      ) : null}
      {value === "wakayama" ? (
        <>
          <path d="M2.5 9.5q2.4-3 4.8 0t4.8 0 4.8 0 4.8 0" />
          <path d="M2.5 15.5q2.4-3 4.8 0t4.8 0 4.8 0 4.8 0" />
        </>
      ) : null}
      {value === "osaka" ? <path d="M2.5 19 8 10l3.5 5L16 7l5.5 12" /> : null}
      {value === "nara" ? <path d="M3 19 8 8l3 6h2l3-6 5 11" /> : null}
    </svg>
  );
}
