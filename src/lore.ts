// Bee lore: short cards from old beliefs, old science and old verse (sources in
// docs/research/Bee_Folklore.md). They appear low in the middle of the view while time passes: during an
// E rest, once the quiet overhead view has settled, and in the night between summers. Never
// with a button, and never twice until all have been seen.

/** belief: an old belief or myth · thought: what people once thought, gently corrected · verse: a public-domain line. */
export type LoreKind = 'belief' | 'thought' | 'verse';
/** Weather or meadow that suits a card; such cards are much likelier then. */
export type LoreMood = 'rain' | 'wind' | 'dry';

export interface LoreCard {
  id: string;
  kind: LoreKind;
  /** The card's text; verse keeps its line breaks. */
  lines: string[];
  source: string;
  mood?: LoreMood;
  /** A truer heading than the kind's own, for myths, saints and emblems ("An old story"). */
  label?: string;
}

export const LORE_LABELS: Record<LoreKind, string> = { belief: 'An old belief', thought: 'Once thought', verse: 'In verse' };

export const LORE_CARDS: LoreCard[] = [
  { id: 'telling-the-bees', kind: 'belief', lines: ['When someone died, the family went to tell the bees. Untold, people said, the bees would leave.'], source: 'English custom, 1800s' },
  { id: 'tears-of-ra', kind: 'belief', lines: ['The sun god Ra wept, and where his tears fell on the ground, they became bees.'], source: 'Ancient Egypt · Papyrus Salt 825' },
  { id: 'rain-at-home', kind: 'belief', mood: 'rain', lines: ['Bees stay close to home when rain is coming.'], source: 'Aristotle, Aratus and Pliny all say so' },
  { id: 'world-tree', kind: 'belief', lines: ['Dew falls from the great ash tree that holds up the world, and from it the bees feed.'], source: 'Norse myth · the Prose Edda' },
  { id: 'king-bee', kind: 'thought', lines: ['People long said a king ruled the hive. In 1609 Charles Butler wrote that the king was a queen.'], source: 'The Feminine Monarchie, 1609' },
  { id: 'ballast-stones', kind: 'thought', mood: 'wind', lines: ['Bees carry little stones to hold steady in a gale.'], source: 'Aristotle and Virgil · they don’t' },
  { id: 'bumblebee-flight', kind: 'thought', lines: ['A 1934 sum seemed to prove that a bumblebee couldn’t fly. It flew anyway.'], source: 'Antoine Magnan, 1934' },
  { id: 'prairie', kind: 'verse', mood: 'dry', lines: ['To make a prairie it takes', 'a clover and one bee,', 'One clover, and a bee,', 'And revery.'], source: 'Emily Dickinson' },
  { id: 'busy-bee', kind: 'verse', lines: ['How doth the little busy bee', 'Improve each shining hour,', 'And gather honey all the day', 'From every opening flower!'], source: 'Isaac Watts, 1715' },
  { id: 'swarm-in-may', kind: 'verse', lines: ['A swarm of bees in May', 'is worth a load of hay;', 'a swarm of bees in June', 'is worth a silver spoon.'], source: 'English country rhyme' },
  // More from docs/research/Bee_Folklore.md (2026-10-10). Entries still marked "to verify" there are left out.
  { id: 'not-for-money', kind: 'belief', lines: ['A swarm paid for in coins would never thrive, people said, so bees were traded for honey, comb or goods instead.'], source: 'British and American beekeepers, 1800s' },
  { id: 'no-quarrels', kind: 'belief', lines: ['“All that keep bees should love them, for these hate those that hate them.” Bees, it was said, would leave a quarrelsome home.'], source: 'William Ellis, The Modern Husbandman, 1750' },
  { id: 'tanging', kind: 'belief', lines: ['When a swarm flew off, the beekeeper beat a key on a pan, to settle the bees and to tell the neighbours whose swarm it was.'], source: 'English custom' },
  { id: 'christmas-hum', kind: 'belief', lines: ['Bees hum loudly in their hives on Christmas morning, it was said, in honour of the birth of Christ.'], source: 'English and German folk belief' },
  { id: 'bumblebee-visitor', kind: 'belief', lines: ['A bumblebee buzzing at the window means a visitor is coming.'], source: 'British and Irish folklore' },
  { id: 'gate-watchers', kind: 'belief', mood: 'rain', lines: ['Some bees keep watch at the hive’s door, Virgil wrote, looking out for showers and cloudy skies.'], source: 'Virgil, Georgics IV, 29 BCE' },
  { id: 'kalevala', kind: 'belief', label: 'An old story', lines: ['A mother sent a bee beyond the heavens to fetch honey, and the honey brought her son back to life.'], source: 'Finland · the Kalevala, rune 15' },
  { id: 'telipinu', kind: 'belief', label: 'An old story', mood: 'dry', lines: ['When the god Telipinu vanished, the land withered. The gods searched in vain, until a bee found him asleep and stung him awake.'], source: 'Hittite myth, Anatolia' },
  { id: 'delphic-bee', kind: 'belief', label: 'An old story', lines: ['Apollo’s gift of prophecy first came from three bee-maidens, and the priestess at Delphi was called “the Delphic bee”.'], source: 'Ancient Greece · Homeric Hymn to Hermes, Pindar' },
  { id: 'kama', kind: 'belief', label: 'An old story', lines: ['Kamadeva, the god of love, carries a bow of sugarcane, and its string is a line of bees.'], source: 'Hindu tradition' },
  { id: 'ah-muzen-cab', kind: 'belief', label: 'An old story', lines: ['The Maya kept stingless bees, and Ah-Muzen-Cab was their god of bees and honey, shown diving head first.'], source: 'Maya of the Yucatán' },
  { id: 'nambi', kind: 'belief', label: 'An old story', lines: ['Nambi turned into a bee and whispered to Kintu which cow was his, so he passed her father’s test and could marry her.'], source: 'Baganda story, Uganda' },
  { id: 'an-nahl', kind: 'belief', label: 'In scripture', lines: ['The sixteenth surah of the Quran is named The Bee. It tells how the bee was guided to make its homes in mountains, in trees and in what people build.'], source: 'Quran 16:68–69' },
  { id: 'samson', kind: 'belief', label: 'In scripture', lines: ['Samson found bees and honey in a lion he had killed, and made a riddle: “Out of the eater came forth meat, and out of the strong came forth sweetness.”'], source: 'Judges 14 · King James Bible' },
  { id: 'gobnait', kind: 'belief', label: 'A saint’s story', lines: ['Saint Gobnait kept bees in County Cork. When a raider stole the cattle, she loosed a swarm after him, and he brought them back.'], source: 'Ireland, 6th century' },
  { id: 'modomnoc', kind: 'belief', label: 'A saint’s story', lines: ['As Saint Modomnoc sailed home from Wales, his bees swarmed onto the boat three times. So he took them, and honeybees came to Ireland.'], source: 'Ireland, 6th century · Félire Óengusso' },
  { id: 'honey-lips', kind: 'belief', label: 'A saint’s story', lines: ['Bees settled on the lips of the baby Ambrose and left honey there, a sign of sweet words to come. He became the beekeepers’ saint.'], source: 'Milan, 4th century' },
  { id: 'napoleon', kind: 'belief', label: 'An old emblem', lines: ['Napoleon took the bee as his emblem, after golden bees found in the tomb of a Frankish king, and wore them on his coronation robes.'], source: 'France, 1804 · the tomb of Childeric I' },
  { id: 'monkey-bees', kind: 'belief', label: 'An old emblem', lines: ['In Chinese art, a monkey with bees is a wish in a picture: “feng hou”, may you be raised to marquis.'], source: 'Chinese picture pun · Qing dynasty' },
  { id: 'ox-born', kind: 'thought', lines: ['Ancient writers believed new bees could be born from the body of an ox. They were most likely seeing drone flies, which look like bees.'], source: 'Virgil, Georgics IV, 29 BCE' },
  { id: 'so-work', kind: 'verse', lines: ['For so work the honey-bees,', 'creatures that by a rule in nature teach', 'the act of order to a peopled kingdom.'], source: 'Shakespeare, Henry V, 1599' },
  { id: 'bee-loud-glade', kind: 'verse', lines: ['And live alone in the bee-loud glade.'], source: 'W. B. Yeats, The Lake Isle of Innisfree, 1890' },
  { id: 'weather-rhyme', kind: 'verse', mood: 'rain', lines: ['When bees to distance wing their flight,', 'days are warm and skies are bright;', 'but when their flight ends near their home,', 'stormy weather is sure to come.'], source: 'Weather lore · Richard Inwards, 1893' },
];

/** How a rest begins showing a card: the first rest of the day always, later ones now and then. */
export const LORE_REST_CHANCE = 1 / 3;
/** Seconds into a rest before the card fades in, and the fades themselves. */
export const LORE_REST_DELAY = 1, LORE_FADE_IN = .9, LORE_FADE_OUT = .6;
/** Seconds the overhead view is left clear before a card, and how long the card stays. */
export const LORE_SCENIC_DELAY = 10, LORE_SCENIC_STAY = 12;
/** Seconds into the night before its card, and how long before dawn it goes. */
export const LORE_NIGHT_DELAY = 3, LORE_NIGHT_CLEAR = 2.5;

export interface LoreContext {
  enabled: boolean;
  resting: boolean;
  /** Seconds into the current rest, and the rest's length. */
  restAge: number;
  restLength: number;
  /** 0–1: how far the camera has risen into the quiet overhead view. */
  scenic: number;
  moods: LoreMood[];
  /** Seconds into the night between summers, and the night's length; absent by day. */
  night?: { age: number; length: number };
}

export interface LoreView { card: LoreCard; label: string; opacity: number; }

export function createLore(random: () => number = Math.random, forceId?: string) {
  const seen = new Set<string>();
  let card: LoreCard | null = null, source: 'rest' | 'scenic' | 'night' | null = null, nightUsed = false;
  let age = 0, opacity = 0;
  let wasResting = false, restsToday = 0, scenicAge = 0, scenicUsed = false;

  function pick(moods: LoreMood[]): LoreCard {
    const forced = forceId && LORE_CARDS.find(c => c.id === forceId);
    if (forced) return forced;
    if (LORE_CARDS.every(c => seen.has(c.id))) seen.clear();
    const open = LORE_CARDS.filter(c => !seen.has(c.id));
    const weight = (c: LoreCard) => c.mood ? (moods.includes(c.mood) ? 8 : .5) : 1;
    let r = random() * open.reduce((s, c) => s + weight(c), 0);
    for (const c of open) { r -= weight(c); if (r <= 0) return c; }
    return open[open.length - 1];
  }
  function begin(from: 'rest' | 'scenic' | 'night', moods: LoreMood[]) {
    card = pick(moods); seen.add(card.id); source = from; age = 0;
  }

  return {
    step(dt: number, ctx: LoreContext): LoreView | null {
      const startedRest = ctx.resting && !wasResting;
      wasResting = ctx.resting;
      if (startedRest) restsToday++;
      if (ctx.scenic >= .98) scenicAge += dt;
      else if (ctx.scenic <= 0) { scenicAge = 0; scenicUsed = false; }

      if (!ctx.night) nightUsed = false;
      if (!card && ctx.enabled) {
        if (ctx.night) { if (!nightUsed && ctx.night.age >= LORE_NIGHT_DELAY) { nightUsed = true; begin('night', ctx.moods); } }
        else if (startedRest && (restsToday === 1 || random() < LORE_REST_CHANCE)) begin('rest', ctx.moods);
        else if (!scenicUsed && scenicAge >= LORE_SCENIC_DELAY) { scenicUsed = true; begin('scenic', ctx.moods); }
      }
      if (!card) return null;

      age += dt;
      const nightLeft = ctx.night ? ctx.night.length - LORE_NIGHT_CLEAR - ctx.night.age : 0;
      const ended = !ctx.enabled || (source === 'night' ? nightLeft <= 0 : source === 'rest' ? !ctx.resting : age >= LORE_SCENIC_STAY || ctx.scenic < .5);
      const target = ended ? 0 : source === 'night' ? Math.min(1, age / LORE_FADE_IN, nightLeft / LORE_FADE_OUT) : source === 'rest'
        ? Math.min(1, Math.max(0, (age - LORE_REST_DELAY) / LORE_FADE_IN), Math.max(0, (ctx.restLength - ctx.restAge) / LORE_FADE_OUT))
        : Math.min(1, age / LORE_FADE_IN, Math.max(0, (LORE_SCENIC_STAY - age) / LORE_FADE_OUT));
      // Whatever ends the card, it fades out rather than vanishing.
      opacity = target < opacity ? Math.max(target, opacity - dt / LORE_FADE_OUT) : target;
      if (ended && opacity <= 0) { card = null; source = null; return null; }
      return { card, label: card.label ?? LORE_LABELS[card.kind], opacity };
    },
    /** A new day: the first rest shows a card again. Seen cards stay seen. */
    newDay() { nightUsed = false; restsToday = 0; wasResting = false; scenicAge = 0; scenicUsed = false; card = null; source = null; opacity = 0; },
    diagnostics() { return { card: card?.id ?? null, source, opacity, age, seen: [...seen], restsToday, scenicAge, scenicUsed }; },
  };
}
