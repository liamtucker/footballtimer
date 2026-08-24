# plan

Build order. Each step leaves something that runs.

## Choices made

**One static HTML file, no build step.** Vanilla JS, no framework, no bundler,
no dependencies. It is a timer and a list of names; anything else is weight to
carry to a pitch. Opening `index.html` runs it.

**No backend, no storage of anything that matters.** The whole rotation is a
pure function of elapsed time, so there is nothing to persist except the setup.

**Add to home screen, offline.** A minimal web manifest and a service worker
that caches the one page. No signal at the pitch is the normal case, not the
edge case.

**Web Speech API** (`speechSynthesis`) for the announcement. Built into both
phones, works offline, no install, no permission prompt.

## 1. Rotation engine

A pure function, written and tested before any interface exists. It is the whole
system; everything else is a screen around it.

```
rotation(setup, elapsedMs) -> { intervalMs, changeIndex, msToNextChange,
                                teams: [{ keeper, subs, order }, ...] }
```

No stored state, no mutation, no clock inside it. Given the same setup and the
same elapsed time it returns the same answer, which is what makes the app
recoverable after a phone dies mid-game.

Tests, as plain assertions in a second file:

- interval maths, including the 15-second floor
- subs per team derived from squad size — 6, 7, 8 players
- the first keeper is the last name entered
- the loop wraps and every player gets `S` shifts across the duration
- the sub slot never lands on the keeper, and never on the player who has just
  come out of goal
- uneven teams: larger squad gets exactly `S`, smaller gets more
- a late arrival covers one shift without advancing the clock, and does not come
  round again inside a full lap

## 2. Setup screen

Duration, shifts each, and two columns of names typed in arrival order. Defaults
of 90 and 2 already filled in, so the common case is type twelve names and hit
start.

Show the computed interval as it is typed — it is the number that decides
whether the settings are sane, and it should be visible before kick-off rather
than discovered at minute forty.

## 3. Display screen

The countdown, and per team: goal and sub(s) now, goal and sub(s) next, and the
live order. Big type, high contrast, landscape, legible from the pitch in
daylight.

Drives off `Date.now()` minus kick-off, calling the engine — never off an
accumulating counter, which drifts and breaks when a phone sleeps.

## 4. Announcement

Speak the change: each team's incoming keeper and sub. Fire on the change
crossing, not on a tick, so a delayed frame can't skip it.

## 5. Staying alive

- **Wake Lock API** so the screen doesn't sleep for ninety minutes
- **localStorage** holding the setup and the kick-off timestamp, restored on
  load, so a dropped or refreshed phone picks the game back up where it is

## 6. The two roster taps

Add a late arrival, and mark someone gone — per the open decision in the spec.
Both are one tap and a name. Deliberately last, so the thing works without them
and they cannot creep into being the main interface.

## 7. Field test

Two games. What to watch:

- does the sub actually read it out, or does it go back to Liam
- is the interval right at 90 minutes, or does it want to be shorter
- does anyone argue — and if so, about what, because that is the next spec
