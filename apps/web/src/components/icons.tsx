import type { ReactNode } from "react";

// Plain, heavy-stroke icons. Always shown next to a word, never alone.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = () => (
  <Icon>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v10h13V10" />
    <path d="M10 20v-6h4v6" />
  </Icon>
);

export const RouteIcon = () => (
  <Icon>
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M8 19h5a3.5 3.5 0 0 0 0-7h-2a3.5 3.5 0 0 1 0-7h5" />
  </Icon>
);

export const StampIcon = () => (
  <Icon>
    <path d="M9.5 12V8a2.5 2.5 0 1 1 5 0v4" />
    <path d="M5 12h14v4H5z" />
    <path d="M4 20h16" />
  </Icon>
);

export const ChevronIcon = () => (
  <Icon>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <path d="M12 7.5v.5" />
  </Icon>
);

export const ChevronLeftIcon = () => (
  <Icon>
    <path d="m15 5-7 7 7 7" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 3 3 5-6" />
  </Icon>
);

export const WarningIcon = () => (
  <Icon>
    <path d="M12 3.5 22 20H2z" />
    <path d="M12 10v4.5" />
    <path d="M12 17.5v.5" />
  </Icon>
);

export const ClosedIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="m6 6 12 12" />
  </Icon>
);
