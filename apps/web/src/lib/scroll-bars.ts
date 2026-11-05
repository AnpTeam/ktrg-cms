// Phone bars that step aside while reading (like a social feed): scrolling down hides the tab bar and the page's sticky bar,
// scrolling up brings them back. Small finger jitters do nothing: the direction must be held for SLACK_PX first.
// Pure, so the rule is tested; TabBar applies it on scroll.

/** How far one direction must be scrolled before the bars change. */
export const SLACK_PX = 24;
/** Near the top or the bottom of the page the bars always show (nothing to read under them; the footer links stay reachable). */
export const EDGE_PX = 96;

export interface BarsState {
  hidden: boolean;
  /** The last scroll position seen. */
  y: number;
  /** How far the page has moved in the current direction (+ down, − up). */
  run: number;
}

export const initialBars = (y = 0): BarsState => ({ hidden: false, y, run: 0 });

/** The next state for scroll position `y` on a page that can scroll as far as `maxY`. */
export function nextBars(prev: BarsState, y: number, maxY: number): BarsState {
  const delta = y - prev.y;
  // Keep counting while the direction holds; a turn starts a new run.
  const run = delta === 0 ? prev.run : Math.sign(delta) === Math.sign(prev.run) ? prev.run + delta : delta;
  if (y <= EDGE_PX || y >= maxY - EDGE_PX) return { hidden: false, y, run };
  if (run >= SLACK_PX) return { hidden: true, y, run };
  if (run <= -SLACK_PX) return { hidden: false, y, run };
  return { hidden: prev.hidden, y, run };
}
