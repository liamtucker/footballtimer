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
4. **Nothing to operate mid-game, and nothing that changes the game.** The
   game screen carries two controls and neither of them touches the rota: the
   sound test, and `END`. The engine still exposes `addLateArrival` and
   `removePlayer`; no screen calls them. Do not put a third control there.
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

**Done.** v10. Rebuilt from Figma node `94:756`. The engine passes 122
assertions and was not touched. Service worker cache `rota-v14`.

**The screen is two roles now, not two teams.** Both keepers in one block and
both benches in the other, under a black tab that names the role. Nobody on a
pitch asks what the bibs are doing — they ask *am I in goal* and *am I off* —
and the team chip was the loudest thing on the screen saying the quietest
thing on it. The voice follows the screen: `Goalkeepers, Sam and Kevin. Subs,
Chris and Lee.`

**Each block is a reel, and it is the whole game on one line.** Every change
from the first to the last, in order, with the pair in play centred at 50px
and the rest either side at 24px and half ink. On a change the line slides one
place left, so the next names arrive where the eye already is. Behind is
behind and ahead is ahead — the one thing a row can say that a column cannot.

It is built once at kick-off and after that a change moves one class. The
positioning is measured, not calculated: every frame of the slide the middle
of the active group is put on the middle of the reel, so the type can grow
from 24 to 50 underneath it and the centre never moves. `transitionend` has
the last word, because a throttled tab can outlive the deadline.

**The middle is a fixed 188px column and that is the point.** Names run from
three letters to ten and a row that packed them would put the centre somewhere
new every seven minutes. A name too wide for the column, or a stack too tall
for the block, is set smaller — measured on a ruler off the side of the page
and never on the element that is mid-transition.

**The horn swells now, and it cost two percent.** Three things made it harsh:
it started in 20ms, it stopped in 120, and it carried 6.5kHz of top. It swells
over 110ms on a curve, lets go over 320, and the lowpass opens from 2.2kHz to
5kHz with it and closes on the way out — a throat, not a switch. The interval
went from a fourth to a fifth, which is consonant *and* louder through a phone
speaker, F4 at 349Hz sitting higher in the band a small driver passes than Eb4
at 311Hz. Modelled at 48kHz and normalised to the old horn's peak: RMS 0.578
against 0.600, band-RMS 0.420 against 0.417. It is not a quieter horn.

**The voice is said twice, and it retries.** A pitch is the worst listening
room there is, so the two lines are said, then said again after a second and a
half — long enough to be a second chance and not an echo, with a chime at the
head of each pass for the bluetooth speaker that has gone to sleep.

Two things were making it silent on iOS and both are fixed. A held
`SpeechSynthesisVoice` goes stale when the list is rebuilt behind the page, and
an utterance carrying a stale one is answered with silence and no error — so
the choice is kept as a name and resolved against the live list at the moment
of speaking. And no `start` inside 700ms is a wedged engine, not a slow one, so
it is cleared and asked again twice, the second ask dropping our voice
entirely. `cancel()` now happens in exactly two places, never on an empty
queue, because a speculative cancel is itself the wedge. `heard.voice` reads
back what happened.

**The field is at the top of the block and it is a form.** You type eight names
and then read them back, so the field used to get further from the thumb with
every name. And on iOS a bare input has no return key — the keyboard shows
`done`, which dismisses it and never reaches the page. Inside a form the return
commits the name, and the arrow is that form's submit button, so both routes
are one handler. Autofill is asked off four ways: `autocomplete`, `autocorrect`,
`spellcheck` and a neutral `name`.

**The interval came off the button.** It was a dimmed second line inside
`KICK OFF`, which made the button a control and a readout at once. It is a chip
of ink centred on the rule above the settings now, next to the three things
that change it.

**What was carried across untouched.** The clock as `Date.now() - kickoff` with
the `visibilitychange` resync; the gauge and its two scales; the ten beeps and
the horn on the crossing; the centred modal and its two flags; the
`navigator.audioSession = 'playback'` fix; the wake lock; `localStorage`
persistence and silent restore; the offline service worker; the `?t=` debug
hook.

**Next.** The field test. Whether the horn is now too polite through a real
bluetooth speaker, whether twice is enough, and whether the reel reads at a
glance from the far post.

**Blocked.** Nothing.

**Open, for Liam.**

- **The two blocks in the file are 12px apart and 24px apart.** Goalkeepers
  puts 12 between the mark and the names, Substitutes puts 24. The build uses
  12 in both, because two identical structures differing by 12px is a slip and
  not a decision.
- **The subs stack is set to fit the room, not to the file's number.** With
  four names the file draws them at 31.9px; the room between the mark and the
  bottom of the block takes 36.8. A fit rule is right and a magic number is
  not, so the build fits.
- **Nothing marks which team a name is on.** That is what grouping by role
  costs, and on a six-a-side pitch it is probably free. It is the first thing
  to look at if the field test is confusing.
- **The reel shows the past.** Two names to the left of centre have already had
  their turn. It is what makes a reel a reel, and it is also two names of
  screen spent on something nobody needs.
- **`brain/design.md` and `spec.md` describe an interface three rebuilds old.**
  Both are still right about the rotation and about why the sounds are what
  they are, and wrong about every screen.
- **No agent can hear any of this,** and now no agent can render it either: the
  horn's graph is proved to build in a real browser, but its loudness is a
  numeric model of the same graph and not an `OfflineAudioContext` render.

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
