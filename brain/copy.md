---
read when: You write or change any words in the interface.
---

# copy

Every string is exact. Lift it as written. Character counts are in brackets.

## Voice

1. **Third person, always.** Never "you" or "your". A bulletin states a fact. An
   instruction picks on a person. This is the whole product.
2. **No question is ever asked of the group.** The app absorbs the question. It
   never passes it back.
3. **State, not verdict.** "In goal" is a state. "Your turn" is a verdict.
4. **Nothing enthusiastic and nothing wry.** No exclamation mark anywhere.

## Name

Keep `rota`. Home-screen name, lowercase, four characters, so both phones show
it whole under the icon.

The name earns its place out loud, not on screen. "The rota says Sam" moves the
instruction off a person and onto an object, which is the mechanism the README
describes. `Keeper` names the punishment. `Six a Side` names the game, not the
job. `rota` names the admin.

The name appears nowhere in the interface.

## Setup screen

No heading. The fields name themselves and the button says what the screen is
for.

| key | string | count |
|---|---|---|
| `setup.duration.label` | `Duration` | 8 |
| `setup.duration.unit` | `min` | 3 |
| `setup.shifts.label` | `Shifts each` | 11 |
| `setup.teamA.label` | `Bibs` | 4 |
| `setup.teamB.label` | `No bibs` | 7 |
| `setup.name.placeholder.first` | `First to arrive` | 15 |
| `setup.name.tag.last` | `In goal first` | 13 |
| `setup.interval` | `Change every 7:30` | 17 |
| `setup.start` | `Kick off` | 8 |
| `setup.clear` | `Clear all` | 9 |

**Team labels.** `Bibs` and `No bibs` beat `Team 1` and `Team 2`. A player out of
breath resolves a bib by a glance at their own chest. A team number has to be
remembered. The same two words serve setup, display and announcement, so there
is one word to learn. Not editable in v1.

**Arrival order.** Two elements carry it. No helper sentence.

- `First to arrive` is the placeholder in the first empty row of each column
  only. It lands at the moment of typing name one, the only moment the rule can
  still be obeyed. Rows two and after carry no placeholder.
- `In goal first` is a live tag beside the last filled name in each column. It
  moves down as names are typed. It states the incentive as a fact, at the moment
  the fact becomes true, and it cannot be skimmed past because it moves.

**Interval readout.** `Change every 7:30`. Verb first, and `Change` is the same
word the display and the announcement use. Format is `m:ss`. Hide the whole
readout until both teams hold at least two names.

**Start button.** `Kick off`. It is pressed at kick-off, not during setup, and
the word says so. `Start` is more literal but invites a press in the warm-up.

**First run.** No extra string. The defaults are filled and the placeholder is
the empty state.

**Prefilled squad.** Shown only when the last squad is restored:

`Reorder for today. Delete anyone missing.` [41]

Verb first, both actions, no narration. `Clear all` sits beside it.

## Display screen

| key | string | count |
|---|---|---|
| `display.keeper.label` | `In goal` | 7 |
| `display.sub.label` | `Sub` | 3 |
| `display.subs.label` | `Subs` | 4 |
| `display.subs.none` | `No sub` | 6 |
| `display.next.label` | `Next` | 4 |
| `display.order.label` | `Goal order` | 10 |
| `display.change` | `Change` | 6 |
| `display.lap` | `Round 2` | 7 |

**Now has no label.** It is the largest thing on the screen. `Next` is the only
section label.

**No sub.** A team of six shows `No sub` in place of the whole sub block. An
empty labelled slot reads as a fault.

**Goal order** over `Order`. The list is not the order the names were typed, and
`Goal` says which order it is before anyone can misread it.

**Countdown.** `m:ss`. At zero the countdown is replaced by `Change` for three
seconds, then the new countdown starts. The word is the loudest available signal
and it matches what the voice says at the same instant.

**Past the duration.** `Round 2`, then `Round 3`, and so on. It appears the
moment the rotation wraps and it never leaves. It answers the only question a
player has when their name comes up a third time: everyone has been in, and this
is a second lap. Never `Time up`. The app does not decide when the game ends.

## Announcement

Spoken by `speechSynthesis` at kick-off and at every change. Both teams in one
utterance. Bibs always first, every time, so a half-listening player knows when
their half arrives.

**Template.**

```
{event}. {teamA}. {keeperA} in goal. {subsA} off. {teamB}. {keeperB} in goal. {subsB} off.
```

- `{event}` is `Kick off` at kick-off and `Change` at every change.
- No sub: drop ` {subs} off.` for that team.
- Two subs: `{sub1} and {sub2} off.`

**Example.** `Change. Bibs. Sam in goal. Danny off. No bibs. Tom in goal. Alex off.`

**Use this.** Reasons:

- The team comes before the names, so nobody parses a name that is not theirs.
- `Change` is a throwaway first word. The first word of a spoken utterance is the
  one most likely to be clipped or missed, so it must carry no information and
  must protect the team name behind it.
- Full stops, not commas. They give the synthesiser a real pause. Commas run the
  names together at pitch distance.
- Only two names per team are spoken. The player leaving goal and the player
  coming on are both derivable by the people standing there.
- Nothing in it is an opinion, so nothing in it can be argued with. Twelve
  repeats wear well because the only variable words are names.

**Option B, stateful.** `Change. Bibs. Sam in goal. Danny is sub. No bibs. Tom in
goal. Alex is sub.` Matches the display label exactly and reads a shade softer.
Costs two syllables per team and parses a fraction slower. Take this only if a
field test shows `off` is misheard as "gone home".

**Option C, grouped by role.** `Change. In goal, Sam for the bibs and Tom for no
bibs. Subs, Danny and Alex.` Fewest fixed words. Rejected: every listener has to
hold both teams in mind across the whole utterance.

**On `off`.** A referee says "off" to a person. This says it about a person, with
no name addressed and no imperative. Third person is what keeps it a bulletin.
Never `Danny, you're off`.

## Mid-game actions

Two buttons. Parallel words, so neither reads as the punitive one.

| key | string | count |
|---|---|---|
| `action.add` | `Arrived` | 7 |
| `action.remove` | `Gone` | 4 |
| `add.placeholder` | `Name` | 4 |
| `add.confirm` | `Add` | 3 |
| `add.result` | `{name} is in goal at the next change.` | 35 |
| `remove.result` | `{name} gone.` | 10 |
| `remove.undo` | `Undo` | 4 |

`Arrived` and `Gone` are both reports of something that already happened. Neither
is a decision and neither is done to a person. `Add name` and `Remove name` are
the plainer option and are rejected: `Remove` is something the operator does to
a player, while `Gone` is something the player did.

`Arrived` opens a field with the placeholder `Name` and the button `Add`. The
result line is required. It states the fairness rule so nobody has to argue it: a
late arrival covers the very next shift.

`Gone` opens the list of names already on screen. No heading and no confirm
dialogue, because a confirm dialogue asks for a judgement. `Undo` sits beside the
result line for four seconds instead.

## Errors

| key | string | count | blocks kick-off |
|---|---|---|---|
| `error.team.tooSmall` | `Two names minimum.` | 18 | yes |
| `warn.duplicate` | `Same name twice. Add an initial.` | 32 | no |

**Squad size.** The only floor is two names per team, which is what the rotation
maths needs. The app never says a team is too small to play football. That is a
judgement and it is not the app's.

**Duplicate names.** A warning, never a block. Two Sams rotate correctly. Only
the spoken line is ambiguous, so the message names the real fix and nothing else.

**Empty name field.** No message. Trim blank rows and ignore them.

**Long names.** No message. Set `maxlength="12"` on every name field. Twelve
characters holds every realistic first name, so the display never truncates and
the voice never reads something absurd. A longer paste is cut at twelve,
silently.
