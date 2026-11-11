# Landing story: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-time visitor's home page becomes one story (sea, ridge, seals, map, video, courses, start) that runs behind the iPhone status bar, shows that it keeps scrolling, links to a `/story` page, and no longer opens with the language and install screen.

**Architecture:** Pure helpers first (tested), then small isolated components, then the page reorder. The sticky scene shrinks to three beats; map, video, courses and start become ordinary chapters in `Landing.tsx` using the existing `StoryMotion` reveal (`[data-ground]` plus `[data-reveal] > *`, 0.14 s stagger).

**Tech Stack:** Next.js App Router, React, Tailwind v4, Lingui (hand-edited CRLF `.po`), GSAP (already used), `bun test`.

**Spec:** `docs/landing-story-design.md` (approved 2026-11-11, with "Added after review"). Earlier: `docs/landing-journey-design.md`, `docs/design-language.md`.

## Global Constraints

- Signed-in visitors keep today's greeting hero and chapters. The new order is for a first-time (signed-out) visitor only.
- Words are the editable home words (`HomeSlot`); new strings are only: スクロール / Scroll, the install bar's text, ストーリーを読む, the `/story` notice, button labels. Every string in `ja` and `en` (`.po`, hand-edited, CRLF kept; never run `lingui:extract`).
- Body text `text-base` or larger, `tap-target` on every control, visible focus ring, underlined plain links.
- Colours are existing tokens only; no new colour pair.
- Reading register motion only on the landing and `/story`; reduced motion = opacity only; calm = nothing moves; no script = everything visible.
- Titles are never tracked wider than 0.05 em (`tracking-widest` and wider are gone from the landing).
- No tokens in localStorage or sessionStorage; the install bar's dismissal is a cookie.
- No new library. No `any` without a comment.
- Pages and counts: 31 / 19 / 112 come from `lib/rally.ts`.
- Run before every commit: `bun run lint`, `bun run typecheck`, `bun run test` (judge by exit code).
- Never push to `main`. One PR per task group named below; no stacked PRs. No Claude attribution lines in commits or PR bodies.

## Review Focus

- **English at 390 px:** facts, the scroll cue, the install bar and every new button must not overlap or clip in English (longer words).
- **The strip's return:** with the hero under the status bar, the cream strip must come back once the scene has left the top (not at the first scroll), or text scrolls under a blurred status bar.
- **No published routes / fewer than five:** the courses chapter with zero, two or nineteen routes, all published or all 準備中.
- **Script off, calm on, reduced motion:** every chapter, button and the cue are visible and reachable; the progress line does not break.
- **A signed-out visitor who never sees the intro:** language still follows `Accept-Language`, and the JA / EN button and the install bar never cover the hero's line, the tab bar or a form being filled in.

## File structure

| File | Responsibility |
|---|---|
| `lib/landing-story.ts` (new, pure) | `progressOf`, `previewRoutes`, `installNudgeShows` |
| `lib/journey.ts` | three beats instead of four |
| `components/landing/ScrollCue.tsx`, `ScrollProgress.tsx` (new, client) | the cue and the progress line |
| `components/landing/Journey.tsx`, `JourneyScene.tsx` | three-beat scene, no Start |
| `components/landing/Landing.tsx` | the new chapter order for a first-time visitor |
| `components/landing/Chapter.tsx`, `LandingHero.tsx` | title tracking |
| `components/InstallSteps.tsx` (new, moved from `IntroFlow.tsx`), `components/InstallNudge.tsx` (new) | install steps and the later bar |
| `components/LocaleButton.tsx` (new) | small JA / EN button over the hero |
| `app/(public)/story/page.tsx`, `lib/story-copy.ts`, `public/story/*.jpg` (new) | the copied story page |
| `app/(public)/layout.tsx`, `app/sitemap.ts` | remove `IntroFlow`; add `/story` |
| `public/home/outro_mountains.svg` (new, the coworker's drawing) | the outro mountains at the bottom of the Start chapter |

---

### Task 1: Pure helpers

**Files:** Create `lib/landing-story.ts`, `lib/landing-story.test.ts`.

**Interfaces:**
- Produces: `progressOf(scrollY: number, top: number, bottom: number): number` (0..1, clamped, 0 for an empty range); `previewRoutes<T extends { status: string; order: number }>(routes: readonly T[], max?: number): T[]` (published first in `order`, then `status === "soon"` in `order`, at most `max`, default 5); `installNudgeShows(s: { phone: boolean; installed: boolean; inAppBrowser: boolean; onMap: boolean; visits: number; seconds: number; dismissedDaysAgo: number | null; dialogOpen: boolean; inputFocused: boolean }): boolean`.

- [ ] **Step 1: Write failing tests** in `landing-story.test.ts`: `progressOf` before top (0), inside (0.5 at the middle), past bottom (1), `bottom <= top` (0); `previewRoutes` with 8 published returns the first 5 by `order`; with 3 published and 6 soon returns 3 published then 2 soon; with 2 routes returns 2; with none returns `[]`; input is not mutated. `installNudgeShows`: false when `installed`, `inAppBrowser`, `!phone`, `onMap`, `dialogOpen`, `inputFocused`; false at `visits 1, seconds 100`; true at `visits 2` or `seconds >= 180`; false when `dismissedDaysAgo` is 0..29; true at 30 or `null`.
- [ ] **Step 2: Run, expect FAIL** (`bun test src/lib/landing-story.test.ts src/lib/journey.test.ts`): module not found / beat expectations.
- [ ] **Step 3: Implement** the three functions in `lib/landing-story.ts` (stable sort, no mutation).
- [ ] **Step 4: Run, expect PASS**, then the whole suite.
- [ ] **Step 5: Commit** `Landing story: pure helpers (progress, five courses, install rules)`.

### Task 2: Titles and facts

**Files:** Modify `components/landing/Chapter.tsx:18`, `components/landing/LandingHero.tsx:36`, `components/landing/Journey.tsx` (`Fact`), `components/landing/Landing.tsx` (`Fact`). Create `lib/title-tracking.test.ts`. Modify `docs/design-language.md`.

**Interfaces:** Consumes nothing from earlier tasks.

- [ ] **Step 1: Write the failing source test** `title-tracking.test.ts` (pattern of `map-no-merge.test.ts`): read every file in `components/landing/*.tsx`; fail if it contains `tracking-widest`, `tracking-wider`, or `tracking-[` with an em value above `0.05em`. Test name: "no title is tracked wider than 0.05 em".
- [ ] **Step 2: Run, expect FAIL** naming `Chapter.tsx` and `LandingHero.tsx`.
- [ ] **Step 3: Change** `Chapter` heading `tracking-widest` to `tracking-normal`; `LandingHero` `tall:tracking-widest` to `tall:tracking-[0.04em]`. `Fact` (both copies, one shared component in `components/landing/Fact.tsx` if the two are identical): one column (label left, value right, ruled) below a container width of 26 rem (`@[26rem]:grid-cols-3` above it); remove `whitespace-nowrap`; values may wrap. Add the rule "titles are never tracked wider than 0.05 em; Latin titles never" to the do/don't list.
- [ ] **Step 4: Run, expect PASS** and the full suite; look at 390 px in Japanese and English with Playwright (no overlap).
- [ ] **Step 5: Commit** `Landing: titles without wide tracking, facts that wrap in English`.

### Task 3: Top edge, scroll cue, progress line

**Files:** Create `components/landing/ScrollCue.tsx`, `components/landing/ScrollProgress.tsx`. Modify `components/landing/LandingHero.tsx` (marker), `components/landing/Landing.tsx` (mount), `app/globals.css` (cue and line styles).

**Interfaces:** Consumes `progressOf` (Task 1).

- [ ] **Step 1: Test first** where logic exists: `progressOf` is already tested (Task 1). Add `ScrollCue`'s rule as a pure `cueVisible(scrollY: number): boolean` (true below 40 px) to `landing-story.ts` with a test (0 true, 39 true, 40 false, negative true).
- [ ] **Step 2: Run, expect FAIL**, then implement `cueVisible`.
- [ ] **Step 3: Components.** The home hero section gets `data-cover` (first-time visitor and signed-in) and `Landing` mounts `CoverWatch`. `ScrollCue`: arrow and スクロール / Scroll at the bottom of the first screen; hidden when `!cueVisible(scrollY)`; the arrow bobs only under `prefers-reduced-motion: no-preference` with calm off, otherwise still. `ScrollProgress`: fixed 3 px line at the right edge, `aria-hidden`, fill `brand` on a `line` track, scale from `progressOf(scrollY, storyTop, storyBottom)` (story = top of the page to the start chapter), updated on scroll with `requestAnimationFrame`, passive listener, removed on unmount.
- [ ] **Step 4: Verify** in Playwright (phone width): cue visible at the top, gone after scrolling; line grows; hero starts at 0 px. **Check the strip's return** in `display-mode: standalone` emulation: `.status-strip` appears when the scene has left the top. Record what was and was not verifiable (the iOS blur needs the user's iPhone).
- [ ] **Step 5: Commit** `Landing: photo behind the status bar, scroll cue and progress line`.

### Task 4: The /story page

**Files:** Create `app/(public)/story/page.tsx`, `lib/story-copy.ts`, `lib/story-copy.test.ts`, `public/story/*.jpg` (nine photos), messages in `locales/ja.po` and `en.po`. Modify `app/sitemap.ts` (add `"/story"` to `PAGES`).

**Interfaces:** Produces route `/story`; `STORY_SECTIONS: { heading: string; paragraphs: string[]; figures?: { src: string; caption: string }[] }[]` in `lib/story-copy.ts` and `STORY_SOURCE_URL = "https://katsuragisyugen-nihonisan.com/story/"`.

- [ ] **Step 1: Failing test** `story-copy.test.ts`: four sections; every figure `src` starts with `/story/` and exists in `public/story/`; no paragraph is empty; `STORY_SOURCE_URL` is `https`; the text contains none of `<` or `>` (stored as plain strings).
- [ ] **Step 2: Run, expect FAIL**, then create `story-copy.ts` from the text extracted to `$CLAUDE_JOB_DIR/tmp/story/story.txt` and copy the nine `.jpg` files into `public/story/` (keep source file names). Headings: 修験の聖地－修験道はここから始まった / 海から始まる修行の地 / 地域の人々とつながる修行の地 / 葛城修験の今、そしてこれから.
- [ ] **Step 3: Page.** Reading register, server component, `generateMetadata` title. Top: a `Notice` (existing component) saying, in `ja` and `en`, that this page is the text and photos of the official 日本遺産 葛城修験ストーリー page, copied for now and to be rewritten, with a link to `STORY_SOURCE_URL` (opens in the same tab, underlined). Then each section: heading, paragraphs (`leading-8`, measure about 35 to 40 characters), figures with `<figcaption>` and `alt=""`. Images via `next/image` with explicit width and height. Add the `/story` URL to the sitemap and to the decisions log source record (done in the spec step).
- [ ] **Step 4: Run, expect PASS**; full suite; Playwright at 390 px and 1280 px in `ja` and `en` (the English page shows the Japanese text with the untranslated mark).
- [ ] **Step 5: Commit** `/story: the official story page, copied for now with a source notice`.

### Task 5: The new order

**Files:** Modify `lib/journey.ts`, `lib/journey.test.ts`, `components/landing/Journey.tsx`, `JourneyScene.tsx`, `Landing.tsx`, `StoryMotion.tsx` only if needed, `app/globals.css` (scene height 250svh). Modify `components/landing/Landing.tsx` skip link target.

**Interfaces:** Consumes `previewRoutes` (Task 1), `/story` (Task 4), `Fact` (Task 2).

- [ ] **Step 1: Failing tests.** In `journey.test.ts`: `beatAt` with three starts returns 0, 1, 2 at progress 0, 0.3, 0.7, and `BEAT_STARTS.length` is 3. In `landing-story.test.ts`: "five courses, published first" with nine mixed routes.
- [ ] **Step 2: Implement.** `lib/journey.ts`: `BEAT_STARTS` becomes `[0, 0.25, 0.6]` and `BeatIndex` is 0 | 1 | 2 (ridge drawn by 0.5, seals placed by 0.85). `Journey` renders three beats (sea, ridge, seals); the ridge chapter gets one underlined link ストーリーを読む to `/story`; the scene height is about 250 svh. `Landing` for a first-time visitor renders, after `Journey`: Map chapter (`w.mapHeading`, `LandingMap`, GSI as now), Video chapter (moved up, same content), Courses chapter (`previewRoutes(routes, 5)` capsules in a `ul data-reveal` so `StoryMotion` raises each `li` one by one; 全19区間を見る), Start chapter (`w.startHeading`; buttons 新規登録, ルートをさがす, ラリーを見る → `/rallies`; ログイン link). Then notices, blog, official links and tourism as today. The skip link targets the Start chapter's id. Signed-in rendering is unchanged.
- [ ] **Step 2b: The outro mountains.** Copy `~/Desktop/GPS/outro_mountains.svg` to `public/home/outro_mountains.svg` (a source test confirms it has no `<script`, `onload`, `href` or `<image`). In the Start chapter add an `aria-hidden` decoration along its lower edge: a block with `mask-image: url(/home/outro_mountains.svg)` (and `-webkit-mask-image`), `mask-size: 100% auto`, `mask-repeat: no-repeat`, `mask-position: bottom`, filled with a token colour (start with `bg-line/40` on the paper ground), `pointer-events: none`, behind the buttons (`z-0`; content `relative z-10`), with enough bottom padding that no button sits on the darkest part. Text and buttons keep their contrast on the plain ground; no new colour pair.
- [ ] **Step 3: Verify** with Playwright, `SHOW_SAMPLE_CONTENT=0` and `?as=out`: order of chapters, the mountains at the bottom of Start in light and dark mode at 390 px and 1280 px (stretched, not cropped badly), five courses (and with the sample's mixed statuses), three buttons, skip link lands on Start, signed-in page unchanged; reduced motion and calm emulation show everything.
- [ ] **Step 4: Run lint, type-check, full suite.** **Step 5: Commit** `Landing: story order (map, video, five courses, start with the stamp rally)`.

### Task 6: No intro flow; language button; install bar

**Files:** Create `components/InstallSteps.tsx`, `components/InstallNudge.tsx`, `components/LocaleButton.tsx`. Modify `components/IntroFlow.tsx` (delete), `app/(public)/layout.tsx` (remove `IntroFlow`, the `intro` cookie read and the `helpFor()` guide fetch; mount `InstallNudge`), `components/landing/LandingHero.tsx` (mount `LocaleButton`), messages.

**Interfaces:** Consumes `installNudgeShows` (Task 1). Produces `<InstallSteps />` (the old `InstallStep`, unchanged), `<InstallNudge />`, `<LocaleButton locale />`.

- [ ] **Step 1: Failing tests:** `installNudgeShows` is covered (Task 1). Add a source test that `IntroFlow` is no longer imported anywhere and that the `intro` cookie name no longer appears in `app/(public)/layout.tsx`.
- [ ] **Step 2: Run, expect FAIL**, then move `InstallStep` out of `IntroFlow.tsx` into `InstallSteps.tsx`, delete `IntroFlow.tsx`, update the layout.
- [ ] **Step 3: `InstallNudge`** reads: phone (`(pointer: coarse)` and width under 768), `display-mode: standalone` / `navigator.standalone`, `isInAppBrowser`, pathname `/map`, a visit counter cookie, seconds on the site, the dismissal cookie (30 days), an open `<dialog>`, a focused input; shows a dismissible bar above the tab bar with one button that opens `InstallSteps`. **`LocaleButton`:** small JA / EN button at the hero's top right with its own backing for contrast (`rememberLocale` as `IntroFlow` did).
- [ ] **Step 4: Verify** with Playwright: first visit shows no dialog; after emulating `visits=2` the bar shows on a phone viewport and not on desktop; dismissal hides it; the button switches language.
- [ ] **Step 5: Commit** `Landing: no intro flow; JA / EN button on the photo; install bar later`.

### Task 7: Docs and wrap-up

**Files:** Modify `docs/landing-story-design.md` (status: built), `docs/landing-journey-design.md` (four beats become three), `CLAUDE.md` (digest line), memory files, `decisions-log.md`.

- [ ] **Step 1:** Update the docs to what was built; add the design-language rule from Task 2 if not yet there.
- [ ] **Step 2:** Final run of lint, type-check, full suite; list what was and was not verified (iPhone blur and strip, install bar on real Android and iPhone, the copied page's permission in writing).
- [ ] **Step 3: Commit** `Landing story: docs`.

## PR grouping

1. Tasks 1 and 2 (helpers, titles, facts).
2. Task 3 (top edge, cue, line).
3. Task 4 (`/story`).
4. Tasks 5 and 6 (order, intro removal).
5. Task 7.

Merge in that order; each PR branches from the current `main` (never stacked).
