import type { PointKind } from "./point-kinds";

/**
 * A small coloured picture for each kind of waypoint (24 x 24 grid, flat colours): the map's pins carry it in a white
 * disc, so what a place is can be read before it is opened. The colours are the picture's own, not the theme's: the disc
 * behind them is always white. Fixed markup written here, never from user input (the map sets it as the picture's inner SVG).
 */
const INK = "#2b2523";
const RED = "#c0392b";
const BLUE = "#1e50a2";
const SKY = "#2a9bd8";
const GREEN = "#4d8a4a";
const TEAL = "#0f766e";
const AMBER = "#f2b705";
const WOOD = "#8a5a2b";
const STONE = "#8d8680";

export const pointIconSvg: Record<PointKind, string> = {
  // A torii gate: dark roof beam, red posts.
  temple:
    `<rect x="6.2" y="7.5" width="2.4" height="13.5" rx=".8" fill="${RED}"/><rect x="15.4" y="7.5" width="2.4" height="13.5" rx=".8" fill="${RED}"/>` +
    `<rect x="4.5" y="9.8" width="15" height="2.1" rx=".6" fill="${RED}"/><path d="M2 4.8c4.2 2 15.8 2 20 0v3c-4.2 1.8-15.8 1.8-20 0z" fill="${INK}"/>`,
  // A sutra mound (経塚): a stacked stone tower on the grass, square base, round middle, pointed top, a gold jewel.
  mound:
    `<rect x="2.5" y="19.6" width="19" height="3" rx="1.5" fill="${GREEN}"/><rect x="7.5" y="15.2" width="9" height="4.6" rx=".8" fill="#8d8680"/>` +
    `<circle cx="12" cy="12.4" r="3.3" fill="#a8a09a"/><path d="M12 4.6l4.3 5.2H7.7z" fill="#8d8680"/><circle cx="12" cy="3.2" r="1.4" fill="#e0a030"/>`,
  // A mountain with a snow cap and a sun.
  view:
    `<circle cx="18" cy="6" r="2.6" fill="${AMBER}"/><path d="M1.5 21 9 8.5l4.6 7.2 2.6-3.6 6.3 8.9z" fill="#5b7c99"/>` +
    `<path d="M9 8.5l2.4 3.9-1.2-.9-1.2 1.4-1.2-1.4-1.2.9z" fill="#fff"/>`,
  turn:
    `<path d="M7 21V11a3.5 3.5 0 0 1 3.5-3.5H15" fill="none" stroke="${BLUE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 3.5l5 4-5 4z" fill="${BLUE}"/>`,
  danger:
    `<path d="M12 3.2 22 20.5H2z" fill="${AMBER}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 9.5v5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.1" fill="${INK}"/>`,
  // A blue and a red figure either side of a divider.
  toilet:
    `<rect x="11.4" y="3" width="1.2" height="18" rx=".6" fill="#b8b1aa"/>` +
    `<circle cx="7.2" cy="4.8" r="2" fill="${BLUE}"/><rect x="4.6" y="8" width="5.2" height="7" rx="1.6" fill="${BLUE}"/><rect x="5.2" y="15" width="1.7" height="6" rx=".8" fill="${BLUE}"/><rect x="7.6" y="15" width="1.7" height="6" rx=".8" fill="${BLUE}"/>` +
    `<circle cx="16.8" cy="4.8" r="2" fill="${RED}"/><path d="M16.8 8c1.4 0 2.4.8 2.8 2l1.3 6h-8.2l1.3-6c.4-1.2 1.4-2 2.8-2z" fill="${RED}"/><rect x="15.2" y="16" width="1.5" height="5" rx=".7" fill="${RED}"/><rect x="17" y="16" width="1.5" height="5" rx=".7" fill="${RED}"/>`,
  // A wooden bench under a tree.
  rest_area:
    `<circle cx="12" cy="7" r="4.6" fill="${GREEN}"/><rect x="11.2" y="10.5" width="1.6" height="4" fill="${WOOD}"/>` +
    `<rect x="4.5" y="11.6" width="15" height="1.8" rx=".7" fill="${WOOD}"/><rect x="3.5" y="14.2" width="17" height="2.6" rx=".8" fill="#c98a4b"/><rect x="5.2" y="16.8" width="2" height="4.2" fill="${WOOD}"/><rect x="16.8" y="16.8" width="2" height="4.2" fill="${WOOD}"/>`,
  // A water drop with a highlight.
  drinking_water:
    `<path d="M12 2.8s6.2 6.6 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 9.4 12 2.8 12 2.8z" fill="${SKY}"/><path d="M9 14.2a3.4 3.4 0 0 0 2.2 3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>`,
  // A red vending machine with its drinks lit.
  vending_machine:
    `<rect x="5" y="2.5" width="14" height="19" rx="2.2" fill="${RED}"/><rect x="7.2" y="5" width="9.6" height="8" rx="1" fill="#fff"/>` +
    `<rect x="8.2" y="6.2" width="2.2" height="2.6" fill="${SKY}"/><rect x="11" y="6.2" width="2.2" height="2.6" fill="${AMBER}"/><rect x="13.8" y="6.2" width="2" height="2.6" fill="${GREEN}"/><rect x="7.5" y="15.5" width="9" height="3.4" rx=".8" fill="${INK}"/>`,
  // A green bus seen from the front.
  bus_stop:
    `<rect x="4.5" y="3" width="15" height="15" rx="3" fill="${TEAL}"/><rect x="6.5" y="5.2" width="11" height="5.6" rx="1.2" fill="#fff"/><rect x="4.5" y="12.4" width="15" height="1.5" fill="${AMBER}"/>` +
    `<circle cx="8" cy="15.4" r="1" fill="#ffe08a"/><circle cx="16" cy="15.4" r="1" fill="#ffe08a"/><rect x="6" y="18" width="3" height="3.5" rx=".8" fill="${INK}"/><rect x="15" y="18" width="3" height="3.5" rx=".8" fill="${INK}"/>`,
  // A blue train seen from the front.
  station:
    `<rect x="5.5" y="2.5" width="13" height="15.5" rx="3.2" fill="${BLUE}"/><rect x="7.5" y="5" width="9" height="5.5" rx="1.2" fill="#fff"/><rect x="5.5" y="12.2" width="13" height="1.6" fill="${AMBER}"/>` +
    `<circle cx="8.6" cy="15.6" r="1.1" fill="#ffe08a"/><circle cx="15.4" cy="15.6" r="1.1" fill="#ffe08a"/><path d="M8 21.5l1.8-3.5M16 21.5l-1.8-3.5" stroke="${STONE}" stroke-width="1.8" stroke-linecap="round"/>`,
  // A ferry: blue hull, white cabin with a red funnel, waves beneath.
  ferry:
    `<rect x="10.4" y="4.6" width="3.2" height="4.6" rx=".6" fill="${RED}"/><rect x="6.5" y="8.8" width="11" height="6" rx="1.2" fill="#fff" stroke="${BLUE}" stroke-width="1"/>` +
    `<circle cx="9.6" cy="11.8" r=".9" fill="${BLUE}"/><circle cx="12" cy="11.8" r=".9" fill="${BLUE}"/><circle cx="14.4" cy="11.8" r=".9" fill="${BLUE}"/>` +
    `<path d="M2.5 14.8h19l-2.8 5H5.3z" fill="${BLUE}"/><path d="M1.5 22.2c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0 2.6.8 4 0" fill="none" stroke="${SKY}" stroke-width="1.6" stroke-linecap="round"/>`,
  // A tent on the grass.
  campsite:
    `<path d="M12 3.6 22 19.6H2z" fill="#e8732a"/><path d="M12 10.8l4.2 8.8H7.8z" fill="#8a3a12"/><path d="M12 3.6V1.8" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<rect x="1.5" y="19.4" width="21" height="3" rx="1.5" fill="${GREEN}"/>`,
  // A white P on a blue square.
  parking:
    `<rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="${BLUE}"/><path d="M9.6 17.5V7h3.2a3 3 0 0 1 0 6H9.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  // A red map pin.
  other: `<path d="M12 22s-7-6.2-7-11.5a7 7 0 0 1 14-0c0 5.3-7 11.5-7 11.5z" fill="${RED}"/><circle cx="12" cy="10.5" r="2.6" fill="#fff"/>`,
};
