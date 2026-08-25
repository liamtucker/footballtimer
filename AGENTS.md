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
`rota-v10`.

**The buzzer was silent on Liam's iPhone and the voice was not.** That
asymmetry was the whole diagnosis: on iOS the hardware ring/silent switch mutes
Web Audio and does not mute `speechSynthesis`, so a phone on silent says the
names and swallows the horn. Liam confirmed it — the switch was off. The fix is
`navigator.audioSession.type = 'playback'`, set inside the gesture and before
the context is built, because a context takes the session that is current when
it is created. It is feature-detected and the type is read back, not assumed.

- **There is no fallback for an iOS without `audioSession`** (before Safari
  16.4). The established one is a silent looping media element with a
  synthesised WAV data URI, and this app already needs `navigator.wakeLock`,
  which shipped in the same release. If the sound test ever reports
  `SESSION NONE`, that is the moment to carry the weight.
- **`resume()` was never awaited.** It returns a promise and the old code
  dropped it. A context stuck in `suspended` makes no sound and reports no
  error, which looks exactly like a muted phone. The state is now read before
  the resume, again when the promise settles, and watched by `statechange`.
- **Every touch is a second chance.** The pointerdown handler used to stop
  after the first gesture. It now re-claims the session and re-resumes whenever
  the context is not `running`, because a call or a lock leaves it
  `interrupted` and an interrupted context is silent about being silent.

**The alarm is a horn now.** The two-tone klaxon was loud and read as an
emergency — alternation is the strongest emergency cue a sound has, and 1047Hz
is where a smoke alarm lives. A stadium horn is one held note, a couple of
hundred Hertz down, carrying on its harmonics. Two throats, Bb3 and Eb4 a
fourth apart, each a beating pair of sawtooths, driven four times into the soft
clipper, lowpassed at 6.5kHz. The pitch climbs 40 cents into the note and drops
70 cents out of it, because a real horn has to catch and has to run out.

```
the old whistle   peak 0.344   RMS 0.075   crest 4.58    550ms
the klaxon        peak 0.936   RMS 0.469   crest 2.00   2504ms
this horn         peak 0.940   RMS 0.602   crest 1.56   2522ms
```

**Nothing was traded for the timbre. The horn is the loudest of the three and
it does not clip.** A held note has no notches cut in it, so it spends all of
its length at the ceiling where the klaxon spent nine tenths. Through a band
model of a portable speaker — 400Hz to 6kHz — the horn is 0.544 against the
klaxon's 0.513. `buildAlarm`/`ALARM_MS` are `buildHorn`/`HORN_MS`, and the
timeline did not move: horn 0–2500, chime 2650, Bibs 3050.

**The app no longer says its own name.** The utterance that unlocks the iOS
voice spoke `rota` at volume 0.02, and iOS did not honour the volume, so Kick
off announced the app. It could not be replaced by silence: an empty utterance,
a whitespace one and a lone full stop all have no phonemes and are the shapes
that leave the queue stuck. It is now `ok` at rate 10 — about fifty
milliseconds — and it is spent at the **first touch anywhere on the page**,
which during a warm-up is a name field. By the time anyone is listening for a
horn the unlock has happened and Kick off is silent.

**The mute is gone.** The volume is on the side of the phone and a control that
answers a settled question twice has no job. Out: the icon on the spine and on
the live bar, its three states, `state.muted`, the `speak()` guard that held the
slot open while muted, `muteOn`/`muteOff`, and its sections in `copy.md` and
`design.md`. The speaker survives in one place, as the sound test's own face,
with two states instead of three — on and broken.

- **The fault state did not get noisier.** Muting used to suppress `No voice`
  so a muted phone and a broken one did not look alike. With no mute there is
  nothing to suppress, and `degradedVoice` is quiet by construction: it only
  turns on when an utterance was asked for and `start` never fired, so a phone
  that has never been asked never shows it and one spoken word turns it off.
- **The spine holds two icons now**, the stop square and the pencil, 44px each
  and right-aligned. Nothing was left holding space for the third.

**The sound test reports the whole path.** Liam is the only person who can hear
the answer, so it is written out in words and read back:

```
AUDIO WAS SUSPENDED · NOW RUNNING · RATE 48000 · SESSION PLAYBACK · HORN SCHEDULED
VOICES 44 · QUEUED YES · START YES · END YES · ERROR NONE
```

Anything but `NOW RUNNING` is a context that will make no sound and say
nothing about it. `SESSION NONE` means the phone predates the setting.

- **The answer is two lines and the row grows for it.** Landscape has about
  thirty pixels of slack against the seventy-eight the answer wants, so the
  spacer collapses and `Clear all` steps aside while the answer is up; both
  return the moment anything changes, which is the moment the answer goes. The
  row still scrolls inside itself as the last resort, so **Kick off never
  moves.** Verified at 390x844 and 844x390.

**Everything else stands.** The sequence is unchanged and matches what Liam
described: countdown ten seconds, horn, names; interval, horn, names. The
countdown still ticks the last five seconds — measured at 5.0s to 9.0s after
the tap, with the horn at 10.0s, the chime at 12.66s and the first word at
13.07s. One spoken template, `Bibs. Goal, Umar. Sub, Kevin.`, the 400ms drag
hold, the unpinned Kick off, `Clear all` and the stop square are all as they
were.

**Next.** The field test. Whether the horn is the right length on a real
speaker, whether ten seconds of countdown at every change annoys people by
minute forty, and whether one chime is enough.

**Blocked.** Nothing.

**Open, for Liam.**

- **No agent can hear any of this.** The horn is proved by an
  `OfflineAudioContext` render and nothing else. Audibility on the phone rests
  on the session fix, and the sound test's first line is how it gets checked:
  if it says `SESSION PLAYBACK · HORN SCHEDULED · NOW RUNNING` and there is
  still no sound, the theory is wrong and the next suspect is routing the horn
  through an `<audio>` element playing a rendered buffer.
- **The voice has never been proved by an agent.** The automation browser has
  191 system voices and `speak()` queues, but no utterance ever fires `start`,
  `end` or `error` — so the sound test reads `START NO · END NO · ERROR NONE`
  here and the icon shows broken. That is a property of the automation browser,
  not of the app.
- **`speechSynthesis.speaking` is worth nothing.** Measured in Chrome 151 it
  stays `true` for ever on a queued utterance that never starts. Only `start`
  proves a voice.
- **A worst-case announcement can spill past the change.** Two squads of eight
  with two subs each, with a dead engine, runs on estimates to about 10.8s
  against a 10s window. Nothing sounds at the change itself, so the spill is
  silent and harmless — but dropping the first chime would buy 400ms.
- **`OFF` and `ON` are not on the screen.** The design won over `copy.md`.
- **The live bar has no `Next change` label.** The string survives as the
  accessible name of the countdown.
- **`brain/design.md` is 457 lines against a 200-line cap.** Variations B and
  C are the first thing to cut.
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
