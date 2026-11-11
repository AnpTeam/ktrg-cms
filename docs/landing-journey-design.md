# Landing journey: design

Status: **draft for review, nothing built.** Written 2026-11-11 from the user's choices that day (see "Decided"). Anything
under "Proposed" is my default and can be changed before the plan is written.

## What and why

The first-time landing (signed out) is today a hero (the banner photos, the vertical line, the logo) followed by three
chapters (what it is, the rally, where to start), each its own ground with words that rise in. The user finds it a flat
four-step page. It becomes **one scroll-driven scene**: the visitor scrolls and the scene walks them along the trail.

Success: a first-time visitor understands in about four screens of scrolling what this is (a 112 km pilgrim trail, 19
courses, 31 sutra mounds with stamps), and reaches the two actions (register, find a course) without a hunt. Nothing about
it depends on motion: every visitor reaches the same words and the same buttons.

Out of scope: the signed-in home (it keeps its greeting hero), the chapters below the journey (courses, map, notices,
blog, intro video, links, tourism), the map photo pins, the admin banners.

## Decided (user, 2026-11-11)

1. **One sticky, scroll-driven scene.** CSS `position: sticky`, not a locked pin: the page always scrolls natively. The
   ridge draws from the sea to Kongō, the sentence changes, seals drop on the line, the buttons arrive last.
2. **Reduced motion:** the scene ends in its final state at once (ridge drawn, seals placed); every sentence only fades in
   (opacity only, about 300 ms), no movement or blur.
3. **Calm on (the app's own setting):** nothing moves at all; all text is simply visible.
4. Order of work: routes page, course page, then this.

## Beats (Proposed)

The scene is about **350 svh** of scroll with a 100 svh sticky stage. Four beats, the words are the existing editable home
words (`HomeSlot`), so an editor's text shows here and **no new copy is written**:

| Beat | Stage | Words (slot) | Ends with |
|---|---|---|---|
| 1 Sea | The hero as it is today: banner photos, the vertical line, the white logo. | `heroLine` | the photos darken into the night ground as the ridge's first stroke appears at the left |
| 2 Ridge | Night ground (`night`/`on-night` tokens). The ridge from `ridgePath(routes)` draws left to right; three facts fade in under it: 全19区間, 約112km, 経塚31か所 (from `lib/rally`). | `storyHeading`, `storyText` | the line reaches the summit |
| 3 Seals | The same ridge. `TOTAL_STAMPS` small seals drop onto it one after another. | `rallyHeading`, `rallyLead`, `rallyText` | the last seal lands |
| 4 Start | The stage settles. The two buttons and the login link arrive. | `startHeading` | the scene releases and the page scrolls on to the courses |

Seals: placed **by mound, evenly by arc length along the drawn line** (28 mounds; mounds 3, 14 and 28 have two places and get a touching pair, so 31 seals; `moundSealPoints`, `MOUND_PLACES`), not at the real positions. On a phone each seal is 8 px with a 1 px ring (it was 12 px with a 2 px ring and read as a bead chain). They stand for the rally, not for a
map, and the real coordinates are not ours to place until a person has checked them (CLAUDE.md, data rule). The scene
says nothing a map would (no names on the seals).

If `ridgePath` returns null (no profile data yet) beats 2 and 3 use a plain straight line, never an invented profile.

## Structure (Proposed)

- `lib/journey.ts` (pure, tested): `beatAt(progress)` returns which beat is current and each element's 0..1 progress; the
  seal positions from a path length and a count. No React, no DOM.
- `components/landing/Journey.tsx` (server component): renders **all four beats as plain static sections** in reading order
  with the ridge fully drawn and the seals placed. This is the complete page for no-JS, calm, reduced motion before the
  script, and search engines. It replaces `LandingHero` + `LandingStory` for a signed-out visitor.
- `components/landing/JourneyScene.tsx` (client): when motion is allowed (`prefers-reduced-motion: no-preference` and not
  `html[data-calm]`), loads GSAP and ScrollTrigger on first visit only, adds `.journey-live` to the wrapper (a tall box
  with a sticky stage), and drives one timeline with `scrub`. Only `transform`, `opacity` and `stroke-dashoffset`.
- `globals.css`: `.journey-live` rules; the sticky layout exists **only** under that class, so a visitor without the
  script never gets text hidden behind a scene that cannot play.
- `Landing.tsx`: signed out renders `Journey`; signed in keeps `LandingHero` with the greeting.

Why sticky and not GSAP `pin`: native scroll stays in charge (no pin-spacer, no scroll hijack, fewer iOS address-bar
glitches), and the static markup is the same markup.

## Motion and fallbacks

| Visitor | What happens |
|---|---|
| Motion allowed | The scene plays as scroll progresses (scrub, about 0.6 s smoothing). Scrolling back rewinds it. |
| `prefers-reduced-motion: reduce` | `Journey` stays static. The ridge is drawn, the seals are placed. Each beat's text fades in (opacity, 300 ms) when it enters the screen. |
| Calm on | Static, all text visible, no fades. |
| No JavaScript | Same as calm. |
| GSAP fails to load | Same as calm (the catch removes `.journey-live`). |

If the visitor turns reduced motion on while the page is open, the scene is reverted to the static markup (`gsap.matchMedia`).

## Older users and accessibility

- Total scroll about four screens; no beat is shorter than a screen's worth of scrolling, so nothing flashes past.
- Reading order is the DOM order; each beat is a `<section>` with its own heading. The scene is decoration over real text,
  so a screen reader gets the static page.
- Body text keeps 18 px or larger; text on the night ground uses `on-night` (contrast rows already exist for it); text on the
  photo in beat 1 keeps its dark overlay. Any new colour pair gets a row in `styles/contrast.test.ts`.
- A visible **skip** link ("スキップ" / Skip) at the top of the scene jumps to the courses, for anyone who does not want
  the journey. It is a real link, 48 px, first in tab order inside the scene.
- No sound, nothing moves by itself: it moves only when the visitor scrolls (so WCAG 2.2.2 does not apply to the scene;
  the banner carousel of beat 1 keeps its own pause button).
- The ridge and seals are `aria-hidden`; the facts are in text.

## Risks

- **iPhone Safari:** sticky inside overflow ancestors and the shrinking address bar change `svh` behaviour. Must be tried on
  a real iPhone and a real Android before it ships; a simulator cannot show it.
- **Beat 1 and the banner carousel:** the carousel auto-advances while the scene is also scrubbing. Proposed: the carousel
  pauses once the visitor has scrolled past the top of the scene.
- **Editors' text length:** a very long `storyText` would overflow a 100 svh stage. The stage text area scrolls inside nothing;
  instead each beat's box has a max length (the admin's counter), and the static markup never clips.
- **Layout change at load:** `.journey-live` makes the page taller after the script runs. The first screen is identical in
  both versions, so nothing visible jumps; the scroll position is kept by the browser's scroll anchoring.
- **Performance:** one ScrollTrigger, GPU-only properties, GSAP loaded only here. Budget: no long task over 50 ms while
  scrolling on a mid-range Android (to be measured).

## Testing

- Unit: `lib/journey.ts` (beat boundaries, seal positions on a known path, counts of 0 and 1, null ridge).
- Browser (Playwright, our own port): static markup has all four beats and both buttons with scripting off and with
  `reducedMotion: reduce`; with motion on, scrolling to the end shows the buttons at opacity 1; calm shows no inline
  opacity or transform on any beat.
- A test that the home words still render in each beat (an editor's text appears).
- Contrast rows for any new pair; `check:catalogs` for new strings (only the skip link is new).
- **Not verifiable here:** real-device scroll feel, iOS address bar, battery. State that in the PR.

## Plan outline (after approval)

1. `lib/journey.ts` and its tests.
2. `Journey` static version replacing `LandingHero` + `LandingStory` for signed-out visitors (already the calm version).
3. `JourneyScene` and the sticky styles.
4. Update `docs/design-language.md` (it says "no scroll hijacking" and "one reveal per section"; the journey is sticky
   scroll-linked motion by design) and the decisions log.

## Open questions

1. **Seals at real positions or evenly spaced?** Proposed evenly (above). Real positions would need verified coordinates.
2. **Does the banner carousel stay in beat 1?** Proposed yes, paused after the first scroll.
3. **A skip link, or no?** Proposed yes.
4. **Wide screens:** same scene, wider ridge, text on the left half, ridge across the full width. Proposed; not drawn yet.
5. **Follow-up (not this work):** a proper multi-city picker for courses that cross cities (array column, migration,
   multi-select in the admin) instead of typing "、" in the free-text box.
