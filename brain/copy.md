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
- **A setting label is capitalised and small.** `Game`, `Time`, `Intervals`.

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
| `setup.change.label` | `Intervals` | 9 |
| `setup.change.value` | `10 minutes` | 10 |
| `setup.start` | `Kick off` | 8 |
| `setup.clear` | `Clear all` | 9 |
| `setup.restored` | `Delete anyone missing.` | 22 |
| `setup.edit.aria` | `Edit setup` | 10 |

Each select carries its visible label: `aria-label="Game"`, `"Time"`,
`"Intervals"`.

**The three settings, one rule.** *A numeral, then the unit spelled the way it is
said out loud.* Nothing clipped, no symbols. "six a side", "two hours", "ten
minutes". It is the rule the spoken line already runs on, so the screen and the
voice never disagree about a number.

- `Game` `6 a side`. The value keeps `a side` because `Game 6` means nothing. The
  label is there for the column, not for the value.
- `Time` `45 minutes`, `1 hour`, `1 hour 15`, `2 hours`, `2 hours 30`, `3 hours`.
  Whole hours drop the minutes. Never `120 min`, it makes a person do maths.
- `Intervals` `3 minutes` through `20 minutes`.

Every value fits ten characters, the same ceiling as a name. If the column cannot
hold ten, shorten all three together. One clipped row is what broke this before.

`Intervals` is plural over a single duration. It reads as "the intervals are ten
minutes long", which is true.

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

Ten seconds, then a whistle. **No words.** Numerals only, with the teams already
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

Ten seconds, a countdown, then the whistle. Three facts per team and no more.

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

**Hold it after the whistle.** The changeover text stays five seconds past the
change, then the rest state returns. Someone who looked up late has to still be
able to read it.

## Sound controls

**The mute is an icon and nothing else.** A speaker, and a speaker with a slash.
The state proves itself within one interval: the change comes and it either
speaks or it does not. A word beside it would say what the icon says.

| key | string | count |
|---|---|---|
| `mute.aria.on` | `Mute voice` | 10 |
| `mute.aria.off` | `Unmute voice` | 12 |

The label names the action, not the state, and swaps with the state. `voice` is
in it because the whistle and the chime are separate sounds. Drop to `Mute` [4]
and `Unmute` [6] only if the control silences everything.

**Muted is not a fault.** Suppress `No voice` while muted. The two look alike and
mean opposite things.

| key | string | count |
|---|---|---|
| `notice.noVoice` | `No voice` | 8 |
| `notice.noLock` | `Screen may sleep` | 16 |

## The spoken line

Nobody is looking at the screen. It plays through a phone into a speaker, at the
**start** of the ten seconds, so the named players have the countdown to walk.
The whistle lands at the end.

- **Chime.** Names follow. One short tone, the same tone every time, no melody,
  about 400 ms. It sounds before each team.
- **Whistle.** The change is now. Nothing else uses it.

A sleeping Bluetooth speaker eats the first token of any audio, so nothing that
carries information may go first. The chime absorbs that. It sounds before
**each** team to mark the seam where a half-listening player has to re-latch.

**The voice keeps the grammar the screen dropped.** The screen says `GOAL`. The
voice says "Chris in goal". A label and a sentence are different jobs.

**Template, a normal change.**

```
[chime] {teamA}. {keeperA} in goal. {subsA} off. [chime] {teamB}. {keeperB} in goal. {subsB} off.
```

`Bibs. Chris in goal. Mo off.` [chime] `No bibs. Sam in goal. Alex off.`

**Template, kick-off.** Nobody comes "off" at kick-off, they never went on.

```
[chime] {teamA}. {keeperA} in goal. Sub, {subsA}. [chime] {teamB}. {keeperB} in goal. Sub, {subsB}.
```

`Bibs. Chris in goal. Sub, Dave.` [chime] `No bibs. Sam in goal. Subs, Tom and Alex.`

**Template, a team with no subs.** Drop the sub clause for that team only. Never
say `no subs` out loud. It is information nobody can act on.

```
[chime] Bibs. Chris in goal. [chime] No bibs. Sam in goal. Alex off.
```

**Slots.** `{subs}` is one name, or `{name} and {name}` for two. `Sub,` becomes
`Subs,` for two. Nothing else varies.

Two facts per team, both about people who have to move. The team comes before the
names, so nobody parses a name that is not theirs. Full stops, not commas, for a
real pause. About seven seconds, inside the ten. If it runs long, cut a name
before you cut a pause.

**Option B, one chime.** Sound it once at the start and separate the teams with a
longer pause. Quieter, 12 tones over two hours instead of 24. Costs the listener
who tunes in halfway. Take it only if the field test says the chime is annoying.

**Build note.** `speechSynthesis` cannot schedule a sound inside an utterance.
Split it into two utterances and fire the chime from an `<audio>` element before
each, on the `end` of the one before.

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

**For Liam.** `Time` set the game length so the screen could say how long had
been played. The readout is gone, so `Time` now drives nothing and shows nowhere
on the game screen. Cut it from the setup screen, or give it a job.
