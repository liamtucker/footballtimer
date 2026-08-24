---
read when: You write or change any words in the interface.
---

# copy

Every string is exact. Lift it as written. Character counts are in brackets.

## Voice

1. **State a fact. Never name a category.** `Bibs in goal DOM` is a fact.
   `BIBS - NEXT` is a category with a slot under it. That is what got this file
   rewritten. Test every string against it.
2. **Third person, always.** Never "you" or "your". A bulletin states a fact. An
   instruction picks on a person.
3. **No question is ever asked of the group, and no opinion is ever stated.**
   No exclamation mark anywhere.
4. **Nothing tells a person how to use the screen.** No `Tap to fix`, no
   `Drag to reorder`. An icon or a handle does that job, or it does not get done.

## Name

Keep `rota`. The feedback does not touch it. The name appears nowhere in the
interface, so it cannot fail the fact test. It earns its place out loud: "the
rota says Sam" moves the instruction off a person and onto an object.

## Register

- **A NAME is uppercase and large.** Player names, always.
- **A connective is lowercase and small.** `in goal`, `sub`, `off`, `on`.
- **A team is capitalised and small.** `Bibs`, `No bibs`.

Capitals carry the facts. Lowercase carries the grammar that joins them. No
punctuation on screen, space does the joining. `and` exists only in speech.

## Setup screen

No heading. The two lists name themselves and the button says what the screen is for.

| key | string | count |
|---|---|---|
| `setup.teamA` | `Bibs` | 4 |
| `setup.teamB` | `No bibs` | 7 |
| `setup.add.placeholder` | `Add a name` | 10 |
| `setup.divider` | `Subs` | 4 |
| `setup.keeper.tag` | `Starts in goal` | 14 |
| `setup.gameType.value` | `{n} a side` | 8 at 6 |
| `setup.gameTime.label` | `Game time` | 9 |
| `setup.gameTime.value` | `2 hours` | 7 |
| `setup.change.label` | `Change every` | 12 |
| `setup.change.value` | `{n} min` | 6 at 10 |
| `setup.start` | `Kick off` | 8 |
| `setup.clear` | `Clear all` | 9 |
| `setup.restored` | `Delete anyone missing.` | 22 |
| `setup.edit.aria` | `Edit setup` | 10 |

**The input.** `Add a name`, not `Name`. A verb reads as something to do. A bare
noun reads as a value already sitting there, which is why the field was
invisible. Words do half of this. The field also needs a caret, a rule or a `+`.

**The divider.** One word, on the line, aligned to the region below it. Nothing
labels the region above it: those players are on the pitch, which is the default
state and has no name. **Hide the word when no name sits below the line.** A live
label over an empty region is what makes a short squad look broken.

**The keeper marker.** `Starts in goal` says it is a start-of-game fact, so
nobody reads it as a permanent job.

**Settings.** `6 a side` carries its own label, so it has none. The other two need
one, because a bare duration is ambiguous against another bare duration.
`Change every`, not `Sub duration`, so the setting, the countdown and the spoken
line share one word.

**Duration values.** Whole hours read `2 hours`, `1 hour`. Hours plus minutes read
`1 hour 30`. Under an hour reads `45 min`. `Change every` is always `{n} min`.
Never `120 min` for the game time, it makes a person do maths.

**A squad smaller than the game type.** No message, no warning, no colour. They
play short. The app never says a team is too small to play football.

**Prefilled squad.** Only when the last squad is restored. The reorder half of
the old line is cut: order is now taught by the divider and the drag handle.

**Back to setup mid-game.** An icon, no visible label. `aria-label="Edit setup"`.

## Kick-off countdown

Ten seconds, then a whistle. **No words.** Numerals only, with the team sentences
already on screen behind them.

## Game screen at rest

The model sentence is *"bibs in goal Dom, subs Dave"*. One line per team, Bibs
always first.

```
Bibs      in goal  DOM      sub   DAVE
No bibs   in goal  SAM      subs  TOM  ALEX
```

| key | string | count |
|---|---|---|
| `game.team.a` | `Bibs` | 4 |
| `game.team.b` | `No bibs` | 7 |
| `game.keeper` | `in goal` | 7 |
| `game.sub` | `sub` | 3 |
| `game.subs` | `subs` | 4 |
| `game.subs.none` | `no subs` | 7 |
| `game.order` | `then` | 4 |

Four small words carry the whole screen. `in goal` is the product and cannot be
cut. `sub` / `subs` agrees with the count. Everything else is a name.

**Nothing names the players who are just playing.** No `Playing`, no `Out`, no
`On`. A label there is a category word for a non-fact, which is the mistake
`BIBS - NEXT` made.

**There is no `Next` at rest.** Who is in goal now and who is the sub now is the
most important information, and it gets the whole screen. What happens next is
stated at the changeover, when it is about to be true.

**`no subs`** sits in the sub slot for a team with none. Not an empty slot, which
reads as a fault. Not `No sub`, because zero takes the plural.

**The order list, if the design keeps one.** No heading. The names follow the
sentence, joined by `then`: `sub DAVE then CHRIS MO ALI`. Take `then` only if the
list is on the same line. A separate strip takes nothing.

## The changeover

Ten seconds, a countdown, then the whistle. Three facts per team and no more.

```
Bibs      in goal  CHRIS      off  MO      on  DAVE
No bibs   in goal  SAM        off  ALEX    on  TOM
```

| key | string | count |
|---|---|---|
| `change.keeper` | `in goal` | 7 |
| `change.off` | `off` | 3 |
| `change.on` | `on` | 2 |

**What the words still have to do.** Colour and arrows carry the direction,
leaving against arriving. They cannot carry the role. `in goal` is the one fact
no arrow can state. `off` and `on` stay because a bare arrow beside a name does
not say whether it points at the pitch or the bench.

**The player leaving goal is never named.** He is standing in the goal watching
the incoming keeper walk at him.

**A team with no subs** shows `in goal CHRIS` alone. No `off`, no `on`, no empty
labelled slot.

**Hold it after the whistle.** The changeover text stays five seconds past the
change, then the rest sentence returns. Someone who looked up late has to still
be able to read it.

**Rejected.** `in goal DOM > CHRIS   sub DAVE > MO`, the rest sentence with arrows
spliced in. Fewer words, but the arrow has to mean "becomes", `sub DAVE > MO`
reads as Dave subbing for Mo, and it spends a name on the outgoing keeper.

## The spoken line

Nobody is looking at the screen. It plays through a phone into a speaker, at the
**start** of the ten seconds, so the named players have the countdown to walk.
The whistle lands at the end.

**Two sounds, two meanings, never swapped.**

- **Chime.** Names follow. One short tone, the same tone every time, no melody,
  about 400 ms. It sounds before each team.
- **Whistle.** The change is now. Nothing else uses it.

The chime is what the throwaway first word used to be. A sleeping Bluetooth
speaker eats the first token of any audio, so nothing carrying information may go
first. The chime absorbs that and protects the words behind it. Sounding it
before **each** team also marks the seam where a half-listening player has to
re-latch, which is where the sound was asked for.

**Template, a normal change.**

```
[chime] {teamA}. {keeperA} in goal. {subsA} off. [chime] {teamB}. {keeperB} in goal. {subsB} off.
```

`Bibs. Chris in goal. Mo off.` [chime] `No bibs. Sam in goal. Alex off.`

**Template, kick-off.**

```
[chime] {teamA}. {keeperA} in goal. Sub, {subsA}. [chime] {teamB}. {keeperB} in goal. Sub, {subsB}.
```

`Bibs. Chris in goal. Sub, Dave.` [chime] `No bibs. Sam in goal. Subs, Tom and Alex.`

Nobody comes "off" at kick-off, they never went on. Role before the name here,
for the same reason the team goes before the names.

**Template, a team with no subs.** Drop the sub clause for that team only.

```
[chime] Bibs. Chris in goal. [chime] No bibs. Sam in goal. Alex off.
```

Never say `no subs` out loud. It is information nobody can act on.

**Slots.** `{subs}` is one name, or `{name} and {name}` for two. `Sub,` becomes
`Subs,` for two. Nothing else varies.

**Use this one.** Reasons:

- Two facts per team: who goes in goal, and who comes off. Both are people who
  have to move. The player coming on is the one person watching the screen, and
  the player leaving goal is already standing there.
- The team comes before the names, so nobody parses a name that is not theirs.
- Full stops, not commas. They give the synthesiser a real pause. Commas run the
  names together at pitch distance.
- About seven seconds, so it finishes inside the ten. If it runs long, cut a name
  before you cut a pause.
- The only variable words are names, so twelve repeats wear well and none of it
  can be argued with.

**Option B, one chime.** Sound it once at the start and separate the teams with a
longer pause. Quieter, 12 tones over two hours instead of 24. Costs the listener
who tunes in halfway: no marker tells him the second team has started. Take this
only if the field test says the chime is annoying.

**Option C, grouped by role.** `[chime] In goal, Chris and Sam. [chime] Off, Mo
and Alex.` Fewest fixed words. Rejected: every listener has to hold both teams in
mind across the whole utterance to know which name is his.

**On `off`.** A referee says "off" to a person. This says it about a person, with
no name addressed and no imperative. Never `Mo, you're off`.

**Build note.** `speechSynthesis` cannot schedule a sound inside an utterance.
Split it into two utterances and fire the chime from an `<audio>` element before
each, on the `end` of the one before.

## Time played

The clock counts up from kick-off. `h:mm`, no leading zero on the hour: `0:07`,
`1:12`, `2:34`.

**Past the game time it does nothing.** It keeps counting: `2:07`, `2:31`. No
marker, no colour, no `Time up`, no `Round 2`. The app never decides when the
game ends.

**Two clocks on one screen.** The change countdown reads `m:ss` and ticks every
second. Time played reads `h:mm` and visibly does not. That separates them
without a word. If the design still needs one, `played` [6] goes beside the time
played, lowercase and small. Never a word on the countdown.

## Errors and edges

| key | string | count | blocks kick-off |
|---|---|---|---|
| `error.team.tooSmall` | `Two names minimum.` | 18 | yes |
| `warn.duplicate` | `Same name twice. Add an initial.` | 32 | no |

**Squad size.** The floor is two names per team, which is what the rotation
needs. With one name that player is in goal forever. Anything above two plays,
short-handed or not, with no comment.

**Duplicate names.** A warning, never a block. Two Sams rotate correctly. Only
the spoken line is ambiguous, so the message names the real fix.

**Empty input.** No message. Trim it and ignore it.

**Long names.** No message. `maxlength="10"`. Ten characters holds every
realistic first name, the display never truncates, and the voice never reads
something absurd. A longer paste is cut at ten, silently. **The hero name must be
sized for ten characters.** If the design cannot hold ten, come back here before
dropping the limit.
