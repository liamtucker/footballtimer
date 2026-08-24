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
  convenience only. It never touches the rotation. Nothing on the screen
  sweeps it away — a name leaves the list one row at a time.

## State

**Done.** v3 is built. The engine is untouched and still passes 71 assertions.
The refinement pass answered Liam's field notes against `brain/design.md`
(variation A) and `brain/copy.md`; a later pass answered a nine-item punch
list from Liam, which is where this list disagrees with those two documents:

- **The type scale is the law.** Five steps, ratio 1.5 — hero 60, count 40,
  lead 27, body 18, eyebrow 12 — and one media query at 800px that drops the
  top three one rung. Every `font-size` in `style.css` is one of those five
  tokens. The container query, the vw clamp and the `--len` machinery are
  gone. Two weights, 700 and 500. Tracking and line height are set by step.
- **The game screen.** Team heading, role eyebrow, name — three registers
  descending. `bibs` and `non-bibs` are headings and not tags: the word, then
  a rule to the edge of the section, the same shape the `SUBS` divider has.
  One grid per team, four rows — heading, the two eyebrows, the two names,
  line three — so `GOAL` sits level with `SUB` and the names sit level under
  them. The columns are two fixed fractions, `2.25fr 1fr`, which is hero over
  lead, so the sub column starts at the same edge whatever is in goal.
- **A name too long for its column shrinks.** `--fit` is the width the line
  has over the width it wants and it multiplies the step, measured in
  `fitLine`. Every name that fits is left at 1.
- **Line three** is the order strip at rest and the two outgoing names in the
  change window. It is the last row of the section either way. The name line
  holds whoever occupies the slot after the change; line three holds whoever
  is leaving it.
- **The mute** sits between the home button and the pencil, on by default.
  Muted is the same icon with a diagonal through it — no colour, no container.
  It silences the voice only, and it suppresses `No voice` while muted.
- **Three custom pickers**, one component. `[-] value [+]`, 44px targets, hold
  to repeat after 400ms at 8/s, `--dim` and inert at a bound. Every value now
  reads the way it is said out loud.
- **The live-game state.** The ink moves: a 56px corner button before kick-off,
  a full-bleed top bar during the game carrying the countdown, the mute and
  the conditional edit notice. The whole bar is the way back to the game, so
  there is no `x` in it. The filled list row is a readout mid-game, not a
  control.
- **The way home.** A third spine target ends the game and returns to setup
  with last week's squad in it. It is the only control that undoes something
  and the only one that asks: `This will end your current game.`, Yes and No,
  on the same button as `Kick off`. The clock does not pause for the question.
- **Portrait** is the same two-column layout as landscape on the game screen,
  and its own stacked layout on setup.
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
- **`brain/design.md` and `brain/copy.md` are behind the screens.** They still
  describe the two pills, the muted dot, the `x` in the live bar and the
  portrait split, all of which Liam's punch list replaced. The code is the
  current answer; the documents have not been rewritten to match.
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
