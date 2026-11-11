# Landing Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the first-time landing's hero + three chapters with one sticky, scroll-driven scene (the ridge draws, seals drop, the buttons arrive), with a complete static version underneath it.

**Architecture:** A server component renders all four beats as plain static sections (the whole page for no-JS, calm, reduced motion). A client component, only when motion is allowed, loads GSAP, adds a `.journey-live` class that turns the wrapper into a tall box with a sticky stage, and drives one scrubbed timeline from pure functions in `lib/journey.ts`. Native scrolling throughout; no GSAP `pin`.

**Tech Stack:** Next.js App Router, React, TypeScript strict, Tailwind v4 + `globals.css`, GSAP 3.13 + ScrollTrigger (already installed, loaded dynamically), Lingui, `bun test`.

**Spec:** `docs/landing-journey-design.md` (decided 2026-11-11; open questions answered with the proposed defaults: seals evenly spaced, banner carousel stays in beat 1 and pauses after the first scroll, a skip link, wide = text left / ridge full width).

## Global Constraints

- Bun 1.4.3; run tests with `bun test` in `apps/web` and judge by the exit code (it can print `1 error` beside `0 fail`).
- Typecheck with `node node_modules/@typescript/native/bin/tsc --noEmit`; lint with `bun run lint`; both in `apps/web`.
- TypeScript strict, no `any`. Every UI string exists in `ja` and `en`; the words of the beats come from the editable `HomeSlot` words (`w` in `Landing.tsx`), **no new copy**, except the skip link.
- **Never run `bun run --cwd apps/web check:catalogs` or `lingui:extract` before committing** on this machine: they rewrite both `.po` files (CRLF) by thousands of lines. Add new messages to `en.po` and `ja.po` by hand, after the `前の写真` entry, with CRLF line endings, and stage only files you changed.
- **A file that imports `@lingui/react/macro` (or `core/macro`) cannot be imported by a `bun test` file**: CI fails with `Cannot find package 'babel-plugin-macros'` (this broke main once, PR #426). All tested logic lives in `src/lib/*.ts` (no React, no macro); components are checked in the browser.
- Colours are tokens in `globals.css`; never hard-code a colour. Any new text/background pair gets a row in `src/styles/contrast.test.ts` (text 7:1, borders 3:1).
- 48 px tap targets (`tap-target`), visible `:focus-visible`, body text 18 px or larger (`text-lg`), no `text-sm`/`text-xs` for anything a visitor must read.
- Reading register only (`docs/design-language.md`): GSAP is allowed here, loaded only on this page. Only `transform`, `opacity` and `stroke-dashoffset` animate.
- The signed-in home keeps `LandingHero` with the greeting. Only the signed-out path changes.
- No test may start the real API, database or SMTP; browser checks use their own dev-server port (for example 3417), never kill processes by project path.
- Git: one concern per commit, never force-push, never push to `main`, no attribution lines in commits or PR bodies.

## Review Focus

1. **No ridge data** (`ridgePath` returns null): the scene draws a plain straight line and never an invented profile; seals still place on it. Pinned in Task 1 (`stageLine(null)` and `sealPoints` on a two-point line).
2. **Zero or one seal** (`TOTAL_STAMPS` edited to 0 or 1): no crash, no NaN positions. Pinned in Task 1.
3. **An editor's very long `storyText`/`rallyText`**: the static markup must never clip; the stage must not hide text it cannot show. Pinned in Task 3 (the sticky stage is `min-height`, not fixed height, and beats scroll into view in static mode).
4. **GSAP fails to load, or reduced motion/calm is switched on while the page is open**: the page falls back to the static markup, words visible. Pinned in Task 3.
5. **English locale**: the vertical headline is Japanese only; English beats set across, and every English string exists. Pinned by the browser check in Task 2 (load `/en`, the `h1` has no `writing-mode: vertical-rl`) and by adding the `en.po` entry.

---

## File Structure

- Create `apps/web/src/lib/journey.ts` — pure beat/progress maths and seal placement. One responsibility: turn a scroll progress and a path into numbers.
- Create `apps/web/src/lib/journey.test.ts` — its tests.
- Modify `apps/web/src/lib/ridge.ts` and `ridge.test.ts` — also return the drawn points.
- Create `apps/web/src/components/landing/Journey.tsx` — server component, the static page for a signed-out visitor.
- Create `apps/web/src/components/landing/JourneyScene.tsx` — client enhancement (GSAP).
- Modify `apps/web/src/components/landing/Landing.tsx` — signed-out renders `Journey` instead of `LandingHero` + `LandingStory`.
- Modify `apps/web/src/app/globals.css` — `.journey-*` styles.
- Modify `apps/web/src/locales/en.po`, `ja.po` — the skip link message (by hand).
- Modify `docs/design-language.md`; append to the decisions log.
- Leave `LandingStory.tsx`, `StoryMotion.tsx` and `Chapter.tsx` in place: `Chapter`/`StoryMotion` still serve the chapters below and the signed-in page. Delete `LandingStory.tsx` only in Task 4 if nothing imports it.

---

### Task 1: Pure journey maths and the ridge's points

**Files:**
- Modify: `apps/web/src/lib/ridge.ts` (the `Ridge` interface and the return value of `ridgePath`)
- Modify: `apps/web/src/lib/ridge.test.ts`
- Create: `apps/web/src/lib/journey.ts`
- Test: `apps/web/src/lib/journey.test.ts`

**Interfaces:**
- Produces from `ridge.ts`: `Ridge` gains `points: [number, number][]` — the drawn `[x, y]` pairs in the `RIDGE_WIDTH × RIDGE_HEIGHT` box, in order (the same numbers as `d`, unformatted).
- Produces from `journey.ts`:
  - `export const BEAT_STARTS: readonly [0, 0.2, 0.5, 0.8]`
  - `export type BeatIndex = 0 | 1 | 2 | 3`
  - `export function beatAt(progress: number): BeatIndex` — progress clamped to 0..1; the beat whose start is the greatest `BEAT_STARTS` value ≤ progress.
  - `export function drawnShare(progress: number): number` — 0 until 0.15, linear to 1 at 0.5, 1 after.
  - `export function sealsPlaced(progress: number, total: number): number` — integer; 0 until 0.5, linear to `total` at 0.8, `total` after; never negative, never above `total`.
  - `export function sealPoints(points: readonly [number, number][], count: number): [number, number][]` — `count` points spaced evenly by arc length along the polyline (first at the start, last at the end; for `count` 1 the midpoint; `[]` for `count` ≤ 0 or fewer than two points).
  - `export function stageLine(ridge: Ridge | null): { d: string; points: [number, number][] }` — the ridge's own `d` and `points`, or, when `ridge` is null, the straight two-point line from `[0, RIDGE_HEIGHT]` to `[RIDGE_WIDTH, RIDGE_HEIGHT * 0.1]` (with its `d`, `M0.0 200.0 L1000.0 20.0`).

- [ ] **Step 1: Write the failing tests** in `ridge.test.ts` and `journey.test.ts`:
  - `ridgePath returns the points it drew`: for `course(1, 1, [0, 100])` alone, `points` is `[[0, 200], [1000, 20]]` (the box constants), and `points.length` equals the number of `L`/`M` commands in `d`.
  - `beatAt`: `beatAt(0) === 0`, `beatAt(0.19) === 0`, `beatAt(0.2) === 1`, `beatAt(0.5) === 2`, `beatAt(0.8) === 3`, `beatAt(1) === 3`, `beatAt(-5) === 0`, `beatAt(9) === 3`, `beatAt(NaN) === 0`.
  - `drawnShare`: `0` at 0 and 0.15; `0.5` at 0.325 (toBeCloseTo); `1` at 0.5 and 1.
  - `sealsPlaced`: `0` at 0.5; `31` at 0.8 and 1 for total 31; `15` or `16` at 0.65 for 31; always `0` when total is 0; an integer for any progress (property check over 0..1 in steps of 0.01 for totals 0, 1, 31).
  - `stageLine(null)` returns exactly that straight line (`points` of length 2, `d` starting `M0.0 200.0`); `stageLine(ridge)` returns the ridge's own `d` and `points` unchanged.
  - `sealPoints`: on `[[0,0],[10,0]]` with count 3 → `[[0,0],[5,0]...]` precisely `[[0,0],[5,0],[10,0]]`; count 1 → `[[5,0]]`; count 0 → `[]`; a single point → `[]`; on an L-shaped path `[[0,0],[10,0],[10,10]]` count 3 → `[[0,0],[10,0],[10,10]]` (arc length, not x spacing); every coordinate finite.

- [ ] **Step 2: Run to verify failure:** `bun test src/lib/journey.test.ts src/lib/ridge.test.ts` → FAIL (`journey` missing, `points` undefined).

- [ ] **Step 3: Implement** `Ridge.points` in `ridge.ts` (collect the numbers already computed for `d`, do not recompute) and the four functions in `journey.ts` with the signatures above. `sealPoints` walks cumulative segment lengths and interpolates; zero-length segments are skipped.

- [ ] **Step 4: Run to verify pass:** same command → PASS; then `bun run lint` and `node node_modules/@typescript/native/bin/tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ridge.ts apps/web/src/lib/ridge.test.ts apps/web/src/lib/journey.ts apps/web/src/lib/journey.test.ts
git commit -m "Journey maths: beats, ridge draw share, seals placed, seal points by arc length; ridge returns its points"
```

---

### Task 2: The static journey (the page for everyone, signed out)

**Files:**
- Create: `apps/web/src/components/landing/Journey.tsx`
- Modify: `apps/web/src/components/landing/Landing.tsx` (the `LandingHero`/`LandingStory` call sites, lines around 84-100)
- Modify: `apps/web/src/app/globals.css` (static journey styles)
- Modify: `apps/web/src/locales/en.po`, `ja.po` (one message: the skip link)

**Interfaces:**
- Consumes: `ridgePath` and `Ridge.points`, `stageLine`, `sealPoints` (Task 1); `HomeSlot` words `w: Record<HomeSlot, string>`; `BannerSlide[]`; `RouteSummary[]`; `TOTAL_ROUTES`, `TOTAL_STAMPS`, `TRAIL_KM` from `@/lib/rally`; `HeroSlides`/`HeroSlide` from `landing/HeroSlides.tsx`; `KatsuragiLogo`; `buttonStyle`.
- Produces: `export function Journey({ slides, routes, locale, w }: { slides: BannerSlide[]; routes: RouteSummary[]; locale: string; w: Record<HomeSlot, string> })` — renders, in this DOM order: a skip link (`<a href="#routes-title">`, `tap-target`, first in the section), the wrapper `<section data-journey aria-label=…>`, and inside it four `<section data-beat="0..3">` blocks: 0 the hero (reuse the markup of `LandingHero`'s first-time branch: `HeroSlides`, the vertical `h1` for `ja`, the white logo), 1 the story (`w.storyHeading`, `w.storyText`, the three facts), 2 the rally (`w.rallyHeading`, `w.rallyLead`, `w.rallyText`), 3 the start (`w.startHeading`, register and find-courses buttons, login link). Between beats 1 and 3 a single `<svg data-ridge-stage>` with the ridge path (`data-ridge`, `pathLength={1}`, fully drawn) and `TOTAL_STAMPS` seals (`data-seal`) placed by `sealPoints`; `aria-hidden="true"`. The svg draws `stageLine(ridgePath(routes))`.
- The scene markers the client will use in Task 3: attributes `data-journey`, `data-beat`, `data-ridge`, `data-seal`, `data-journey-stage` (the element that becomes sticky).

- [ ] **Step 1: Nothing new to unit-test here** (the logic is `stageLine`/`sealPoints` from Task 1; the markup file imports the Lingui macro and cannot be imported by `bun test`). Instead write down the browser assertions you will run in Step 5 and run them against a stub first: with the dev server, `/ja` signed out must show `[data-beat]` 0, 1, 2, 3 in order, exactly `TOTAL_STAMPS` (31) `[data-seal]` elements, one `[data-ridge]` path, the links `/register`, `/routes`, `/login`, and the skip link as the first focusable element inside the journey.

- [ ] **Step 2: Implement `Journey`** per the Interfaces block. The static layout is ordinary stacked sections (each beat `min-h` about a screen on a phone, text on `story-ground-inverse` for beats 1-2 and the existing grounds after), so it is already the finished page for no-JS and calm. Use the existing `Fold`-free structure; the facts reuse the `Fact` markup from `LandingStory.tsx` (copy it, do not import a private function). Add the one new message for the skip link (ja `スキップ`, en `Skip the introduction`) with `t` / `Trans`, and add it to both `.po` files by hand.

- [ ] **Step 3: Wire `Landing.tsx`**: for a signed-out visitor (`top` is undefined) render `<Journey …/>` where `LandingHero` and `LandingStory` were; keep `LandingHero` with `title={greeting}` for the signed-in path unchanged. Give the routes chapter heading the id the skip link targets (`routes-title` already exists on that `Chapter`).

- [ ] **Step 4: Verify:** `bun test` (whole suite, judge by the exit code), `bun run lint`, `tsc --noEmit`. Then start the dev server on its own port and check at 390 px and 1280 px, and `/en` once, scripting on: all four beats readable in order, ridge fully drawn, seals visible, buttons work, skip link jumps to the courses. State that the sample data has no ridge profile if it does not.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/landing/Journey.tsx apps/web/src/components/landing/Landing.tsx apps/web/src/app/globals.css apps/web/src/locales/en.po apps/web/src/locales/ja.po
git commit -m "Landing for a first-time visitor: the journey as four static beats with the ridge and seals drawn (calm, no-JS and reduced-motion version)"
```

---

### Task 3: The scrolling scene (motion enhancement)

**Files:**
- Create: `apps/web/src/components/landing/JourneyScene.tsx`
- Modify: `apps/web/src/components/landing/Journey.tsx` (wrap the section in `JourneyScene`)
- Modify: `apps/web/src/app/globals.css` (`.journey-live` rules, reduced-motion fade)

**Interfaces:**
- Consumes: `beatAt`, `drawnShare`, `sealsPlaced`, `BEAT_STARTS` (Task 1); the `data-*` markers from Task 2.
- Produces: `export function JourneyScene({ children, seals }: { children: ReactNode; seals: number })` (client). `seals` is `TOTAL_STAMPS`, passed from the server so the client does not import rally constants into its bundle for nothing.

- [ ] **Step 1: Write the failing test** for the one pure decision the component makes, in `journey.test.ts`: add `export function motionMode(env: { reduce: boolean; calm: boolean }): "scene" | "fade" | "static"` to `lib/journey.ts` (an addition to Task 1's file): `{reduce:false, calm:false}` → `"scene"`, `{reduce:true, calm:false}` → `"fade"`, any `calm:true` → `"static"`. Test those three and that `calm` wins over `reduce`.

- [ ] **Step 2: Run to verify it fails**, then **implement `motionMode`** in `lib/journey.ts` and run again to pass.

- [ ] **Step 3: Implement `JourneyScene`.** In `useEffect`: compute `motionMode` from `matchMedia("(prefers-reduced-motion: reduce)")` and `document.documentElement.hasAttribute("data-calm")`. `"static"` → do nothing. `"fade"` → load GSAP, and for each `[data-beat]` fade its text in once (opacity 0→1, 300 ms, no transform) when it enters (`ScrollTrigger` `once`); the ridge and seals stay in their final state. `"scene"` → dynamic `import("gsap")` and `import("gsap/ScrollTrigger")`, add `.journey-live` to the `[data-journey]` wrapper, create one `ScrollTrigger` on the wrapper (`start: "top top"`, `end: "bottom bottom"`, `scrub: 0.6`) whose `onUpdate` reads `progress` and applies: `strokeDashoffset = 1 - drawnShare(p)` on `[data-ridge]`; the first `sealsPlaced(p, seals)` `[data-seal]` get `opacity 1` and `scale 1` (the rest `opacity 0`, `scale 0.6`), driven by `gsap.set`/`quickSetter`, not per-frame `gsap.to`; `beatAt(p)` sets `data-active-beat` on the wrapper so CSS shows one beat's text at a time (opacity transition only). Wrap in `gsap.matchMedia()` so turning reduced motion on reverts to static; `.catch` and the cleanup both remove `.journey-live` and every inline style. The first-screen carousel (`HeroSlides`) must pause once `p > 0.02`: pass nothing new, instead dispatch a `journey-scrolled` window event once, which `HeroSlides` listens for to set its existing `held` pause (add that listener in `HeroSlides.tsx`).

- [ ] **Step 4: CSS.** `.journey-live` makes `[data-journey]` `height: 350svh` with `[data-journey-stage]` `position: sticky; top: 0; min-height: 100svh` (min-height, never a fixed height: a long editor text must grow the stage, not clip). Under `.journey-live`, beats are stacked absolutely inside the stage and shown by `[data-active-beat]`. Without `.journey-live` none of these rules apply (so no-JS never hides text). Text on the night ground uses the existing `on-night` tokens; if any new pair appears, add its row to `contrast.test.ts`.

- [ ] **Step 5: Verify in the browser** (own port, 390 px and 1280 px): motion allowed — scrolling draws the ridge, seals appear in order, at the end the buttons are at opacity 1 and clickable, scrolling back rewinds; `emulateMedia reducedMotion: reduce` — ridge drawn at once, text fades in with no transform; `html[data-calm]` — static, every text at opacity 1 with no inline `opacity`/`transform` on any beat; script blocked — static page complete; a story text of 600 characters does not clip. Run `bun test`, lint, tsc.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/journey.ts apps/web/src/lib/journey.test.ts apps/web/src/components/landing/JourneyScene.tsx apps/web/src/components/landing/Journey.tsx apps/web/src/components/landing/HeroSlides.tsx apps/web/src/app/globals.css
git commit -m "Journey scene: one scrubbed timeline on a sticky stage, reduced motion fades, calm and failures fall back to the static page"
```

---

### Task 4: Docs, contrast and cleanup

**Files:**
- Modify: `docs/design-language.md` (Motion section: the journey is sticky scroll-linked motion by design; "no scroll hijacking" stays true because scrolling is native)
- Modify: `apps/web/src/styles/contrast.test.ts` (only if Task 2/3 added a pair)
- Delete: `apps/web/src/components/landing/LandingStory.tsx` if `grep -r LandingStory apps/web/src` finds no import
- Append: a row to `~/Desktop/GPS/decisions-log.md`

- [ ] **Step 1:** Update `docs/design-language.md` Motion and Layout sections for the journey (one short paragraph each, with the date 2026-11-11 and a link to the spec). Run `grep -rn LandingStory apps/web/src`; delete the file when unused, and run `bun test`, lint and tsc to prove nothing broke.
- [ ] **Step 2:** Add the decisions-log row (journey shipped, seal choice, skip link, carousel pause) and update `CLAUDE.md`'s digest line "Design language" if it mentions the crossfade or the four-step story.
- [ ] **Step 3: Commit**

```bash
git add docs/design-language.md apps/web/src/styles/contrast.test.ts apps/web/src/components/landing
git commit -m "Docs for the landing journey; remove the unused first-time chapters"
```

- [ ] **Step 4: PR.** Open one PR for Tasks 1-4 from a branch off `main` (`feat/landing-journey`), body listing what was verified (unit tests, browser at 390/1280 px, the four fallbacks) and what was not: a real iPhone and Android (scroll feel, address bar), battery, a slow connection.
