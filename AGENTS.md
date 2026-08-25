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

**Done.** v6 is built. The engine passes 88 assertions. Service worker cache
`rota-v9`.

**The sounds are the headline.** The whistle was inaudible on a touchline and
the measurement says why: band-passed noise spreads its energy over a wide
band, so peak amplitude buys almost no loudness. Rendered through an
`OfflineAudioContext` at 48kHz it was peak 0.344, RMS 0.075. The alarm that
replaces it is a two-tone klaxon — square oscillators alternating 1047Hz and
1397Hz at 2Hz, through a soft clipper and a 6.5kHz lowpass — at peak 0.936,
RMS 0.469. **15.9dB louder for the same headroom, and it does not clip.**

- **`sound.js` is new.** It builds WebAudio graphs and decides nothing, so the
  same code that plays can be rendered offline and measured. It is in the
  service worker's file list.
- **One alarm, 2.5s, the same at kick-off and at every changeover**, and it
  **finishes before the first word**. Kick-off: alarm 0–2500, chime 2650, Bibs
  3050, Non-bibs ~6050, done near 8700. A changeover is the same shape inside
  the ten-second window.
- **One spoken template, for both**: `Bibs. Goal, Umar. Sub, Kevin.` It states
  the state, not the transition, in the words the screen already shows. A team
  with no subs drops the clause and `no subs` is never said aloud.

**The voice works on Liam's phone** — he confirmed it. Nothing was rewritten.
Two risks are gone: the unlock no longer speaks a whitespace utterance at
volume 0, which is the shape that wedges a queue, and `cancel()` no longer
runs before every `speak()`. A line moves on at a spoken estimate as well as
on `end`, so one silent utterance costs the timing and never the second team.

**The manual interval override is gone.** `intervalMode`, `subMinutes`, the
fourth picker and the swap on the readout are out of the engine, the app, the
tests and the three documents. Game, Time and Rotations are the three settings
and the interval is their result, always derived, never editable. A squad
saved by the old build may carry `intervalMode: 'manual'`; it is read and
ignored, and a game already running keeps its frozen `intervalMs`.

**The freeze is honest now.** Mid-game the readout says what the frozen
interval is currently worth — `1.8 ROTATIONS EACH` — instead of repeating the
clock the person already set. Before kick-off it still says
`CHANGE EVERY 8:30`.

**Three touch fixes Liam asked for:**

- **A drag is armed by a hold.** 400ms of stillness lifts the row to
  `scale(1.045)` and buzzes; before that the row is `touch-action: pan-y` and
  the page scrolls. Every row used to be `touch-action: none`, so a squad of
  nine could not be scrolled at all. Verified with real touch events.
- **Kick off is not fixed in portrait.** `.settings-col` becomes
  `display: contents` and its two halves become items of the page: settings
  first, Kick off last, under both lists. Nothing sits over the field.
- **A sound test beside Kick off.** One tap speaks a line and sounds the
  alarm. It is also the gesture iOS wants before it will speak. Its answer
  takes the readout's row:
  `VOICES 191 · QUEUED YES · START NO · END NO · ERROR NONE`.

**The speaker icon carries three states** — on, muted, broken. Broken is not
muted wearing a colour: muted keeps its waves and takes a line through all of
it, broken has no waves and a cross where they were. `No voice` and `Screen
may sleep` are no longer text labels; both strings live in a hidden
`role="status"` line.

Everything below this line is unchanged from v5 and still true: the type
scale, the space scale, the game screen, the team title, the casing rule, the
settings column, the live-game state, the way home and portrait.

**Next.** The field test. Whether the alarm is the right length on a real
speaker, whether ten seconds of countdown at every change annoys people by
minute forty, and whether one chime is enough.

**Blocked.** Nothing.

**Open, for Liam.**

- **The voice has never been proved by an agent.** The automation browser has
  191 system voices and `speak()` queues, but no utterance ever fires `start`,
  `end` or `error` — so the sound test's own diagnostic reads
  `START NO · END NO · ERROR NONE` here. That is a property of the automation
  browser, not of the app. Liam has heard the voice; nothing between here and
  his phone can be checked without his phone.
- **`speechSynthesis.speaking` is worth nothing.** Measured in Chrome 151 it
  stays `true` for ever on a queued utterance that never starts. The old
  watchdog keyed on `!speaking && !pending`, so it could not fire on the one
  failure that matters. Only `start` proves a voice.
- **A worst-case announcement can spill past the change.** Two squads of eight
  with two subs each, with a dead engine, runs on estimates to about 10.8s
  against a 10s window. With a working engine it lands near 9.9s. Nothing
  sounds at the change itself any more, so the spill is silent and harmless —
  but dropping the first chime would buy 400ms if the field test wants it.
- **`OFF` and `ON` are not on the screen.** `copy.md` keeps them; `design.md`
  says the eyebrow never changes and the arrow plus the colour carry the
  direction. The design won.
- **The live bar has no `Next change` label.** The string survives as the
  accessible name of the countdown.
- **`brain/design.md` is 459 lines against a 200-line cap.** Variations B and
  C describe alternatives to a design built and revised three times. They are
  the first thing to cut.
- **Mid-game the landscape setup still scrolls to reach the divider.** The
  live bar takes 68px and nothing shorter is available.

## Debug hook

Only active with `?t=` in the URL. Without it `window.rota` does not exist and
nothing is written to `localStorage`.

- `?t=330`, `?t=5:30` or `?t=589.4` — start the clock at that elapsed time
- `&rate=60` — run 60x real time. `&rate=0` freezes it
- `&a=Dom,Dave,Chris` and `&b=Sam,Tom,Alex` — prefill the two squads
- `&g=7` — game type. `&game=120` — the game time
- `&rot=2` — rotations each
- `&ka=2` and `&kb=3` — force the starting keeper index per team
- `&count=0` — skip the kick-off countdown. `&auto=1` — kick off on load
- `window.rota.setElapsed(ms)`, `.rate(n)`, `.view()`, `.rotation`, `.state`,
  `.draft`, `.tick`
