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
3. **No backend and no accounts.** The only stored things are the setup, the
   kick-off timestamp and the two clock offsets, in `localStorage`.
4. **The game screen carries three controls, and the rota is only reachable
   with the clock stopped.** Hold, the sound test, and `END`. Hold is the only
   way to the three settings: editing an interval under a running clock is a
   question with no right answer. The engine still exposes `addLateArrival` and
   `removePlayer`; no screen calls them. Do not put a fourth control there.
5. **A button that needs a judgement is the wrong button.** Check any new
   control against the four principles in `spec.md`.
6. **The type is Barlow, and it ships with the app.** Barlow Condensed Bold and
   Barlow SemiBold, four woff2 subsets in `fonts/`, precached by the service
   worker. The rule this replaces was system fonts only, and the reason for it
   stands: nothing may be fetched from a network on a pitch. Never link a font
   from a CDN.
7. Run `node test.js` before every commit. It must pass.

## Decisions

- **Hosting.** GitHub Pages, from `main` at the repo root.
- **Target.** Portrait phone at 390x844, iOS Safari and Android Chrome both.
  The design is portrait. Landscape is not drawn and is not supported.
- **Who starts is drawn.** The first keeper and the first bench are drawn at
  kick-off and written into the setup. Entry order decides nothing, so there is
  no divider, no drag and no tap that sets a keeper.
- **Squad memory.** The last squad is kept and prefilled at setup. A setup
  convenience only. It never touches the rotation. Nothing on the screen
  sweeps it away — a name leaves the list one row at a time.
- **The teams are Team A and Team B.** Bibs and Non bibs named a thing the
  screen no longer shows: the game groups by role and the only place a team is
  written is the band over its own field.

## State

**Done.** v13. The engine passes 129 assertions. Service worker cache
`rota-v16`.

**The clock stops.** A third icon in the spine, and held the block loses its
colour — green is a shift running, red is one about to end, and a stopped clock
is neither, so it is the page's own white with the gauge held where it stopped
as a hairline. Held time is not game time: it comes off the clock, so a game
held for six minutes is still forty minutes old when it starts again, and a
phone that dies while held comes back held.

**Holding is the only way to the settings, and that is the point.** The three
cells appear under the block while the clock is stopped and are gone when it
runs. Editing an interval under a running clock is a question with no right
answer — it changes underneath the shift you are standing in — and paused there
is no such moment. So one control does both jobs and there is no fourth icon to
explain. A tap applies straight away, because the clock is stopped and the chip
above says what a shift is now.

**`engine.retime` keeps the draw.** The ring, the keeper and the bench all
stay; only the length of a shift moves. It is the same re-anchor `setLate`
does, with one difference: the new anchor is written at the change index the
**new** interval puts this moment in, not the old one — which is what stops the
rota replaying changes that have already happened when the shifts get longer.
The frozen interval is torn up and a new one frozen on the way out.

**Two clocks, because a retime cannot be honest with one.** `elapsedMs` is the
game and it is what the watch shows. `rotaMs` is the same clock less
`rotaShift`, and the shift is set so the current keeper gets *the share of the
new interval they have not yet served* — just gone in and they get all of it,
nearly done and they get what is left. Anything simpler either cuts a turn
short or hands somebody a double one.

**Rotations is a list, not a range: 1, 1.5, 2, 2.5, 3, 4, 5.** Eleven a side
over ninety minutes had two useful answers, 8:00 and 4:00, and nothing between
them — which is the night it went wrong. The halves are where a half is worth
having; above three a half step moves the interval by under a minute. It stays
turns each and never becomes a shift length in minutes: a length you pick has
to come out even against the squad and the clock, and doing that sum is the
whole reason the setting exists.

**A new build now lands on the visit that fetches it.** The worker served from
the cache and refreshed behind it, so a deploy showed up one visit late — which
on a phone that opens this once a week is a week, and looks exactly like a
deploy that never happened. The page reloads itself when a new worker takes
over, never on the first install and never with a game running. The install
also fetches with `cache: 'reload'`, or a new cache name fills with the old
build and nothing outside can tell.

**Kick-off is red and still.** The bar sweeps in the ten seconds before a
rotation because it is finishing something it has been draining all shift.
Before kick-off it has drained nothing, so a bar emptying over twenty seconds
was a mechanism arriving to say what the number already said.

**The reel shrinks together.** The middle is fitted to the room and the rest of
the line never stands taller than it. Held, the settings row takes a third of
the screen and a four-name stack lands near 18px — which is small, and it is
only ever the state somebody is standing over the phone in.

**The screen is two roles, not two teams.** Both keepers in one block and both
benches in the other, each a reel with no end: every change in order, the pair
in play centred at 50px in a fixed 188px column and the rest either side at
24px and half ink. `changeIndex` counts past the final whistle, so a game that
runs over carries on rotating and the line is grown from the right, never
rebuilt. The middle is put on the middle of the reel every frame of a slide,
so the type can grow from 24 to 50 underneath it.

**The voice says it twice.** `Goalkeepers, Sam and Kevin. Subs, Chris and Lee.`
— then again after a second and a half. A held `SpeechSynthesisVoice` goes
stale and is answered with silence, so the choice is a name resolved live; no
`start` inside 700ms is a wedged engine, so it is cleared and asked twice more.
`cancel()` happens in two places and never on an empty queue.

**The horn swells** over 110ms and lets go over 320, with the lowpass opening
2.2kHz to 5kHz and closing on the way out. A fifth, not a fourth — consonant
and louder through a phone speaker. Modelled at matched peak: RMS 0.578 against
0.600, band-RMS 0.420 against 0.417.

**Next.** The field test, with the hold and the halves in it.
**Blocked.** Nothing.

**Open, for Liam.**

- **A retime can shorten the shift you are in.** The share already served is
  carried over, so it is proportional and never sudden — but change from 5:15
  to 2:00 halfway through and the horn is a minute away. It is the honest
  answer and it may still surprise.
- **Pause and play are the only hand-drawn icons.** Everything else is lifted
  from the Figma file. They match the stop square's language — 24px, 2px
  stroke, round caps — and they are not in the file.
- **`aside` is editable mid-game and it moves the bench.** Changing it changes
  how many subs there are, so people who were on come off. The keeper never
  moves. It is correct and it is the one cell that does more than it says.
- **The file puts 12px under one mark and 24px under the other.** The build
  uses 12 in both: two identical structures differing by 12px is a slip.
- **Nothing marks which team a name is on.** That is what grouping by role
  costs, and on a six-a-side pitch it is probably free.
- **`brain/design.md` and `spec.md` describe an interface three rebuilds old.**
  Both are still right about the rotation and about why the sounds are what
  they are, and wrong about every screen.

## Debug hook

Only active with `?t=` in the URL. Without it `window.rota` does not exist and
nothing is written to `localStorage`.

- `?t=330`, `?t=5:30` or `?t=589.4` — start the clock at that elapsed time
- `&rate=60` — run 60x real time. `&rate=0` freezes it
- `&a=Dom,Dave,Chris` and `&b=Sam,Tom,Alex` — prefill the two squads
- `&g=7` — game type. `&game=120` — the game time
- `&rot=2` — rotations each
- `&seed=3` — a deterministic draw, so the same URL gives the same pitch twice.
  There is no way to force a starting keeper any more; the draw is the only way
  in and a seed is the only way to repeat it.
- `&count=0` — skip the kick-off countdown. `&auto=1` — kick off on load
- `window.rota.setElapsed(ms)`, `.rate(n)`, `.view()`, `.sheet(team, index)`,
  `.heard`, `.engine`, `.rotation`, `.state`, `.draft`, `.tick`. `.sheet` is
  still called `sheet`; it opens the modal.
