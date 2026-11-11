# Landing story: one scroll from the sea to "さあ、はじめましょう"

Status: **built** (2026-11-11), see the PRs on this subject. Real-phone checks (iOS status strip, install bar) are still open.
It covers the first-time home page (Japanese and English) and extends `docs/landing-journey-design.md` (the sticky scene, built in #436).

> **Update 2026-11-11:** the copy is gone. `/story` is now our own wording in Japanese and English (`lib/story-text.ts`, four chapters, no photos, a credit line linking the official site). The paragraphs below describe the first version and are kept for the record.

## What the user saw, and why

| # | Seen on the phone | Cause found in the code |
|---|---|---|
| 1 | The photo starts about 71 pt down, under a solid cream strip; the page does not line up with the screen | The installed app draws a solid `.status-strip` (`--top-clear` = safe area + 0.75 rem) and pads `<body>` by it. A page with `[data-cover]` is exempt (the course page's photo runs behind the status bar). The home page is not marked, so its photo starts under the strip. Earlier padding fixes (#443, #444) only removed browser-mode gaps. |
| 2 | Nothing says the page keeps scrolling | The scene is 350 svh of plain scroll with no cue and no progress |
| 3 | English facts overlap ("About 112 km" runs into "31 places") | `Fact` is a fixed 3-column grid with `whitespace-nowrap` values, sized for Japanese |
| 4 | Titles look over-spaced | `Chapter` headings use `tracking-widest` (0.1 em) and the vertical hero title `tall:tracking-widest` |
| 5 | The map, the video and the courses sit in separate stacked chapters after the story | `Landing.tsx` lays them out as ordinary chapters below `Journey` |
| 6 | A language and install screen covers the first visit | `IntroFlow` (dialog, three steps, `intro` cookie) |

## Decided (user, 2026-11-11)

1. **The photo runs behind the status bar**, edge to edge, like the course page. The top bar (logo, menu) fades in only after the visitor scrolls.
2. **Scroll cue plus a progress line:** a small arrow with the word スクロール / Scroll at the bottom of the first screen (gone after the first scroll) and a thin line down the right edge that fills as the visitor goes.
3. **Order: sea, ridge, seals, map, video, courses, start.** The page ends on さあ、はじめましょう with the two buttons. Notices, the blog and the official links stay below as ordinary sections.
4. **The intro flow goes.** Language and install are not asked up front. The install prompt comes later (below).
5. Titles stop looking spaced out (below).
6. **7 chapters is fine.** The map stays the GSI map for now (it may become a drawing later).

## Added after review (user, 2026-11-11)

1. **A `/story` page** with the text and photos of the official 日本遺産 葛城修験ストーリー page, copied as it is for now, until we rewrite it. The page opens with a notice that the content is copied, with the link to the source. The user says the committee member who sent the link allows it (spoken only; same status as the 2026-11-02 permission, see the decisions log). The landing links to it from the ridge chapter ("ストーリーを読む").
2. **Courses rise one by one** with GSAP (the same reveal as other chapters, staggered, once). **Five courses:** the published ones first; if fewer than five are published, unpublished ones (準備中) fill the rest.
3. **Start has a third button:** ラリーを見る (the stamp rally), beside 新規登録 and ルートをさがす.
4. **The coworker's mountain drawing** (`outro_mountains.svg`, 1920 x 396, a silhouette that fades toward the bottom) is used so the backgrounds are not too plain: as the bottom of the Start chapter (the outro), standing along its lower edge behind the buttons' lower side. It is drawn in the page's own colour token, not its own brown: used as a CSS mask (`mask-image`, with `-webkit-mask-image`) over a token colour, so it follows light and dark mode and needs no new colour pair. It sits behind the content (`aria-hidden`, `pointer-events: none`) and the words and buttons keep their 7:1 contrast on the plain ground. The file is 27 KB of plain polygons (no script, no images) and is checked before it is shipped. A second use (the top of the ridge chapter) can follow if it looks right.

## Changes

### 1. Top edge (installed app)

- Mark the home hero `data-cover`. Then `body:has([data-cover])` already means: no body padding, no status strip, the photo under the status bar. `CoverWatch` already brings the strip back once the cover has left the top, so text scrolling up is not blurred behind the status bar.
- Mount `CoverWatch` on the home page (it is mounted by the course page today).
- Nothing in the hero's content may sit within `--top-clear` of the top: the line and the logo are centred, so they do not.
- The landing's own top bar already starts hidden at the top (`hidden = onLanding && !scrolled`), and uses `--top-clear`; it stays.
- Not verifiable here: the iOS blur, the strip and the safe areas need the user's iPhone (CLAUDE.md, definition of done).

### 2. Scroll cue and progress line

- `ScrollCue` (client, small): the arrow and word at the bottom of beat 1. Hidden after about 40 px of scroll. The arrow bobs gently; with reduced motion or calm it is still, never animated.
- `ScrollProgress` (client): a fixed 3 px line at the right edge, `aria-hidden`, scaled by scroll position over the story (top of the page to the start chapter). It is a position indicator, not decoration, so it also shows with reduced motion (it just follows the scroll).
- The pure part is tested: `progressOf(scrollY, top, bottom)` clamps to 0..1.
- Colours from the existing tokens (`brand` for the fill, `line` for the track). No new colour pair.

### 3. English facts do not overlap

- `Fact` row: label above value as now, but the grid is one column (label left, value right, ruled) below a container width of about 26 rem and three columns above it. Values may wrap; `whitespace-nowrap` goes. Applies to the journey and to the stacked chapter that uses `Fact` today.
- Checked at 390 px wide in Japanese and English.

### 4. Titles: no spaced-out tracking

- `Chapter` headings: `tracking-widest` becomes none (`tracking-normal`). The vertical hero title: `tall:tracking-widest` becomes `tall:tracking-[0.04em]`.
- New design rule (`docs/design-language.md`, do/don't): *titles are never tracked wider than 0.05 em; Latin titles never.* A source test (like `map-no-merge.test.ts`) fails if `tracking-widest` or `tracking-[0.` above 0.05em returns in the landing components.
- Not touched: the stamp grid's vertical names and the rally heading (different pages, their own tracking).

### 5. The story, in order

The sticky scene keeps three beats; the rest are the existing chapters, moved into this order and given the same reveal-on-scroll as the other chapters (reading register).

| Order | What | Where it comes from |
|---|---|---|
| 1 Sea | Photos, the line, the logo, the scroll cue | scene beat 0 (as is) |
| 2 Ridge | What it is, the three facts, the real line | scene beat 1 (as is, facts fixed) |
| 3 Seals | The rally, 31 seals on the line | scene beat 2 (as is) |
| 4 Map | `mapHeading`, `LandingMap`: all courses on the map | today inside the routes chapter |
| 5 Video | The 180 s PR film, its page link | today's video chapter, moved up |
| 6 Courses | **Five** routes as capsules, published first then 準備中, rising one by one; 全19区間を見る | today's routes chapter (6 shown now), without the map |
| 7 Start | `startHeading` (さあ、はじめましょう), 新規登録, ルートをさがす, **ラリーを見る**, ログイン | today the scene's beat 3 and `#after-journey` target |

- The scene ends after the seals (about 250 svh instead of 350). Start leaves the scene and is the last chapter of the story.
- Below Start: notices, blog, official links, tourism, as today.
- The skip link (スキップ) still lands after the journey: it now targets the Start chapter.
- Words stay the editable home words; nothing new is written except the scroll cue's word (スクロール / Scroll) and the install bar's text.
- Signed-in visitors keep their greeting hero and the stacked chapters as today. The new order is for a first-time visitor.

### 6. No intro flow; install comes later

- Remove `IntroFlow` from `(public)/layout.tsx`, the `intro` cookie read, and the `helpFor()` fetch that served its guide step (one fewer fetch on a first visit). How-to-play stays on the 遊び方 page.
- Language: the visitor gets Japanese or English from `Accept-Language` as now. A small JA / EN button sits at the top right of the first screen (over the photo, with its own backing so it reads on any photo), and the existing switcher stays in the menu.
- `InstallStep` moves out of `IntroFlow.tsx` into its own file (`InstallSteps.tsx`), unchanged, so the nudge can use it.
- `InstallNudge` (client): a small dismissible bar above the tab bar with one button that opens `InstallSteps`.
  - Shows only on a phone-sized touch screen, not when already installed (`display-mode: standalone`), not inside LINE and other in-app browsers (`isInAppBrowser`), not on the map.
  - Shows after 3 minutes on the site, or on the second visit, whichever comes first.
  - Dismissing it hides it for 30 days (a cookie; no token is stored).
  - Never over stamping, navigation or a form being filled in: it waits if a dialog is open or an input is focused.

### 7. The /story page

- Route `(public)/story/page.tsx`, reading register: a heading, four chapters (修験の聖地 / 海から始まる修行の地 / 地域の人々とつながる修行の地 / 葛城修験の今、そしてこれから), the nine photos with their captions, body text about 35 to 40 characters a line.
- The text lives in one content file (`lib/story-copy.ts`), the photos in `public/story/` (543 px wide, about 1 MB together, copied from the source site). Japanese only: English falls back to the Japanese text with the usual "untranslated" mark.
- **Notice at the top (both languages):** this page is the text and photos of the official 日本遺産 葛城修験ストーリー page, copied for now and to be rewritten, with the source link (https://katsuragisyugen-nihonisan.com/story/). A source record for the page goes in the decisions log, and the page is listed in the sitemap.
- The landing's ridge chapter gets one underlined text link, ストーリーを読む, to `/story`. The page is not in the main tabs.
- The copied text is data, not code: it is stored as plain strings, never executed.

### 8. Courses rise one by one

- The five courses are chosen by one pure function (`previewRoutes(routes, 5)`: published first in course order, then unpublished, at most five), tested.
- Reveal: the existing reading-register reveal (rise about 28 px out of a slight blur, fade in), staggered 140 ms, once, as the chapter arrives. Reduced motion: opacity only. Calm and no script: all visible at once.

## Tests

- `progressOf` (pure): before the top, inside, past the bottom, zero-height range.
- `InstallNudge` rules as a pure function (phone, installed, in-app, visits, minutes, dismissed): each case.
- `previewRoutes`: published first, filled with unpublished, never more than five, fewer routes than five.
- Source test: no wide title tracking in the landing components.
- Existing `journey.test.ts`, contrast and the no-native-dialog tests keep passing.
- By eye (Playwright, phone and desktop, Japanese and English): top edge, cue and line, facts at 390 px, order of chapters. **By the user on an iPhone:** the top edge in the installed app, the cue, the install bar on Android and iPhone.

## Risks and what is not decided

- **The strip's return.** `CoverWatch` was written for a cover photo that leaves the screen once. The home page has a tall sticky scene, so the strip must return at the scene's end, not at the first scroll. The plan checks this on the page.
- **`data-cover` also makes the phone top bar see-through** on pages that have it (`globals.css`). The landing's bar is a different element, so it should not change; the plan checks.
- **Removing the first-visit screen** loses the one place a visitor chose a language. The button on the photo replaces it; if people miss it, a second chance is the install bar's text.
- **Scroll length.** Seven chapters is a long page for a first visit. The skip link and the progress line are the mitigation; shorten later if it feels long.
- **Install prompt timing** (3 minutes, second visit, 30 days) are first guesses.
