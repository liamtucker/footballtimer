---
name: footballtimer
status: building
---

# rota

## What this is

A display for casual six-a-side. It says who is in goal and who is the sub, for
both teams, and it changes on a timer. Set up during the warm-up, then never
touched.

`spec.md` is the source of truth for behaviour. `plan.md` is the build order.
`README.md` says why it exists. Read all three before you change anything.

## Rules

1. **The rotation is a pure function of elapsed time.** `rotation.js` holds no
   clock, no state and no history. Same setup and same elapsed time always
   returns the same answer. This is what lets a dead phone restart and carry on.
2. **No build step.** Flat static files. Vanilla JS, no framework, no bundler,
   no dependencies. Opening `index.html` runs it.
3. **No backend and no accounts.** The only stored things are the setup and the
   kick-off timestamp, in `localStorage`.
4. **Nothing to operate mid-game.** Two exceptions only: add a late arrival, and
   mark a player gone home. Both are facts, not decisions. Do not add a third.
5. **A button that needs a judgement is the wrong button.** Check any new
   control against the four principles in `spec.md`.
6. **System fonts only.** No webfont loads on a pitch with no signal.
7. Run `node test.js` before every commit. It must pass.

## Decisions

- **Hosting.** GitHub Pages, from `main` at the repo root.
- **Target.** Landscape phone, iOS Safari and Android Chrome both.
- **Gone home.** In scope. The spec's open decision is settled — allow it.
- **Squad memory.** The last squad is kept and prefilled at setup. A setup
  convenience only. It never touches the rotation.

## State

**Done.** v3 is built. The engine is untouched and still passes 71 assertions.
The refinement pass answered Liam's field notes against the rewritten
`brain/design.md` (variation A) and `brain/copy.md`:

- **The type scale is the law.** Five steps, ratio 1.5 — hero 60, count 40,
  lead 27, body 18, eyebrow 12 — and one media query at 800px that drops the
  top three one rung. Every `font-size` in `style.css` is one of those five
  tokens. The container query, the vw clamp and the `--len` machinery are
  gone. Two weights, 700 and 500. Tracking and line height are set by step.
- **The game screen.** Team pill, role eyebrow, name — three registers
  descending. `Bibs` is a filled ink pill and `No bibs` a hairline outline, so
  the pill is the bib. `GOAL` and `SUB` sit above the names, never beside.
  One grid per team, so the two role columns line up by construction.
- **Line three** is the order strip at rest and the two outgoing names in the
  change window. The name line holds whoever occupies the slot after the
  change; line three holds whoever is leaving it.
- **The mute** sits beside the pencil, on by default. Muted is a filled `--off`
  circle among two outline icons. It silences the voice only, and it
  suppresses `No voice` while muted.
- **Three custom pickers**, one component. `[-] value [+]`, 44px targets, hold
  to repeat after 400ms at 8/s, `--dim` and inert at a bound. Every value now
  reads the way it is said out loud.
- **The live-game state.** The ink moves: a 56px corner button before kick-off,
  a full-bleed top bar during the game carrying the countdown, the mute, an
  `x` and the conditional edit notice. The filled list row is a readout
  mid-game, not a control.
- **Portrait** is built on both screens and has now actually been looked at.
- **The time-played readout is deleted.** The spine holds one number.
- `COPY` in `app.js` is the only place a string is written. Nothing dangles.

**Next.** The field test, unchanged: whether ten seconds of countdown at every
change annoys people by minute forty, and whether one chime is enough.

**Blocked.** Nothing.

**Open, for Liam.**

- `Time` still drives nothing. The designer, the copywriter and this pass all
  think it should be cut. It is kept because Liam named its label. It is one
  entry in `PICKERS`, one card in `index.html` and one field in `draft` —
  cutting it is one small change.
- **`OFF` and `ON` are not on the screen.** `copy.md` keeps them; `design.md`
  says the eyebrow never changes and the arrow plus the colour carry the
  direction. The design won, because an inline label beside a name is the
  exact thing Liam asked to be removed. The eyebrows `GOAL` and `SUB` already
  say which side of the pitch the arrow points at.
- **The mute has no word beside it.** `design.md` wanted the spine's
  conditional eyebrow to say so as well; `copy.md` forbids a word that repeats
  what the icon says. Copy won.
- **The live bar has no `Next change` label.** `design.md` gives the bar the
  clock alone with a conditional eyebrow only when an edit is pending. The
  string survives as the accessible name of the countdown.
- **Portrait splits line three.** The order strip sits under the goal name —
  which is what it is the order of — and the outgoing sub takes its own line
  under the sub slot. One line three at the bottom would fly the outgoing
  keeper past the sub slot to get there.
- **Landscape at 390px tall shows six rows but clips the divider.** The
  design's own numbers need 290px of list and the screen has 274. The divider
  is visible at the fold, which at least says the list scrolls.

## Debug hook

Only active with `?t=` in the URL. Without it `window.rota` does not exist and
nothing is written to `localStorage`.

- `?t=330`, `?t=5:30` or `?t=589.4` — start the clock at that elapsed time
- `&rate=60` — run 60x real time. `&rate=0` freezes it
- `&a=Dom,Dave,Chris` and `&b=Sam,Tom,Alex` — prefill the two squads
- `&g=7` — game type. `&sub=10` and `&game=120` — the two durations
- `&ka=2` and `&kb=3` — force the starting keeper index per team
- `&count=0` — skip the kick-off countdown. `&auto=1` — kick off on load
- `window.rota.setElapsed(ms)`, `.rate(n)`, `.view()`, `.rotation`, `.state`,
  `.draft`, `.tick`
