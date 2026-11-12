# Landing on a Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A split-screen journey for desktop (words left, a large picture panel right), a fit guard for every screen, and desktop layouts for the chapters after the scene.

**Architecture:** The scene stays one DOM (`Journey.tsx`) driven by the existing `JourneyScene` trigger. A new CSS custom variant `desk` (width 1024 px and up, height 38rem and up) rearranges the pinned stage into two columns and shows a new picture panel and step marker; below that gate nothing changes. Pure rules (query constants, which course photos, whether the beats fit) live in `lib/landing-desktop.ts` so they are unit-tested.

**Tech Stack:** Next.js App Router, Tailwind v4 custom variants, GSAP ScrollTrigger (already in use), Lingui `.po` (hand-edited, CRLF, anchor after `msgid "前の写真"`), `bun test`.

**Spec:** `docs/landing-desktop-design.md` (approved 2026-11-12). Also `docs/landing-story-design.md`, `docs/design-language.md` (Motion: decorations drift gently, words and photos never).

## Global Constraints

- Phones and tablets keep their journey; a phone on its side keeps the stacked page (#452). The `wide:` variant also matches a phone on its side, so the new gate is `desk`, never `wide:`.
- `desk` = `(min-width: 1024px) and (min-height: 38rem)`; the scene itself still needs `(min-height: 38rem)` and `(prefers-reduced-motion: no-preference)`.
- About 300 svh of scroll on desk (the phone keeps 250 svh).
- Colours are tokens (`globals.css`), never hard-coded; text keeps 7:1; new drawings only in `currentColor` or tokens.
- Words and photos never drift; only transform and clip move; reduced motion, calm, no script: the stacked page.
- Every new string in Japanese and English: step marker 海 / 稜線 / 経塚 and Sea / Ridge / Mounds.
- Do not hard-code 19, 31 or 112 outside `src/lib/rally.ts`.
- No new library. `.po` edited by hand, never `lingui:extract`. Commits and PRs carry no "Generated with" or session-link lines.
- Judge test runs by the exit code of `bun run test` in `apps/web`; also run lint and `node node_modules/@typescript/native/bin/tsc --noEmit`.

## Review Focus

- A long editor text or a big text-size setting makes a beat taller than the stage: the scene must not start (stacked page stays), on phone and desktop.
- A course with no photo, or fewer than two courses with photos: the panel falls back to the first banner photo, then `public/home/top_slider_img01.jpg`; never an empty or broken panel.
- Resizing across 1024 px (desktop to tablet and back) swaps layouts without a reload and leaves no stray class or inline style (`--journey`, `journey-live`).
- Reduced motion on a desktop: the stacked page, with no panel and no step marker (they are scene-only).
- English text is longer than Japanese: the left column must not clip it at 1024 x 768.

## File Structure

- Create `apps/web/src/lib/landing-desktop.ts` (+ `.test.ts`): constants and pure rules.
- Create `apps/web/src/components/landing/DeskPanel.tsx`: the picture panel and the step marker (server component).
- Modify `apps/web/src/components/landing/Decor.tsx`: export `Waves({ id })`, used by `StaffAndWaves` and the panel.
- Modify `apps/web/src/components/landing/Journey.tsx`: mount `DeskPanel`.
- Modify `apps/web/src/components/landing/JourneyScene.tsx`: the fit guard.
- Modify `apps/web/src/app/globals.css`: the `desk` variant, the two-column stage, the panel, the step marker, 300 svh.
- Modify `apps/web/src/components/landing/Landing.tsx`: desk layouts of map, video, courses, start.
- Modify `apps/web/src/locales/ja.po`, `en.po`; docs and the decisions log.
- Test: `apps/web/src/lib/desk-journey.test.ts` (source-level tests, as `decor.test.ts`).

### Task 1: Pure rules

**Files:**
- Create: `apps/web/src/lib/landing-desktop.ts`, `apps/web/src/lib/landing-desktop.test.ts`

**Interfaces:**
- Produces: `export const SCENE_QUERY = "(prefers-reduced-motion: no-preference) and (min-height: 38rem)"`, `export const DESK_QUERY = "(min-width: 1024px) and (min-height: 38rem)"`, `export const DESK_SCROLL_SVH = 300`, `export const PHONE_SCROLL_SVH = 250`,
  `export type PanelPhoto = { src: string; credit: string | null }`,
  `export function panelPhotos(routes: readonly { status: string; order: number; photoUrl: string | null; photoCredit?: string | null }[], banner: string | null, fallback: string, count?: number): PanelPhoto[]`,
  `export function beatsFit(heights: readonly number[], stage: number): boolean`.

- [ ] **Step 1: Write the failing tests** in `landing-desktop.test.ts`: `panelPhotos` takes courses that have a photo, published (`ready`) first then by `order`, at most `count` (default 2), skips repeated `src`; with fewer than `count` it is filled from `banner` then `fallback` (so the result always has `count` items, no empty `src`); credits pass through (`null` when absent); the input is not mutated. `beatsFit([600, 700], 800)` is true, `beatsFit([600, 801], 800)` is false, `beatsFit([], 800)` is true, and a non-finite height or stage gives false. `DESK_QUERY` and `SCENE_QUERY` equal the strings above, and `DESK_QUERY` does not contain `max-height` (a phone on its side must not match).
- [ ] **Step 2: Run** `bun test src/lib/landing-desktop.test.ts` in `apps/web`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the exports above in `landing-desktop.ts`; reuse `previewRoutes` from `lib/landing-story.ts` for the order.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add apps/web/src/lib/landing-desktop*.ts && git commit -m "Landing desktop: pure rules (gates, panel photos, fit check)"`.

### Task 2: The fit guard

**Files:**
- Modify: `apps/web/src/components/landing/JourneyScene.tsx`
- Test: `apps/web/src/lib/desk-journey.test.ts` (create)

**Interfaces:**
- Consumes: `SCENE_QUERY`, `beatsFit` from Task 1.
- Produces: the scene starts only when `beatsFit(beat heights, innerHeight)`; otherwise no `journey-live`, no `--journey`.

- [ ] **Step 1: Write the failing source tests** in `desk-journey.test.ts`: `JourneyScene.tsx` imports `SCENE_QUERY` and `beatsFit` from `@/lib/landing-desktop`, uses `SCENE_QUERY` in `mm.add` (replacing the literal), and calls `beatsFit(` before it keeps `journey-live` (the string `beatsFit(` appears after `classList.add("journey-live")` and is followed by `classList.remove("journey-live")` in the failing branch).
- [ ] **Step 2: Run** `bun test src/lib/desk-journey.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `JourneyScene.tsx`: replace the media-query literal with `SCENE_QUERY`; after adding `journey-live`, measure `beats.map((b) => b.scrollHeight)` and if `!beatsFit(heights, window.innerHeight)` remove the class (and `data-active-beat`) and return without creating the trigger. `// shortcut: measured once when the scene starts (and when the window crosses a query), not on every resize or text-size change; upgrade if editors report clipped text.`
- [ ] **Step 4: Run** the test file and the whole `bun test`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `git commit -am "Journey scene: do not start when a beat is taller than the screen"` (after `git add` of the new test).

### Task 3: The desk stage, panel and step marker

**Files:**
- Modify: `Decor.tsx`, `Journey.tsx`, `globals.css`, `ja.po`, `en.po`
- Create: `apps/web/src/components/landing/DeskPanel.tsx`
- Test: `desk-journey.test.ts`

**Interfaces:**
- Consumes: `panelPhotos`, `DESK_SCROLL_SVH` (Task 1).
- Produces: `export function Waves({ id }: { id: string })` in `Decor.tsx` (the wave band; `StaffAndWaves` uses `<Waves id="seigaiha" />`); `export function DeskPanel({ photos }: { photos: PanelPhoto[] })` renders `<div data-picture>` (two stacked photos `data-photo="0|1"`, a gradient, `<Waves id="seigaiha-panel" />`, the credit) and `<ol data-steps>` with three `<li data-step="0|1|2">` (海 / 稜線 / 経塚, English via `<Trans>`). Both `hidden` outside `desk` and outside `.journey-live`.

- [ ] **Step 1: Write the failing tests** (source-level): `globals.css` defines `@custom-variant desk` with `(min-width: 1024px) and (min-height: 38rem)` and no `max-height`; `.journey-live` gets `height: 300svh` only inside that media query; `DeskPanel.tsx` has `data-picture`, `data-steps`, three `data-step`, no hex colour, `aria-hidden="true"` on the panel; `Journey.tsx` renders `<DeskPanel`; both `.po` files have `msgid "稜線"` and `msgid "海"` with `msgstr "Ridge"` / `"Sea"` in `en.po`.
- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement.** CSS under the desk media query and `.journey-live`: stage `grid-template-columns: 5fr 7fr` with the beats in column 1 and `[data-picture]`, `[data-ridge-stage]` in column 2 (ridge stage taller, `height: min(48svh, 28rem)`, no longer along the bottom); panel with token ground (night for beat 1, surface for beat 2, the existing colour transition), nearly square corners, photos `object-fit: cover` at low opacity under a token gradient, `[data-photo="0"]` visible on beat 1 and `[data-photo="1"]` on beat 2 (opacity crossfade by `data-active-beat`); step marker on the left edge, the active step filled (`[data-active-beat="n"] [data-step="n"]`). Outside the media query and outside `.journey-live`: `display: none` for `[data-picture]` and `[data-steps]`. `Journey.tsx` computes `panelPhotos(routes, slides[0]?.src ?? null, "/home/top_slider_img01.jpg")` and passes it to `<DeskPanel />`. Use `next/image` with `fill`, `sizes`, `alt=""`; credit via the existing `PhotoCredit` component. Add the two `.po` entries after the `前の写真` block (and reuse the existing 経塚 entry).
- [ ] **Step 4: Run** the test file, lint, typecheck, whole `bun test`. Expected: PASS, exit 0.
- [ ] **Step 5: Look at it** in the browser at 1440 x 900 (Japanese and English) with `SHOW_SAMPLE_CONTENT=0` and `?as=out`: beat 1, beat 2, the step marker following the scroll, the ridge inside the panel, no overlap of words with the panel.
- [ ] **Step 6: Commit** `git add -A apps && git commit -m "Landing desktop: split-screen stage with a picture panel and a step marker"`.

### Task 4: The chapters after the scene, on desk

**Files:**
- Modify: `apps/web/src/components/landing/Landing.tsx`, `globals.css` (the `desk` variant already exists from Task 3)
- Test: `desk-journey.test.ts`

**Interfaces:**
- Consumes: the `desk:` variant.
- Produces: map `desk:h-[70svh]` with the heading and one line in a card over its left side; video in two columns; `CourseCapsules` as `desk:grid desk:grid-cols-2 min-[90rem]:desk:grid-cols-3` (three from 1440 px) with the reveal staggering by row; the Start chapter with a horizontal headline and the three buttons in a row.

- [ ] **Step 1: Write the failing tests** (source-level): `Landing.tsx` contains `desk:grid-cols-2` on the courses list, `desk:` classes on the video chapter's two columns, and the map wrapper has `desk:h-[70svh]`.
- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement** with Tailwind `desk:` classes only (no new DOM except the map's overlay card, which reuses `w.mapHeading`). The Start chapter's vertical headline becomes horizontal on desk (override `tall:` classes with `desk:` resets in `Chapter.tsx` only for the Start chapter, through a `horizontal` prop).
- [ ] **Step 4: Run** tests, lint, typecheck. Expected: PASS, exit 0.
- [ ] **Step 5: Look at it** at 1440 x 900, 1280 x 720, 1024 x 768 and 1920 x 1080, Japanese and English, reduced motion on and off, and a resize to 800 px and back without a reload.
- [ ] **Step 6: Commit** `git commit -am "Landing desktop: wide layouts for the map, video, courses and start"`.

### Task 5: Docs and the end-to-end check

**Files:**
- Modify: `docs/landing-desktop-design.md` (status: built), `docs/landing-story-design.md` (one line), `docs/design-language.md` (the panel photo rule: a photo under a gradient, never under text), `C:\Users\user2\Desktop\GPS\decisions-log.md` (a row), `C:\Users\user2\Desktop\GPS\CLAUDE.md` (digest line).

- [ ] **Step 1: Update the docs** as listed, saying what was and was not verified (no real large monitor or mouse wheel).
- [ ] **Step 2: Run** `bun run lint`, the TS 7 `tsc --noEmit`, and `bun run test` in `apps/web`. Expected: all clean, exit 0.
- [ ] **Step 3: Commit** `git commit -am "Landing desktop: docs and decisions"`; push the branch and open one PR (no attribution lines).
