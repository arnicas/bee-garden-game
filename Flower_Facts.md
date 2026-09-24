# Flower facts

Reference notes on the meadow's three flowers, for the **Small wonders** bee facts page and the on-screen flower details. Each entry has what happens in nature, what the game does now, and suggested short copy. Check the sources before quoting numbers in the game.

## At a glance

| Flower | Nectar in nature | Pollen in nature | Game nectar per visit | Game pollen per visit |
| --- | --- | --- | --- | --- |
| Corn poppy | Almost none | The highest of the three | 0 | 21 |
| Oxeye daisy | Modest | Strong, but spread over a long flowering | 19 | 11 |
| Cornflower | High | Moderate | 22.5 | 14 |

Game values are the flower's supply in `src/garden.ts` multiplied by the 0.5 harvest yield.

## Corn poppy (*Papaver rhoeas*)

**In nature**
- Almost no nectar: about 0.6 µg of sugar per flower a day in the Edinburgh meadow study [1].
- A pollen flower. It gave the most pollen per flower of the sown meadow species, more than twice the next one: about 13 µl per flower, or 6 µl a day [1].
- Bees collect it eagerly. The pollen loads are dark, grey to black, so a bee carrying poppy pollen is easy to spot [2].
- Bees can't see red, so to them the petals look dark. The petals also reflect ultraviolet, though, so poppies still stand out to a bee.
- Each flower lasts only a day or two, and most of its pollen is taken in the morning.

**In the game**
- No nectar and the most pollen, about twice the others. This already matches nature.

**Suggested copy**
- *In nature:* "Poppies offer no nectar at all. Bees visit for their pollen, and they give more of it than almost any meadow flower."
- *In this game:* "Poppies have no nectar to sip, but they're the richest pollen stop in the meadow."

## Oxeye daisy (*Leucanthemum vulgare*)

**In nature**
- Each "flower" is a flower head made of many tiny florets: the white rays around the edge and the yellow disc in the middle.
- Its nectar is modest, but it's easy to reach, so many short-tongued insects visit.
- A strong pollen source overall: about 16 µl per flower head. That was the largest pollen contribution among the perennials in the Edinburgh meadows [1].
- Each head flowers for about two weeks (14.8 days in the study), so its pollen is spread thin, about 1.1 µl a day, against the poppy's 6 [1].

**In the game**
- A little too much nectar (19) and a little too little pollen (11) compared with nature.

**Suggested copy**
- *In nature:* "A daisy is a crowd of tiny flowers. Its pollen comes a little at a time over two weeks."
- *In this game:* "Daisies are a steady middle stop, with some nectar and some pollen."

## Cornflower (*Centaurea cyanus*)

**In nature**
- A strong nectar source: about 900 µg of sugar per flower a day in the Edinburgh study, among the best of the annual flowers [1].
- Blue is a colour bees see well.
- It also has nectaries on the bracts below the flower head, which ants visit.
- Moderate pollen. I didn't find an exact figure.

**In the game**
- Nectar (22.5) is only slightly more than the daisy's (19), so its nectar advantage barely shows. Its pollen (14) is higher than the daisy's, which is probably backwards.

**Suggested copy**
- *In nature:* "Cornflowers are rich in nectar, and bees see their blue well."
- *In this game:* "Head for cornflowers when you need nectar."

## Suggested rebalance

Proposed per-visit values, so each flower has a clear role (tracked in `TODO.md`):

| Flower | Nectar | Pollen | Role |
| --- | --- | --- | --- |
| Poppy | 0 | 21 (same) | Pollen |
| Daisy | 13 (was 19) | 14 (was 11) | Balanced middle stop |
| Cornflower | 28 (was 22.5) | 10 (was 14) | Nectar |

Total nectar in the meadow drops a little. Check the nectar goal, the fuel needed to fly home, and the length of a day after changing these.

## Sources

1. Hicks, D. M. et al. (2016). [Food for Pollinators: Quantifying the Nectar and Pollen Resources of Urban Flower Meadows](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0158117). *PLOS One* 11(6): e0158117.
2. [Bees Love Poppies And Their Pollen Laden Anthers](https://www.buzzaboutbees.net/Bees-poppies.html), Buzz About Bees.
3. [Papaver rhoeas](https://en.wikipedia.org/wiki/Papaver_rhoeas), [Leucanthemum vulgare](https://en.wikipedia.org/wiki/Leucanthemum_vulgare) and [Centaurea cyanus](https://en.wikipedia.org/wiki/Centaurea_cyanus), Wikipedia.

Not yet sourced: the poppy's ultraviolet petals, poppy pollen being taken mostly in the morning, and the cornflower's nectaries below the flower head. These are commonly reported but need a citation before they go in the game.
