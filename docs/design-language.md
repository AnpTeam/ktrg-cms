# Design language

How the visitor side of the site should look, move and read. It sits on top of the rules in `CLAUDE.md`
(contrast, 48 px targets, tokens, no web fonts), which still win. Written 2026-11-10 after comparing our site with
NIS (katsuragi-shugen.vercel.app) and Gose City's gosenone.com.

## Why this exists

A site looks "made by a template" when every part could belong to any place: system font, gradient pill buttons,
rounded cards with arrow icons, a generated painting behind a centred headline. Swap the text and it is a trail in any
country. gosenone feels made by hand for the opposite reason: a painting of the real town, vertical Japanese headlines,
one thought per screen, and words that arrive as you reach them.

**The rule behind everything below: every visual choice must come from Katsuragi itself** — its line, its chapters,
its seals, its photographs, its writing — or be plain enough to disappear.

## Two registers

| Register | Pages | Feel |
|---|---|---|
| **読みもの (reading)** | Landing for new visitors, 葛城修験とは, the top of each course page | Editorial. Full-width real pictures, vertical Japanese headlines, the ridge line as a thread, words revealed on scroll, very few boxes |
| **道具 (tools)** | Map, stamping, my stamps, rallies, settings, login, admin | The app as it is, calmer. Plain and fast; no decoration, no reveal motion |

A page belongs to one register. The tools are used on the trail with one hand and weak signal: nothing from the
reading register (motion, big pictures, vertical text) goes there.

## Motifs: what is ours

1. **The ridge line.** The trail runs about 112 km from the sea at Tomogashima to Kongō. We hold its real geometry. On
   reading pages it is the thread that ties sections together: drawn from the real route, never a decorative squiggle.
   One fine stroke in `line` or `brand`, about 1 px; thicker only where it crosses a photo and would be lost.
2. **Twenty-eight chapters.** Each sutra mound carries a chapter of the Lotus Sutra (序品 is the first). Long reading
   pages are split into chapters, not "features"; a chapter mark is its number and chapter name, set like a sutra book.
3. **The seal.** The shu (朱) stamp is the only vermilion on the site, and only for stamps. It is the reward; keep it
   rare so it stays special.
4. **Hand drawings.** Drawn by our own team (see the drawing brief below). They are the identity, the way gosenone's
   painting is theirs.
5. **Washi and 七宝.** The cream paper and the faint 七宝 pattern stay as the ground everything sits on.

## Typography

- **Headings:** Mincho (`--font-serif`), body: UD Gothic (`--font-sans`). System fonts only, as now.
- **Vertical headlines (縦書き)** on reading pages: `writing-mode: vertical-rl`, at least `text-3xl`, short (one or two
  lines of up to about 14 characters). Body text is always horizontal.
- **Vertical is for Japanese only.** English set sideways was tried (#417) and was unreadable, so English headlines
  are set horizontally, large, in the same place. The rule lives in the `tall:` variant (Japanese text on a tall
  screen), so nothing else has to remember it.
- **On a phone the vertical headline floats** at the right: the words run beside it and then use the full width under
  it, so no column is kept for it. With room, headline and words stand side by side (`Chapter`).
- **Vertical needs height.** On a low screen (a phone on its side, under about 500 px tall) a vertical headline is set
  horizontally, or it would run off the screen.
- **Measure:** body text 35 to 40 Japanese characters a line on reading pages, `leading-8` or more.
- **Hierarchy by size and space, not by boxes.** A section title over open space, not a title inside a card.

## Colour

Use the existing tokens in `globals.css`; nothing new is needed. On reading pages, colour comes mostly from the
pictures; the page stays paper, ink and one brand-red mark per screen. Body text keeps 7:1 — gosenone's pale grey
paragraphs are exactly what not to copy.

## Layout and pace (reading register)

- **One idea per screen** on a phone: a picture, a headline, two or three short lines.
- **Space is the separator.** Between sections, large vertical space (about one screen-third), not borders or cards.
- **Each section has its own ground**, so the visitor feels "this is the next thing now": paper, the deeper surface
  tone, a band of ink (the night ridge), a full picture. When a new section takes most of the screen, the page
  background crossfades to its ground (about 500 ms). Grounds come from the colour tokens; text on each keeps 7:1.
- **Pictures full width** on phones; on wide screens they may break the column on one side. Wide screens are checked
  page by page as each phase is built.
- **At most one button per section**, at the end of the section, and one main button at the end of the page.

## Motion

- **Reading register only.** One reveal per section: the headline and its lines fade up a short distance (about 12 px,
  600 ms, `--ease-enter`), lines 80 ms apart. The ridge line may draw as it scrolls into view.
- **Never hide content waiting for motion.** The page is complete and readable with no JavaScript, with
  `prefers-reduced-motion: reduce`, and before scripts load. The reveal is added on top: elements are visible by
  default and only start hidden once a script has confirmed motion is allowed.
- **No loading screen in front of a page's content, no scroll hijacking, no parallax, nothing that moves by itself
  without a pause button.**
- **A loading overlay for real waits.** When an action takes time (starting navigation, fetching a route or an
  offline pack), the screen dims and a small looping mark plays (the ridge line drawing itself, or the seal) with a
  sentence saying what is happening. It appears only after about 300 ms, so quick actions never flash it; it has a
  cancel button when the action can be stopped; under reduced motion the mark stands still. This one may be used in the
  tools register.
- **GSAP is allowed** (agreed 2026-11-10) where it does the job better than plain CSS: drawing the ridge line on
  scroll, section ground changes, staggered reveals. Reading pages only, loaded on those pages (not in the shared
  bundle), with `gsap.matchMedia()` so reduced motion gets the final state. Plain CSS stays the choice for small things.
- **Tools register:** only the feedback that already exists (menus, toasts, the stamp press).

## Pictures

- **Real photographs** (the council's, credited, per the source record) and **our own drawings**. Nothing generated by
  AI, ever: a generated painting is the clearest sign of a template site.
- Every picture has a caption or credit line in text, and `alt` that says what it shows.
- Sizes are declared (aspect ratio) so nothing jumps while loading; below the first screen they load lazily.

## Do and don't

Numbered so we can discuss them by number.

**Do**

- D1. Start from something real in Katsuragi before choosing a shape, a colour or a motion.
- D2. Use the ridge line, the chapters and the seal as the site's marks.
- D3. Let space separate sections on reading pages.
- D4. Set short Japanese headlines vertically on reading pages when the screen is tall enough; horizontal everywhere else.
- D5. Write headlines as a person would say them about this place, not as slogans.
- D6. Give every reading section one picture or drawing, captioned.
- D7. Keep the tools register plain, fast and the same on every page.
- D8. Check every page with large text, a phone on its side, dark mode and reduced motion. Dark mode is a warm
  charcoal (`#1e1a17`, panels `#29241f`), not near-black; the dark band of a reading page (`night`) stays deeper than
  the page in both themes. Every text pair keeps 7:1 (contrast.test.ts).

**Don't**

- N1. No AI-generated images or illustrations.
- N2. No gradient blobs, glows, glass blur or "aurora" backgrounds.
- N3. No card inside a card; no grid of icon-plus-arrow link cards.
- N4. No pill badges for things that are not a status (for example "日本遺産・大阪・和歌山・奈良").
- N5. No pale grey body text; body text keeps 7:1.
- N6. No content that only appears after an animation, and no loading screen.
- N7. No vertical English, and no vertical text in the tools register.
- N8. No carousel that moves by itself without a pause button.
- N9. No more than one red button on a screen.
- N10. No emoji as icons; one icon set, one stroke weight.

## Drawing brief

Drawings will be made by our own team. The SVG art already in the app (icons, stamp faces, the logo, empty-state art)
is ours too and stays, unless the team decides to replace a piece. To make new drawings usable in light and dark mode
and at every size:

- **Line drawings in one colour** on a transparent background, so the site can tint them (ink on paper, light on
  dark). Colour paintings are welcome for the hero, with a version that works on the dark page.
- **Hand them over as SVG** (best for line work) or **PNG at 2400 px wide** for paintings. Keep the layered source.
- **No paper texture in the drawing**: the page adds the washi.
- **First drawings to make, in order:**
  1. A wide view of the ridge from the sea to Kongō, for the landing (wide, about 3 : 1).
  2. Tomogashima and the sea, the start of the walk.
  3. A sutra mound (経塚), for chapter marks; small and simple enough to work at 48 px.
  4. A walker on the ridge, small, for empty states.
- Each drawing gets a line in the source record with who drew it and when.

## Navigation and screen sizes

The app is a phone-first PWA that must also be good on a desktop. The navigation does not change with the register:
a reading page keeps the same tab bar or side menu, so a visitor can always get back to the map or their stamps.

| Screen | Navigation | Reading pages |
|---|---|---|
| Phone upright (360 to 430 px) | Bottom tab bar, as now | One column; vertical headlines; full-width pictures; the ridge line runs down the page |
| Phone on its side (`wide:`, under 600 px tall) | Side menu, as now | Two columns where a picture sits beside its words; headlines horizontal (not enough height) |
| Tablet (768 to 1024 px) | Upright: tab bar; on its side: side menu | One wide column with room around it; pictures may break out on one side |
| Desktop (1280 px and up) | Side menu, as now | A reading column of about 40 characters beside large pictures; the ridge line runs across the page, west to east |

- The tab bar never hides on scroll and is never covered: reading-page grounds and pictures stop at it, and the
  loading overlay dims the page but not the tab bar unless the action blocks it.
- Sizes are chosen by the room a section has (container queries), not only by the screen, so the side menu and large
  text never squeeze a section (the lesson of the home page on a phone on its side, #415).
- Every phase is checked at: 360 × 740, 390 × 844, 430 × 932, 844 × 390, 932 × 430, 768 × 1024, 1024 × 768,
  1280 × 800, 1440 × 900 and 1920 × 1080, in light and dark, at the largest text setting and with reduced motion.

## Phases

0. This document (agreed do and don't list).
1. Landing for new visitors as a story: the hero with a vertical title, "from the sea to the mountains" with the real
   line drawn on scroll, the chapters, how stamps work in three lines, one button. English set horizontally.
2. Home for signed-in visitors: a sentence and the next place first, a strip of seals; fewer tiles and boxes.
3. Course page header: the name standing vertically beside the photo (two columns, Japanese). A mark of the course's
   stretch of the whole ridge was tried (#420) and removed: on real data it was mostly other courses and needed a caption.
4. Tools register: remove card-in-card nesting and extra badges; one panel style; the loading overlay.
5. Dark mode retuned to a calmer, warmer dark across both registers (can move earlier if it hurts sooner).

## Settled

- English headlines are horizontal; vertical is Japanese only (tried in #417, reverted).
- The council's map art is a reference only; we do not reproduce it.
