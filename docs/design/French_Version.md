# A French version of Bee Garden

A plan for playing the whole game in French: the interface, the notes and hints, the results,
Bee and Meadow Facts and the bee lore cards. Drafted 2026-10-04 (Lynn: "someone in France is
interested"). Nothing is built yet. The decisions for Lynn are listed first.

## Decisions for Lynn

1. **The title.** The title screen spells "Bee Garden" in hand-made letters (`titleLetters` in
   `src/ui.ts`). The options:
   - keep "Bee Garden" as the name everywhere, with a French tagline under it;
   - make French letters too: *Le Jardin des abeilles*, or the shorter *Jardin d'abeilles*.
     These are longer, so the letters would need resizing.
2. **Tu or vous.** The game speaks to the player ("Sip its nectar first", "Your wings are
   rested"). French games usually say *tu*, which suits the gentle, close voice; *vous* is more
   formal. Proposed: *tu*.
3. **Who reviews.** A native speaker, ideally the person who asked, reads the draft for tone
   and natural phrasing. Claude can draft all of it; a careful second reader matters most for
   the facts pages and the lore.
4. **How far it goes.** Proposed for the first release: the game itself (interface, facts and
   lore). The README and guides can stay in English, perhaps with a short French player guide
   later. The showcase video could get French captions afterwards; `video/assemble.py` keeps
   its captions in one list, so that's easy.

## What there is to translate

About 500 short strings and about 8,000 words of longer text, by a rough count of the source:

| Where | What | Roughly |
| --- | --- | --- |
| `src/ui.ts` | Title, buttons, panels, field guide, labels, results, the mobile note, ARIA labels and tooltips | 170 strings |
| `src/garden.ts` | Notes at the top (63 `notify()` calls), hints at the bottom (25), panel lines | 130 strings |
| `src/day-report.ts` | Results titles, the Queen's lines, the "why" and next-summer lines | 17 KB of text |
| `src/weather.ts`, `src/meadow-plan.ts` | Morning notes, season lines, the friends' change lines | 30 strings |
| `src/bee-facts.ts` | Bee and Meadow Facts: about 20 pages of nature, game and spotting text, plus source labels | 44 KB |
| `src/lore.ts` | The ten lore cards and their labels | 10 cards |
| `src/*-art.ts` | Words inside the SVG art (labels, titles) | 60 strings |
| `index.html` | `lang`, page title, description | 3 |

## How it would work

### One dictionary per language

- **`src/i18n/en.ts`** holds every English string under a key, grouped by place: `ui.*`,
  `notes.*`, `hints.*`, `results.*`, `facts.*`, `lore.*`. **`src/i18n/fr.ts`** has the same
  shape. TypeScript checks that it does, so a missing French string is a build error, not a
  blank on screen.
- **`t('notes.cloudGathering')`** looks a string up. Strings with numbers or names take
  parameters: `t('results.flowersPollinated', { count: 13 })`.
- **Long content** (facts pages, lore cards) lives in data files per language,
  `bee-facts.en.ts` and `bee-facts.fr.ts`, keyed by the same page ids, rather than as
  dictionary entries.
- **The French files load only for French players** (a dynamic `import()`), so the English
  build stays the size it is.

### Grammar that English lets us skip

Several lines are built from pieces, and that won't work in French:

- `${count} ${one|many} found today`
- "2 pollinated (a poppy and a daisy)"
- "Next summer: fewer daisies, poppies and ladybirds"

French needs gender and agreement: *le coquelicot*, *la marguerite*, *le bleuet*;
*la coccinelle*, *le papillon*, *la fourmi*; "3 coccinelles trouvées aujourd'hui" against
"3 papillons trouvés aujourd'hui".

The plan is to rewrite each such builder as a whole sentence per language, with plural forms
from `Intl.PluralRules`. Each species and friend gets its gender and its singular and plural
forms in the dictionary. A list of about 10 to 15 builders, mostly in `day-report.ts`,
`ui.ts` (the results stats) and `garden.ts` (`foundAgain`).

### Numbers, units and typography

- **Numbers:** `Intl.NumberFormat` for decimals and percentages, so 3.3 m becomes *3,3 m* and
  55% becomes *55 %* (with a narrow no-break space).
- **Time:** "2m 18s" becomes *2 min 18 s*.
- **Punctuation:** French puts a narrow no-break space before `; : ! ?` ("Des fourmis !"), and
  uses « guillemets ». The dictionary holds the text this way; a small helper fixes any space
  that slips through.
- **Capital letters:** the small-caps labels (HAPPY MEADOW, MORNING) are CSS uppercase on
  normal text, which works for French. *Été* needs its accent kept in capitals: *ÉTÉ*.

### The keyboard: AZERTY

Most French keyboards are **AZERTY**, and this matters even before any translation. The game
reads keys by position (`e.code`: `KeyW`, `KeyA`, `KeyQ`…), so movement already works on an
AZERTY keyboard: the key in the W position is labelled **Z** there. But every key the game
shows on screen would be wrong:

| The game shows | On AZERTY, the key in that place is |
| --- | --- |
| W A S D | Z Q S D |
| Q (Bee Vision) | A |
| M (sound) | , (M sits elsewhere) |
| E, R, F, Space, Ctrl | the same |

The plan is to show the player's real key labels:

- **In Chrome and Edge,** `navigator.keyboard.getLayoutMap()` gives the label for each
  physical key, and the guide, hints and Small wonders use it.
- **Elsewhere,** assume AZERTY when the browser language is French, with a choice in the
  field guide ("Clavier : AZERTY / QWERTY").
- **Sound:** bind it to both `KeyM` and the key labelled M (`Semicolon` on AZERTY), so "M"
  stays true.

This would help French players using the English version too, so it could ship first.

### Choosing the language

- **Automatic:** French when the browser's language starts with `fr`, English otherwise.
- **By hand:** a small **EN · FR** switch on the title screen and in the field guide. It is
  remembered in the browser, like the lore switch.
- **For links and tests:** `?lang=fr` forces it.
- `<html lang>` follows the choice, so screen readers pronounce it right.

## The French content

### Names

A glossary, for the native reader to check:

| English | French |
| --- | --- |
| Corn poppy | coquelicot (*Papaver rhoeas*) |
| Oxeye daisy | grande marguerite (*Leucanthemum vulgare*) |
| Cornflower | bleuet (*Centaurea cyanus*) |
| Ladybird | coccinelle |
| Aphids | pucerons |
| Black garden ant | fourmi noire des jardins (*Lasius niger*) |
| Banded snail | escargot des haies (*Cepaea nemoralis*) |
| Common blue | azuré commun (*Polyommatus icarus*) |
| Meadow brown | myrtil (*Maniola jurtina*) |
| Small tortoiseshell | petite tortue (*Aglais urticae*) |
| Small white | piéride de la rave (*Pieris rapae*) |
| Caterpillar | chenille |
| Fairy ring | rond de sorcières |
| Honeydew | miellat |
| Hive, the Queen | la ruche, la Reine |
| Bee Vision | Vision d'abeille |
| Meadow friends | les amis du pré |

### Bee and Meadow Facts

- **Translate the pages,** keeping the "In nature / In this game" structure and the gentle
  register.
- **Sources:** where a good French source exists, add it next to the English one, for example
  OPIE (insects), INPN or MNHN (species) and ITSAP (bees). The English sources stay; a French
  reader can still follow them.
- **Units** are already metric.

### Bee lore

The lore cards are where French can be better than a translation:

- **French verse** instead of the English poems, all public domain. Strong candidates:
  - Victor Hugo, "Le Manteau impérial" (*Les Châtiments*, 1853): "Oh ! vous dont le travail est
    joie…" (wording to verify against the 1853 text), a whole poem addressed to bees;
  - La Fontaine, "Les Frelons et les Mouches à miel" (*Fables* I, 21, 1668).

  Dickinson's prairie and Watts's busy bee could be translated (both are public domain), or
  left to the English version.
- **French bee customs:** in parts of France, beekeepers told the bees of a death and put
  crêpe on the hives (*prendre le deuil*). To verify and source before it goes on a card.
- **Weather sayings:** French proverbs about bees and rain, to research. The Aristotle,
  Aratus, Pliny and Virgil cards translate directly.
- **The card labels:** *Une ancienne croyance*, *On croyait autrefois*, *En vers*.

The rules in `docs/research/Bee_Folklore.md` hold in French too: lore is labelled as belief,
each card names its culture and source, and only public-domain quotations are used.

## Layout: French runs about 20% longer

The places most likely to overflow:

- the results card;
- the top notes (one or two lines);
- the bottom hints;
- the flower panel;
- the field guide grid;
- the lore cards (fixed 300 × 196);
- the summer start page.

To catch them:

- **A pseudo-language** (`?lang=xx`) wraps every string in accents and adds about 40% length:
  "[Ŝíp ìts ñéçtàr fìrst ~~~~~]". Any English left on screen is a string that was missed, and
  anything cut off or overlapping shows a layout to loosen.
- **An overflow test** loads each screen in French and in the pseudo-language and fails if
  any text box overflows its container.
- **Lore cards** get one more line of room if needed. The verse cards already hold four lines.

## Tests

- **The existing tests stay in English.** `?test` keeps English unless `&lang=` is given, so
  the about 150 tests that check English text don't change.
- **New tests:**
  - every key exists in both languages (also checked by TypeScript);
  - the French title, a day's notes, results and a facts page render with no English left
    and no overflow;
  - plural and gender lines ("1 coccinelle trouvée", "3 papillons trouvés");
  - AZERTY labels in the guide when the layout map says so.

## Order of work

1. **Key labels from the real layout** (AZERTY). Small, independent, and it helps now.
2. **Pull the strings out** into `en.ts` with `t()`, with no change to what anyone sees. This
   is the big mechanical step, file by file (`ui.ts`, `garden.ts`, `day-report.ts`,
   `weather.ts`, `meadow-plan.ts`, the art files). The test suite should pass unchanged after
   each file.
3. **Rewrite the sentence builders** for grammar, still in English.
4. **The pseudo-language** and the overflow test, then fix what they find.
5. **Draft the French**, interface first, using the glossary above.
6. **Native review** of the interface; then facts and lore in French, with the new French
   lore cards.
7. **The language switch,** `?lang=fr`, `<html lang>`, and a French tagline or title per
   decision 1.
8. **Ship.** Optionally add a short French player guide and French captions for the video.

Steps 1 to 4 are the chore. Once they're done, more languages are mostly translation.
