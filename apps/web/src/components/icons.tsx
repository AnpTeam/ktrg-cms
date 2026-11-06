import type { ReactNode } from "react";

// Plain, heavy-stroke icons. Always shown next to a word, never alone.
function Icon({ children, size = 28 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
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

/** A camera crossed out: "no photo". */
export const CameraOffIcon = () => (
  <Icon>
    <path d="M9 5h6l1.5 2H20a1 1 0 0 1 1 1v9" />
    <path d="M3 8.5V18a1 1 0 0 0 1 1h14" />
    <path d="M10.2 10.2a3.5 3.5 0 0 0 4.6 4.6" />
    <path d="M3 3l18 18" />
  </Icon>
);

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

export const MapIcon = () => (
  <Icon>
    <path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7z" />
    <path d="M9 4v13" />
    <path d="M15 7v13" />
  </Icon>
);

export const StampIcon = () => (
  <Icon>
    <path d="M9.5 12V8a2.5 2.5 0 1 1 5 0v4" />
    <path d="M5 12h14v4H5z" />
    <path d="M4 20h16" />
  </Icon>
);

export const ChevronIcon = ({ size }: { size?: number } = {}) => (
  <Icon size={size}>
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

export const ChevronLeftIcon = ({ size }: { size?: number } = {}) => (
  <Icon size={size}>
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

export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </Icon>
);

export const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
  </Icon>
);

/** A circle half filled: "follows the device". */
export const AutoThemeIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
  </Icon>
);

export const MenuIcon = () => (
  <Icon>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="m6 6 12 12" />
    <path d="M18 6 6 18" />
  </Icon>
);

export const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </Icon>
);

export const KeyIcon = () => (
  <Icon>
    <circle cx="8" cy="12" r="3.5" />
    <path d="M11.5 12H21" />
    <path d="M17 12v3" />
    <path d="M20 12v2" />
  </Icon>
);

export const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const MailIcon = () => (
  <Icon>
    <path d="M4 6h16v12H4z" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);

export const ExpandIcon = () => (
  <Icon>
    <path d="M4 9V4h5" />
    <path d="M20 9V4h-5" />
    <path d="M4 15v5h5" />
    <path d="M20 15v5h-5" />
  </Icon>
);

// The admin's menu and tabs.
export const GearIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
  </Icon>
);

export const BellIcon = () => (
  <Icon>
    <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" />
    <path d="M10 21h4" />
  </Icon>
);

export const ImageIcon = () => (
  <Icon>
    <path d="M3.5 5h17v14h-17z" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 4" />
  </Icon>
);

export const ShopIcon = () => (
  <Icon>
    <path d="M4 9 5.5 4h13L20 9" />
    <path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9" />
    <path d="M5.5 11.5V20h13v-8.5" />
  </Icon>
);

export const PinIcon = () => (
  <Icon>
    <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
);

export const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Icon>
);

export const FlagIcon = () => (
  <Icon>
    <path d="M6 21V4" />
    <path d="M6 5h11l-2.5 4 2.5 4H6" />
  </Icon>
);

export const DocumentIcon = () => (
  <Icon>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6M9 16h6" />
  </Icon>
);

export const ListIcon = () => (
  <Icon>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.5M4 12h.5M4 18h.5" />
  </Icon>
);

/** A window with a side panel: the button that hides and shows the admin menu. */
export const SidebarIcon = () => (
  <Icon>
    <path d="M3.5 5h17v14h-17z" />
    <path d="M9.5 5v14" />
  </Icon>
);

export const PrintIcon = () => (
  <Icon>
    <path d="M7 9V4h10v5" />
    <rect x="4" y="9" width="16" height="8" rx="1" />
    <path d="M7 14h10v6H7z" />
  </Icon>
);

/** An arrow down into a tray: a file to save (the route's GPX). */
export const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11" />
    <path d="m8 11 4 4 4-4" />
    <path d="M5 19h14" />
  </Icon>
);

export const ShareIcon = () => (
  <Icon>
    <path d="M12 15V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M5 12v7h14v-7" />
  </Icon>
);

/** An outline, or filled in once the route is saved. */
export const BookmarkIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h12v16l-6-4-6 4z" />
  </svg>
);

/** A speech bubble: comments. */
export const CommentIcon = () => (
  <Icon>
    <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    <path d="M8 10h8M8 13h5" />
  </Icon>
);

/** A pencil: the writers. */
export const PencilIcon = () => (
  <Icon>
    <path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
    <path d="m14 7 3 3" />
  </Icon>
);

/** A page with a headline and lines: blog posts. */
export const ArticleIcon = () => (
  <Icon>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Icon>
);

/** Small marks above a character: furigana (readings above kanji). */
export const FuriganaIcon = () => (
  <Icon>
    <path d="M6 4h2M11 4h2M16 4h2" />
    <path d="M5 20 12 9l7 11" />
    <path d="M8 16h8" />
  </Icon>
);

/** Bars rising: the dashboard. */
export const ChartIcon = () => (
  <Icon>
    <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
  </Icon>
);

/** A globe: where visitors come from. */
export const GlobeIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z" />
  </Icon>
);

// Small marks that used to be typed as characters (＋ ▲ ✓ ↑ ...): now one stroke weight with the rest of the set.
type Sized = { size?: number };

/** A side panel in a window: folds or opens a panel. */
export const PanelIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M9.5 4.5v15" />
  </Icon>
);

export const PlusIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="M5 12h14" />
  </Icon>
);

export const ChevronUpIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="m5 15 7-7 7 7" />
  </Icon>
);

export const ChevronDownIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="m5 9 7 7 7-7" />
  </Icon>
);

export const ArrowUpIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
);

export const ArrowDownIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
);

/** Up and down together: a column that can be sorted but is not yet. */
export const SortIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
  </Icon>
);

/** A plain tick (CheckIcon has a ring round it). */
export const TickIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

/** An exclamation mark, for a badge that already draws its own circle. */
export const AlertIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="M12 5v9" />
    <path d="M12 18.5v.5" />
  </Icon>
);

export const XIcon = ({ size }: Sized = {}) => (
  <Icon size={size}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

/** © in a ring: a photo credit. */
export const CopyrightIcon = ({ size = 28 }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.8 9.4a3.6 3.6 0 1 0 0 5.2" />
  </Icon>
);

/** A ruler: a distance. */
export const RulerIcon = () => (
  <Icon>
    <path d="M3 15.5 15.5 3 21 8.5 8.5 21z" />
    <path d="M7 11.5l2 2M10 8.5l1.5 1.5M13 5.5l2 2" />
  </Icon>
);

/** A mountain: the climb. */
export const MountainIcon = () => (
  <Icon>
    <path d="M2 20 9 7l4 7 2.5-4L22 20z" />
  </Icon>
);
