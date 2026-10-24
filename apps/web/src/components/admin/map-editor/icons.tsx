import type { ReactNode } from "react";

// Small line icons for the bars on the map (each button also has a name for screen readers and a tooltip).
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
export const CursorIcon = () => (
  <Svg>
    <path d="M4 4l7 17 2.5-7.5L21 11z" />
  </Svg>
);
export const PinIcon = () => (
  <Svg>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);
export const GuideIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" strokeDasharray="3 3" />
    <path d="M3 20c4-1 5-7 9-8s6-6 9-8" strokeDasharray="1 4" />
  </Svg>
);
export const PencilIcon = () => (
  <Svg>
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
  </Svg>
);
export const UndoIcon = () => (
  <Svg>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
);
export const RedoIcon = () => (
  <Svg>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </Svg>
);
export const TrashIcon = () => (
  <Svg>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Svg>
);
export const FitIcon = () => (
  <Svg>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);
export const TerrainIcon = () => (
  <Svg>
    <path d="M3 20l6-11 4 7 3-4 5 8z" />
  </Svg>
);
