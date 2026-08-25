---
read when: You write or change any words in the interface.
---

# copy

Every string is exact. Lift it as written. Character counts are in brackets.

## Tone

1. **State a fact. Never name a category.** `GOAL / DOM` is a fact. `BIBS - NEXT`
   is a category with a slot under it. Test every string against it.
2. **Third person, always.** Never "you" or "your". A bulletin states a fact. An
   instruction picks on a person.
3. **No question is asked of the group. No opinion is stated. No exclamation
   mark anywhere.**
4. **Nothing tells a person how to use the screen.** No `Tap to fix`, no
   `Drag to reorder`. An icon or a handle does that job, or it does not get done.

## Name

Keep `rota`. It appears nowhere in the interface. It earns its place out loud:
"the rota says Sam" moves the instruction off a person and onto an object.

**The app never says its own name.** It used to: the utterance that unlocks the
iOS voice spoke `rota` under a Kick off, and iOS did not honour the volume it
was given, so the app announced itself before it announced the game. The
template below is the only thing spoken, and the name is not in it.

## Register

The sentence is gone. `Bibs in goal DOM sub DAVE` read as one line, and the old
rule made case do the work: capitals for the facts, lowercase for the grammar
that joined them. The labels now sit above the names as eyebrows, so there is no
grammar left to carry. **Size separates the classes, not case.**

- **A name is uppercase and large.** Player names, always.
- **An eyebrow is uppercase and small.** `GOAL`, `SUB`, `SUBS`, `NO SUBS`, `OFF`,
  `ON`. Same case as a name, a fraction of the size. That gap is what stops an
  eyebrow from reading as a name.
- **A team is capitalised, mid-size, and set apart from both.** `Bibs`,
  `No bibs`. Three classes on one row, three looks.
- **A setting label is capitalised and small.** `Game`, `Time`, `Rotations`,
  `Interval`.

Lowercase now survives only inside a setting value. No punctuation on screen.

**`in goal` loses the `in`.** A preposition holds a clause together. Above a name
it joins nothing. `GOAL` [4] labels the slot, and no score exists anywhere in the
app for it to be confused with.

**Team names, unchanged.** `Bibs` and `No bibs` name the physical thing on the
pitch, which is the only way anyone tells the teams apart. Considered and
rejected: `No Bibs`. A capital B invents a proper noun. The team is a
description, not a club. The separation Liam asked for is a visual register, not
a capital letter.

## Setup screen

No heading. The two lists name themselves and the button says what the screen is
for.

| key | string | count |
|---|---|---|
| `setup.teamA` | `Bibs` | 4 |
| `setup.teamB` | `No bibs` | 7 |
| `setup.add.placeholder` | `Add a name` | 10 |
| `setup.divider` | `SUBS` | 4 |
| `setup.keeper.tag` | `GOAL` | 4 |
| `setup.gameType.label` | `Game` | 4 |
| `setup.gameType.value` | `{n} a side` | 8 at 6 |
| `setup.gameTime.label` | `Time` | 4 |
| `setup.gameTime.value` | `2 hours` | 7 |
| `setup.rotations.label` | `Rotations` | 9 |
| `setup.rotations.value` | `{n} each` | 6 at 2 |
| `setup.readout.every` | `Change every` | 12 |
| `setup.readout.each` | `rotations each` | 14 |
| `setup.readout.none` | `—` | 1 |
| `setup.start` | `Kick off` | 8 |
| `setup.clear` | `Clear all` | 9 |
| `setup.restored` | `Delete anyone missing.` | 22 |
| `setup.edit.aria` | `Edit setup` | 10 |

Each card carries its visible label: `aria-label="Game"`, `"Time"` or
`"Rotations"`.

**The three settings, one rule.** *A numeral, then the unit spelled the way it is
said out loud.* Nothing clipped, no symbols. "six a side", "two hours", "twice
each". It is the rule the spoken line already runs on, so the screen and the
voice never disagree about a number.

- `Game` `6 a side`. The value keeps `a side` because `Game 6` means nothing. The
  label is there for the column, not for the value.
- `Time` `45 minutes`, `1 hour`, `1 hour 15`, `2 hours`, `2 hours 30`, `3 hours`.
  Whole hours drop the minutes. Never `120 min`, it makes a person do maths.
- `Rotations` `1 each` through `5 each`. `2 each` reads as "everyone goes in goal
  twice", which is the whole idea. Rejected: `2 turns`, which needs a second word
  to say a turn at what; `x2`, which is a symbol.

Every value fits ten characters, the same ceiling as a name. If the column cannot
hold ten, shorten all three together. One clipped row is what broke this before.

**The readout.** One sentence under the three cards, saying the number they
produce. **There is nothing to tap.** The interval cannot be set by hand, so the
readout is never a control and the third card is always `Rotations`.

- Before kick-off: `CHANGE EVERY 8:30`.
- Mid-game, on the edit screen: `1.8 ROTATIONS EACH`.

The words move to the other side of the number because both readings put the
number where the sentence puts it — you change *every* 8:30, and you get *1.8*
rotations each. `8:30` is a clock, not a spoken unit, and it is the one place
the numeral rule gives way: everybody reads a countdown, and the countdown on the
game screen says `8:30` too. The number always
carries its decimal — `2.0`, never `2` — so the readout is a measurement and not
a count, and `ROTATIONS EACH` stays plural at every value without lying.

Neither line carries an instruction, and neither is a control.

An em-dash when neither squad has two names. Nothing is guessed and nothing says
`0:00`, which would be a number and therefore a lie.

**The keeper marker.** `GOAL`, eyebrow register. The same word and the same look
the player will see live, so the tap shows its own result. Liam's word, my
casing.

**The divider.** `SUBS`, aligned to the region below it. Nothing labels the
region above: those players are on the pitch, which is the default state and has
no name. **Hide the word when no name sits below the line.** A live label over an
empty region is what makes a short squad look broken.

**The input.** `Add a name`, not `Name`. A verb reads as something to do. A bare
noun reads as a value already sitting there, which is why the field was
invisible.

**A squad smaller than the game type.** No message, no warning, no colour. They
play short. The app never says a team is too small to play football.

**Prefilled squad.** Only when the last squad is restored.

## Setup during a live game

**No words beyond the chip.** `Kick off` is replaced by the chip, and the chip
holds a countdown that ticks. A moving number is the proof the game is running,
and it is the only thing on the screen that moves. A line saying the game is
still on would restate what the chip states.

| key | string | count |
|---|---|---|
| `chip.label` | `Next change` | 11 |
| `notice.pending` | `Edits land at the next change` | 29 |

`Edits land at the next change` shows once an edit is made, not before. It earns
its place: a person edits, sees nothing move on the pitch, and edits again.
Shorter, if the space is tight: `Edits land at the change` [24].

## Kick-off countdown

Ten seconds, then the horn. **No words.** Numerals only, with the teams already
on screen behind them.

## Game screen at rest

One row per team, Bibs always first.

```
Bibs        GOAL          SUB
            DOM           DAVE
```

| key | string | count |
|---|---|---|
| `game.team.a` | `Bibs` | 4 |
| `game.team.b` | `No bibs` | 7 |
| `game.keeper` | `GOAL` | 4 |
| `game.sub` | `SUB` | 3 |
| `game.subs` | `SUBS` | 4 |
| `game.subs.none` | `NO SUBS` | 7 |

Three small words carry the whole screen. `SUB` and `SUBS` agree with the count.
Everything else is a name.

**Nothing names the players who are just playing.** No `Playing`, no `Out`, no
`On`. A label there is a category word for a non-fact.

**There is no `Next` at rest.** Who is in goal now and who is the sub now gets
the whole screen. What happens next is stated at the changeover, when it is about
to be true.

**`NO SUBS`** stands alone in the sub slot for a team with none, with no name
under it. It is the statement, not an eyebrow over a gap. Not `NO SUB`, because
zero takes the plural.

**The order list, if the design keeps one.** No heading, no eyebrow, no joining
word. Names in order, and position says the rest.

## The changeover

Ten seconds, a countdown, then the horn. Three facts per team and no more.

| key | string | count |
|---|---|---|
| `change.keeper` | `GOAL` | 4 |
| `change.off` | `OFF` | 3 |
| `change.on` | `ON` | 2 |

`GOAL` does not move or change word between rest and change, so the eye keeps its
place.

**What the words still have to do.** Colour and arrows carry the direction,
leaving against arriving. They cannot carry the role. `GOAL` is the one fact no
arrow can state. `OFF` and `ON` stay because a bare arrow beside a name does not
say whether it points at the pitch or the bench.

**A team with no subs** shows `GOAL` and the name alone. No `OFF`, no `ON`, no
empty labelled slot.

**Hold it after the horn.** The changeover text stays five seconds past the
change, then the rest state returns. Someone who looked up late has to still be
able to read it.

## Sound controls

**There are none.** There was a mute, and it is gone: the volume is on the side
of the phone, and a control that answers a settled question a second time is a
control with no job. Nothing on the screen switches a sound on or off.

**One icon is left, and it reports rather than acts.** The sound test's own
face carries two states and no words:

| state | icon | means |
|---|---|---|
| on | a speaker and its two waves | the voice spoke when it was asked |
| broken | the speaker with no waves, and a cross where they were | it did not |

Shape first, colour second. `--off` is the third signal and it is never the
only one.

| key | string | count |
|---|---|---|
| `test.aria.broken` | `No voice` | 8 |

Broken names the state, not an action — there is no action to offer.

**`No voice` and `Screen may sleep` are not on the screen.** Both were text
labels doing an icon's job. The speaker icon says the first. The second says
itself the moment the screen goes dark. The words survive in a visually hidden
`role="status"` line in the spine, for a reader who cannot see the icon.

| key | string | count |
|---|---|---|
| `notice.noVoice` | `No voice` | 8 |
| `notice.noLock` | `Screen may sleep` | 16 |

## The sound test

One control on the setup screen, beside `Kick off`. It speaks a line and then
sounds the horn, so the sound is checked before the game rather than
discovered during it.

| key | string | count |
|---|---|---|
| `test.aria` | `Test the sound` | 14 |

**No instruction anywhere near it.** It is a speaker icon in a 56px button with
a hairline edge — the same button as `Kick off`, without the fill.

**Its answer takes the readout's row**, because that row is the settings
column's result line and this is a result. It clears itself the moment anything
on the screen changes, and while it is there `Clear all` steps aside to give it
the height.

```
AUDIO WAS {state} · NOW {state} · RATE {n} · SESSION {type|NONE} · HORN {status}
VOICES {n} · QUEUED {YES|NO} · START {YES|NO} · END {YES|NO} · ERROR {code|NONE}
```

```
AUDIO WAS SUSPENDED · NOW RUNNING · RATE 48000 · SESSION PLAYBACK · HORN SCHEDULED
VOICES 44 · QUEUED YES · START YES · END YES · ERROR NONE
```

This is the one place a diagnostic is written out in words, and the reason is
that it gets read down a phone to somebody who is not holding it. Every field
says its own name.

The first line is the path the horn takes and it exists because a silent phone
and a silent bug look the same. `AUDIO WAS` and `NOW` are `AudioContext.state`
either side of the resume, and anything but `NOW RUNNING` is a context that
will make no sound and report no error. `SESSION` is `navigator.audioSession
.type`: `PLAYBACK` is the one that makes iOS ignore the ring/silent switch, and
`NONE` means the phone is too old to have the setting at all. `HORN` is whether
the graph was built and scheduled.

The second line is the voice. `QUEUED` is whether `speechSynthesis.speaking`
went true, which proves the utterance was accepted and nothing else. `START` is
the one that proves a voice.

## The spoken line

Nobody is looking at the screen. It plays through a phone into a speaker.

- **Horn.** The moment is now. Two and a half seconds of stadium horn, the same
  sound at kick-off and at every changeover, and **it finishes before the first
  word.** A spoken name underneath it is a spoken name nobody hears. It is one
  held note: a two-tone klaxon was as loud and read as an emergency.
- **Chime.** Names follow. One short tone, the same every time, about 330ms. It
  sounds before each team, and it marks the seam where a half-listening player
  has to re-latch.

**Template. One, for every change and for kick-off alike.**

```
[chime] {team}. Goal, {keeper}. {Sub|Subs}, {names}.
```

It states **the state, not the transition**: who is in goal and who is sitting
down. A state is true for the next ten minutes; a transition is true for a
second, and a person who looked up late has missed it. `{names}` is one name,
or `{name} and {name}` for two.

At a changeover the line describes the state **after** the change, which is ten
seconds away. At kick-off it describes the state about to start. Bibs first,
always.

**It is the words the screen shows.** The eyebrows are `GOAL` and `SUB`/`SUBS`,
and the voice says goal, sub and subs. Screen and voice finally agree. `SUB` is
stored uppercase because the eyebrow is set from it directly, and read aloud
that is three letters — so the voice takes the same word in the case a sentence
is written in.

A seven-man team, six a side, one sub:

```
[chime] Bibs. Goal, Umar. Sub, Kevin.
```

A six-man team, six a side, no subs — **the clause is dropped and `no subs` is
never said aloud.** It is information nobody can act on:

```
[chime] Non-bibs. Goal, Sam.
```

Two subs:

```
[chime] Bibs. Goal, Umar. Subs, Kevin and Tom.
```

**Full stops, not commas, between the three facts.** The synthesiser honours a
full stop with a real pause and runs a comma straight through, and a name run
into the next name is the one thing that cannot happen here. The comma after
`Goal` and after `Sub` is deliberate and short: it binds the label to the name
it introduces.

**The name is spoken exactly as it was typed.** The screen's uppercase is a
`text-transform` and never reaches the engine.

**The timing.** Horn 0 to 2500, chime at 2650, the first team at 3050, the
second at about 6050, finishing near 8700. A changeover window is ten seconds,
so it fits with a second to spare. It runs the same way at kick-off, where
nothing is waiting on it.

## Errors and edges

| key | string | count | blocks kick-off |
|---|---|---|---|
| `error.team.tooSmall` | `Two names minimum.` | 18 | yes |
| `warn.duplicate` | `Same name twice. Add an initial.` | 32 | no |

**Squad size.** Two names per team is what the rotation needs. With one name that
player is in goal forever.

**Duplicate names.** A warning, never a block. Two Sams rotate correctly. Only
the spoken line is ambiguous, so the message names the real fix.

**Empty input.** No message. Trim it and ignore it.

**Long names.** No message. `maxlength="10"`. Ten characters holds every
realistic first name, the display never truncates, and the voice never reads
something absurd. **The hero name must be sized for ten characters.**

## Cut

Deleted strings. Remove them from `COPY` in `app.js`. Do not leave them unused.

- `elapsed` and `played`. The time-played readout is gone. The spine holds one
  number, the countdown to the next change.
- `then`, the order-list connective. It joined names inside a sentence, and the
  sentence is gone.
- `Starts in goal`, `in goal`, `Game time`, `Change every`, `sub`, `subs`,
  `no subs`, `off`, `on`. All replaced above.
- `Interval`, `{n} minutes`, `Set the interval by hand` and `Work the interval
  out from the rotations`. The manual override is gone: the interval is always
  derived and never editable.
- `No voice` and `Screen may sleep` **as visible labels**. The strings stay, in
  the icon and in a hidden status line. Neither is set on the screen.
- `{name} in goal`, `{names} off` and the separate kick-off template. One
  template states the state now, and it serves both.

**For Liam.** `Time` set the game length so the screen could say how long had
been played. The readout is gone, so `Time` now drives nothing and shows nowhere
on the game screen. Cut it from the setup screen, or give it a job.
