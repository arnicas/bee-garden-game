import './bee-facts.css';

interface FactSource { label: string; url: string }
interface BeeFact {
  id: string;
  /** Which part of the journal: the bee herself, or the meadow around her. */
  section: 'bee' | 'meadow';
  label: string;
  title: string;
  scope: string;
  nature: string;
  game: string;
  /** Meadow friends: where and when to look for them in the game. */
  spotting?: string;
  sources: readonly FactSource[];
}

/** Interpretive notes, not simulation rules. Research trail: artifacts/bee-facts-sources.md. */
export const beeFacts: readonly BeeFact[] = [
  {
    id: 'vision', section: 'bee', label: 'A different light', title: 'Flowers in another light.', scope: 'Honeybees',
    nature: 'Honeybees have ultraviolet, blue and green colour receptors. A flower can show them patterns we cannot see. Ultraviolet is part of a richer visual world, rather than a separate night-vision mode.',
    game: 'Q makes this difference visible to human eyes. The glowing tips that suggest matching flowers are a game guide, not a literal view through a bee’s eyes.',
    sources: [{ label: 'Honeybee colour vision · Hempel de Ibarra et al.', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4035557/' }],
  },
  {
    id: 'food', section: 'bee', label: 'Two kinds of food', title: 'Sweetness and sunshine.', scope: 'Honeybees & other bees',
    nature: 'Nectar supplies carbohydrates; pollen supplies protein, fats and other nutrients. Honeybee foragers carry nectar in their crop, and can pass some into the gut to fuel their own flight. Not every collected drop is reserved for the colony.',
    game: 'Hold F or left mouse to sip nectar on a flower. Nectar feeds your wings and fills the hive’s jar. Pollen fills a separate pouch. The shared harvest goal makes one little journey from several kinds of foraging.',
    sources: [
      { label: 'Food for bees · University of Minnesota Extension', url: 'https://extension.umn.edu/agriculture/specialty-crops/pollination/habitat' },
      { label: 'The complex life of the honey bee · Purdue Extension', url: 'https://ag.purdue.edu/department/extension/ppp/resources/ppp-publications/mobile/ppp-116-pol-91.html' },
    ],
  },
  {
    id: 'pollen', section: 'bee', label: 'A dusting of gold', title: 'Tiny travellers, carried home.', scope: 'Worker honeybees',
    nature: 'A honeybee grooms pollen from her body and packs it into baskets on her hind legs. A little nectar helps the grains hold together. Loose grains on the body can also travel between flowers.',
    game: 'Use W A S D to walk through anthers and collect pollen. Your newest colour gathers on your knuckles; older colours remain as flecks. These visible front-leg grains are a game reminder, not real pollen baskets.',
    sources: [
      { label: 'Honeybee basic biology · University of Arizona Extension', url: 'https://extension.arizona.edu/publication/honeybee-series-honeybee-basic-biology' },
      { label: 'Native pollinators · Agriculture and Agri-Food Canada', url: 'https://www.fs.usda.gov/wildflowers/pollinators/documents/AgCanadaNativePollinators.pdf' },
    ],
  },
  {
    id: 'pollination', section: 'bee', label: 'One flower to another', title: 'A small visit. A new beginning.', scope: 'Pollination & honeybee foraging',
    nature: 'Pollination moves pollen from an anther to a receptive stigma; successful fertilization comes later. Honeybees often keep visiting one flower species, helping its pollen reach a compatible flower. This flower constancy is a tendency, not an unbreakable rule.',
    game: 'Carry pollen to another flower of the same type to help it. Each flower earns one mark in your journal. Real seed formation is more involved than a single landing.',
    sources: [
      { label: 'Native pollinators · Agriculture and Agri-Food Canada', url: 'https://www.fs.usda.gov/wildflowers/pollinators/documents/AgCanadaNativePollinators.pdf' },
      { label: 'Flower constancy · Grüter & Ratnieks', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3306322/' },
    ],
  },
  {
    id: 'water', section: 'bee', label: 'A sip of water', title: 'Water for a hot day.', scope: 'Honeybees',
    nature: 'Bees need water as well as food. Honeybee water foragers carry it home in their crop; on hot days the hive spreads it thinly and fans it, cooling the nest as it evaporates, and it thins stored honey for feeding the young. They sip from shallow, safe places: dew, raindrops on leaves, damp moss, puddle edges, and the beads plants push out along their leaves on humid mornings.',
    game: 'Morning dew and raindrops sit on the petals, and small pools gather in low clearings in the grass when it rains. Hold F to sip where there is no nectar in reach, or beside a pool on the ground. Water cools you in the heat but is not food. The pools dry away in the hot spell, so sip while you can.',
    sources: [
      { label: 'Water collection cools the hive · AskNature', url: 'https://asknature.org/strategy/water-collection-cools-hive/' },
      { label: 'Water collection by honey bees · Honey Bee Suite', url: 'https://www.honeybeesuite.com/water-collection/' },
    ],
  },
  {
    id: 'weather', section: 'bee', label: 'Shelter from Rain', title: 'Let the shower pass.', scope: 'Bumblebees; game weather is simplified',
    nature: 'Bumblebees can cope with cool, wet weather. Their hairy bodies and the heat from their flight muscles help; staying still reduces their energy needs. A resting bee is not necessarily in trouble, and different bees tolerate weather differently.',
    game: 'Press E to land or shelter; press E again once settled to rest. A brief rest spends stored nectar to restore energy and speeds daylight; stillness alone is not food. Rain builds cold and drains energy: leaf undersides and dense grass shelter you, but flowers and leaf tops remain exposed. Blue edges warn of cold or low energy. The rapid cold penalty is a game choice, not a measured bee temperature.',
    sources: [{ label: 'Bumblebees in bad weather · Bumblebee Conservation Trust', url: 'https://www.bumblebeeconservation.org/learn-about-bumblebees/faqs/bad-weather/' }],
  },
  {
    id: 'wetwings', section: 'bee', label: 'Wet wings', title: 'A raindrop is heavy.', scope: 'Insects in rain; game rules are simplified',
    nature: 'To a bee, a big raindrop weighs about as much as she does. Mosquitoes survive being hit because they are so light that a drop carries them along instead of striking hard; a bee, about fifty times heavier, takes a real knock. A soaked bee usually cannot fly until she has groomed and dried, which is why bees wait out showers in shelter.',
    game: 'Flying in the open rain, drops strike now and then: a splash, a knock and wetter wings. Wet wings fly slowly and chill faster, and a run of hits knocks you down into the grass. Groom and dry there before flying again; rest with E to dry faster. The grass keeps off most drops, but a broad leaf is driest.',
    sources: [
      { label: 'Mosquitoes survive raindrop collisions · PNAS', url: 'https://www.pnas.org/doi/10.1073/pnas.1205446109' },
      { label: 'Helping bees in rain and storms · Backyard Beekeeping', url: 'https://backyardbeekeeping.iamcountryside.com/health-pests/bee-weather-series-how-to-help-bees-during-spring-rain-and-storms/' },
    ],
  },
  {
    id: 'heat', section: 'bee', label: 'Sun & shade', title: 'A moment in the shade.', scope: 'Honeybee research; game heat is simplified',
    nature: 'Flight muscles produce heat, and sunshine adds warmth. Honeybees can adjust their wingbeats and use evaporative cooling to avoid overheating. Hot, dry conditions also increase the danger of water loss. Their heat balance is more subtle than simply running out of energy in the sun.',
    game: 'Orange edges warn that you’re overheating. E near a broad leaf tucks you underneath; dense grass near the soil also cools you. Flowers and leaf tops stay exposed. Shade stops the extra drain; nectar restores energy. Press E once settled to rest, using stored nectar while daylight advances. Watch the sun on the day strip: its orange glow and heat waves mark the hot spell. Our fast heat penalty is a game simplification.',
    sources: [
      { label: 'Keeping cool in flight · Glass et al.', url: 'https://pubmed.ncbi.nlm.nih.gov/38227669/' },
      { label: 'Foraging in sun and shade · Kovac & Stabentheiner', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3298660/' },
    ],
  },
  {
    id: 'home', section: 'bee', label: 'The way home', title: 'A harvest worth sharing.', scope: 'Honeybees',
    nature: 'Back at the hive, successful honeybee foragers can use a waggle dance to share the direction and distance of a profitable flower patch with nestmates. This is a honeybee behaviour, not a dance performed by every kind of bee.',
    game: 'When you have enough nectar and pollen to make the hive happy, the R (Return Home) control appears as “Way home” in the UI. Press R for guidance, then follow the hive marker to the meadow edge. Your heavier harvest changes the flight home. One outing stands for a whole day; real trips do not follow this clock. In our ending at the hive, two returning bees perform a simplified, simulated waggle dance, tracing little figure-eights. Their dance is decorative and does not communicate flower locations.',
    sources: [{ label: 'Decoding waggle dances · University of Sussex', url: 'https://www.sussex.ac.uk/lasi/sussexplan/dances' }],
  },
  {
    id: 'flowers', section: 'meadow', label: 'Three meadow flowers', title: 'Each flower has its gift.', scope: 'Corn poppy, oxeye daisy & cornflower',
    nature: 'Corn poppies make almost no nectar, but more pollen than almost any other meadow flower; bees carry it home in dark grey loads. What looks like one oxeye daisy is really hundreds of tiny flowers: each white “petal” is one, and the yellow centre is packed with more, each holding a little nectar. A cornflower is a head of small flowers too: the big blue outer ones are only for show, and the nectar lies deep in the narrow tubes of the small purple ones at the centre. These open from the outside in, a ring at a time, over several days.',
    game: 'Each flower gives what its real counterpart does best. Poppies hold the most pollen and no nectar; daisies offer some of each, easy to reach. Cornflowers hold the most nectar, but you must walk onto the centre and sip floret by floret around the ring of open ones, their gold beads showing which still hold some. Amounts are simplified.',
    sources: [
      { label: 'Food for pollinators: urban meadow nectar and pollen · PLOS One', url: 'https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0158117' },
      { label: 'Bees love poppies · Buzz About Bees', url: 'https://www.buzzaboutbees.net/Bees-poppies.html' },
      { label: 'Centaurea cyanus (cornflower) · Wikipedia', url: 'https://en.wikipedia.org/wiki/Centaurea_cyanus' },
    ],
  },
  {
    id: 'summers', section: 'meadow', label: 'Summer to summer', title: 'Next summer’s meadow.', scope: 'Annual & perennial meadow flowers',
    nature: 'Corn poppies and cornflowers live a single year. Their flowers must be pollinated by pollen from another plant to set seed, and next summer’s flowers grow from that seed. Poppy seed shakes out of the swaying seed head and mostly lands within a metre or so; some waits in the soil for years. Oxeye daisies are perennials that live on from their roots.',
    game: 'One day stands for a whole summer. Flowers you pollinate come back in greater numbers next summer, many close by; skipped ones leave gaps. Daisies keep their places. The seed in the soil runs out faster than in nature, so your visits matter more.',
    sources: [
      { label: 'Papaver rhoeas (corn poppy) · Wikipedia', url: 'https://en.wikipedia.org/wiki/Papaver_rhoeas' },
      { label: 'Leucanthemum vulgare (oxeye daisy) · Wikipedia', url: 'https://en.wikipedia.org/wiki/Leucanthemum_vulgare' },
    ],
  },
  {
    id: 'ladybirds', section: 'meadow', label: 'Aphids & ladybirds', title: 'Small hunters on the stems.', scope: 'Ladybirds (lady beetles) & aphids',
    nature: 'Aphids suck sap from plant stems, often gathering in clusters on cornflowers and poppies. Ladybirds, adults and larvae alike, eat them in large numbers. When aphids run short, adult ladybirds also take pollen and nectar from shallow, open flowers, or move on to find more prey.',
    game: 'Aphid clusters live on poppy and cornflower stems; ladybirds walk to them and eat them down, and use daisies as backup food. A summer with more of those flowers brings more aphids, and more ladybirds follow.',
    spotting: 'Look low on the stems of poppies and cornflowers, below the flower heads: green aphid clusters on cornflowers, dark ones on poppies, and the ladybirds nearby. Press Ctrl to drop down and fly slowly past the stems. When aphids are scarce, check the daisy faces too. Fly within a bee’s length or so of one to count it.',
    sources: [{ label: 'Lady beetles · Colorado State University Extension', url: 'https://extension.colostate.edu/resource/lady-beetles/' }],
  },
  {
    id: 'butterflies', section: 'meadow', label: 'Butterflies', title: 'Warmed by the sun.', scope: 'Meadow butterflies',
    nature: 'Butterflies drink nectar through a long, coiled proboscis, which reaches deep flowers easily. They need warm flight muscles, so in the morning or after rain they bask with their wings open to the sun. When rain comes, they shelter under leaves or low among the plants, wings closed, and wait.',
    game: 'Four kinds visit the daisies and cornflowers: common blues, meadow browns, small tortoiseshells and small whites. They sip real nectar, so a flower may be emptier after one visits. In rain they hang beneath the broad leaves, then bask before feeding again.',
    spotting: 'In fine weather, look on daisies and cornflowers, never poppies: a butterfly sits with its wings closed and now and then opens them flat to the sun. Approach gently; it lifts off if you come very close or land on its flower. In a shower, tuck under a broad leaf and look along its underside. Just after rain, they bask with open wings on the flowers.',
    sources: [
      { label: 'What do butterflies do when it rains? · Scientific American', url: 'https://www.scientificamerican.com/article/what-do-butterflies-do-wh/' },
      { label: 'Butterflies: warming up · Lewis Ginter Botanical Garden', url: 'https://www.lewisginter.org/butterflieswarming-up/' },
    ],
  },
  {
    id: 'snails', section: 'meadow', label: 'Banded snails', title: 'Out when it’s damp.', scope: 'Banded snails (Cepaea)',
    nature: 'Banded snails come in yellow, pink or brown, with up to five dark bands. They are most active at night and in damp weather, and prefer dead plant matter. In heat and drought they seal their shell opening with a dried-mucus lid, often after climbing a stem off the hot ground, and wait for rain. As decomposers, they help return nutrients to the soil.',
    game: 'Snails crawl out in rain, dew and at dusk, leaving silvery trails; tuck into their shells when it is dry; and climb stems to seal themselves on in the hot spell. Many keep to the damp rims of the rain pools. A thin, dry meadow keeps more of them sealed in.',
    spotting: 'Best in the shower, in the early-morning dew and at dusk, when they are out and a silvery trail leads to them. Look on and under the broad leaves, low on flower stems, and at the rims of the rain pools in the little grass clearings. In the hot spell, look higher up the stems for a shell sealed with a white lid. Come within a few centimetres to count one; they pull in their tentacles when you are close.',
    sources: [
      { label: 'Cepaea nemoralis · Animal Diversity Web', url: 'https://animaldiversity.org/accounts/Cepaea_nemoralis/' },
      { label: 'Land snails ecology · Carnegie Museum of Natural History', url: 'https://carnegiemnh.org/mollusks/land-snails-ecology/' },
    ],
  },
];

// Small original pen-and-wash vignettes. No paint-server IDs or borrowed images.
const bee = '<g stroke="#576344" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M-3-2C-31-24-9-34 1-8M4-3C32-24 12-34 2-8" fill="#f6f3df"/><ellipse cy="5" rx="10" ry="15" fill="#d6ad55"/><path d="M-8 0h16m-17 7h18m-14 7h11" stroke-width="4"/><ellipse cy="-11" rx="7" ry="6" fill="#576344"/><path d="m-4-15-5-7m13 7 5-7m-17 21-10 7m29-7 10 7m-28-1-8 11m23-11 8 11" fill="none"/></g>';
const bloom = '<g stroke="#73805a" stroke-width="1.1"><path d="M0 6q-5 22 0 43m0-17q-19-16-19-3 5 10 19 9" fill="none"/><g fill="#efe5b7"><ellipse cy="-13" rx="7" ry="15"/><ellipse cy="-13" rx="7" ry="15" transform="rotate(60)"/><ellipse cy="-13" rx="7" ry="15" transform="rotate(120)"/><ellipse cy="-13" rx="7" ry="15" transform="rotate(180)"/><ellipse cy="-13" rx="7" ry="15" transform="rotate(240)"/><ellipse cy="-13" rx="7" ry="15" transform="rotate(300)"/></g><circle r="10" fill="#c69c45"/></g>';
const drawings: Record<string, string> = {
  flowers: '<g stroke="#7d8a5a" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M36 118q3-28-1-50"/><path d="M86 118q-2-34 0-58"/><path d="M134 118q-3-26 1-46"/><path d="M86 96q-10-6-14 2M134 100q9-5 13 2"/></g><g transform="translate(36 60)"><g transform="rotate(0.0)"><ellipse cy="-8" rx="9" ry="10" fill="#d9694f" stroke="#b44d3a" stroke-width=".8"/></g><g transform="rotate(90.0)"><ellipse cy="-8" rx="9" ry="10" fill="#d9694f" stroke="#b44d3a" stroke-width=".8"/></g><g transform="rotate(180.0)"><ellipse cy="-8" rx="9" ry="10" fill="#d9694f" stroke="#b44d3a" stroke-width=".8"/></g><g transform="rotate(270.0)"><ellipse cy="-8" rx="9" ry="10" fill="#d9694f" stroke="#b44d3a" stroke-width=".8"/></g><circle r="4.2" fill="#3e3a36"/></g><g transform="translate(86 50)"><g transform="rotate(0.0)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(25.7)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(51.4)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(77.1)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(102.9)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(128.6)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(154.3)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(180.0)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(205.7)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(231.4)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(257.1)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(282.9)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(308.6)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><g transform="rotate(334.3)"><ellipse cy="-10" rx="2.8" ry="8" fill="#fbf7ec" stroke="#b9b39a" stroke-width=".6"/></g><circle r="5.2" fill="#e5b84a" stroke="#b98c32" stroke-width=".7"/></g><g transform="translate(134 62)"><g transform="rotate(0.0)"><path d="M0-4L-3.6-15L0-12.5L3.6-15Z" fill="#5b7fc4" stroke="#3f5f9c" stroke-width=".6" stroke-linejoin="round"/></g><g transform="rotate(40.0)"><path d="M0-4L-3.6-15L0-12.5L3.6-15Z" fill="#5b7fc4" stroke="#3f5f9c" stroke-width=".6" stroke-linejoin="round"/></g><g transform="rotate(80.0)"><path d="M0-4L-3.6-15L0-12.5L3.6-15Z" fill="#5b7fc4" stroke="#3f5f9c" stroke-width=".6" stroke-linejoin="round"/></g><g transform="rotate(120.0)"><path d="M0-4L-3.6-15L0-12.5L3.6-15Z" fill="#5b7fc4" stroke="#3f5f9c" stroke-width=".6" stroke-linejoin="round"/></g><g transform="rotate(160.0)"><path d="M0-4L-3.6-15L0-12.5L3.6-15Z" fill="#5b7fc4" stroke="#3f5f9c" stroke-width=".6" stroke-linejoin="round"/></g><g transform="rotate(200.0)"><path d="M0-4L-3.6-15L0-12.5L3.6-15Z" fill="#5b7fc4" stroke="#3f5f9c" stroke-width=".6" stroke-linejoin="round"/></g><g transform="rotate(240.0)"><path d="M0-4L-3.6-15L0-12.5L3.6-15Z" fill="#5b7fc4" stroke="#3f5f9c" stroke-width=".6" stroke-linejoin="round"/></g><g transform="rotate(280.0)"><path d="M0-4L-3.6-15L0-12.5L3.6-15Z" fill="#5b7fc4" stroke="#3f5f9c" stroke-width=".6" stroke-linejoin="round"/></g><g transform="rotate(320.0)"><path d="M0-4L-3.6-15L0-12.5L3.6-15Z" fill="#5b7fc4" stroke="#3f5f9c" stroke-width=".6" stroke-linejoin="round"/></g><circle r="3.4" fill="#4a5f8f"/></g>',
  vision: `<g transform="translate(93 59)">${bloom}<circle r="19" fill="none" stroke="#87919b" stroke-dasharray="2 4"/><circle r="5" fill="#778093"/></g><path d="M29 41q17-20 34 0-17 20-34 0Z" fill="none" stroke="#73805a"/><circle cx="46" cy="41" r="5" fill="#8a91a1"/>`,
  food: '<g stroke="#78805b" stroke-width="1.3" fill="none"><path d="M55 25C50 45 34 53 34 69a22 22 0 0 0 44 0c0-16-16-24-23-44Z" fill="#e8c16d"/><path d="M43 69q-1 13 10 15"/><path d="M100 42q-12 17-7 40 13 19 36 0 5-23-7-40Z" fill="#ead698"/><path d="M99 42h23m-22-5h20m-21 11h24"/></g><g fill="#caa349"><circle cx="107" cy="62" r="3"/><circle cx="120" cy="66" r="3"/><circle cx="113" cy="78" r="3"/></g>',
  pollen: `<g transform="translate(75 57) rotate(19)">${bee}</g><g fill="#ce9c45"><circle cx="53" cy="81" r="6"/><circle cx="90" cy="93" r="6"/><circle cx="115" cy="40" r="2"/><circle cx="126" cy="52" r="3"/><circle cx="108" cy="57" r="2"/></g><path d="m104 84 20-5" stroke="#869071" stroke-dasharray="2 3"/>`,
  pollination: `<g transform="translate(39 80) scale(.67)">${bloom}</g><g transform="translate(132 73) scale(.78)">${bloom}</g><g transform="translate(88 34) rotate(30) scale(.52)">${bee}</g><path d="M48 54q35-45 73-8" fill="none" stroke="#a48d5c" stroke-dasharray="2 4"/><g fill="#c39840"><circle cx="66" cy="51" r="2"/><circle cx="108" cy="46" r="2"/></g>`,
  weather: `<path d="M25 49Q73-14 146 45 90 82 25 49Z" fill="#abb884" stroke="#68774d" stroke-width="1.3"/><path d="M17 60Q73 22 145 45m-75-9 0 23m25-26 8 21m-53-9 4 15" fill="none" stroke="#68774d" stroke-width="1"/><g transform="translate(85 86) rotate(65) scale(.57)">${bee}</g><path d="m28 16-4 9m44-17-4 9m44-7-4 9m43 3-4 9" stroke="#829aa2" stroke-width="1.6" stroke-linecap="round"/>`,
  heat: `<circle cx="130" cy="27" r="22" fill="#eac082" opacity=".3"/><circle cx="130" cy="27" r="13" fill="#e2ae63" stroke="#bc814b"/><path d="M130 6V2m0 50v-4m-21-21h-4m50 0h-4m-36-15-3-3m33 33 3 3m-3-33 3-3m-33 33-3 3" stroke="#bc814b" stroke-linecap="round"/><path d="M21 64Q62 11 116 55 82 84 21 64Z" fill="#a6b77e" stroke="#65784d" stroke-width="1.3"/><path d="M15 78Q56 41 115 55m-61-2 3 16m18-20 9 16" fill="none" stroke="#65784d"/><ellipse cx="72" cy="93" rx="37" ry="14" fill="#79917a" opacity=".18"/><g transform="translate(68 88) rotate(65) scale(.55)">${bee}</g><path d="M137 67q-5 5 0 10t0 10m15-23q-5 5 0 10t0 10" fill="none" stroke="#c59260" stroke-linecap="round"/>`,
  water: `<path d="M22 96Q70 60 150 88 92 116 22 96Z" fill="#c7d7cf" stroke="#7d8e84" stroke-width="1.1"/><path d="M48 94q20-6 40 0m12 4q14-4 28 0" stroke="#f3f6ee" stroke-width="1.6" stroke-linecap="round"/><path d="M118 40c-8 12-12 18-12 24a12 12 0 0 0 24 0c0-6-4-12-12-24Z" fill="#b9d2da" stroke="#6f8b95" stroke-width="1.1"/><path d="M113 62q1 6 6 7" stroke="#f4f9f7" stroke-width="1.4" fill="none"/><g transform="translate(62 68) rotate(-20) scale(.55)">${bee}</g>`,
  wetwings: `<g transform="translate(92 76) rotate(18) scale(.62)">${bee}</g><path d="M78 16c-6 9-9 14-9 18a9 9 0 0 0 18 0c0-4-3-9-9-18Z" fill="#b9d2da" stroke="#6f8b95" stroke-width="1.1"/><path d="M78 46v6m-12-2 4 5m20-5-4 5" stroke="#7f98a1" stroke-width="1.3" stroke-linecap="round"/><path d="m32 20-4 10m112-12-4 10m-8 30-4 10M40 64l-4 10" stroke="#8fa6ad" stroke-width="1.4" stroke-linecap="round"/>`,
  summers: `<g stroke="#7d8a5a" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M50 112q2-40-2-62"/><path d="M104 112q-1-10 0-18m18 18q1-8-1-14m-38 14q-1-7 1-12"/></g><path d="M40 50q10-14 18 0-2 12-9 13-7-1-9-13Z" fill="#b9a26b" stroke="#7f6c43"/><path d="M42 46h14" stroke="#7f6c43"/><g fill="#5a4d3e"><circle cx="66" cy="70" r="1.6"/><circle cx="74" cy="80" r="1.6"/><circle cx="62" cy="86" r="1.6"/><circle cx="80" cy="92" r="1.6"/></g><g fill="#8fae6a" stroke="#6c8a4c" stroke-width=".8"><ellipse cx="100" cy="92" rx="5" ry="2.4" transform="rotate(-30 100 92)"/><ellipse cx="108" cy="92" rx="5" ry="2.4" transform="rotate(30 108 92)"/><ellipse cx="119" cy="97" rx="4" ry="2" transform="rotate(-25 119 97)"/><ellipse cx="85" cy="99" rx="4" ry="2" transform="rotate(25 85 99)"/></g><path d="M16 112h140" stroke="#9c8f6a" stroke-width="1.2"/>`,
  ladybirds: `<path d="M60 118q6-50-2-104" stroke="#7d8a5a" stroke-width="3" fill="none" stroke-linecap="round"/><g fill="#9bbb6a"><circle cx="60" cy="40" r="3"/><circle cx="63" cy="46" r="3"/><circle cx="58" cy="50" r="3"/><circle cx="62" cy="34" r="2.6"/></g><g transform="translate(108 72) rotate(-15)"><ellipse rx="19" ry="16" fill="#c8453a" stroke="#7a2d25" stroke-width="1.2"/><path d="M0-16V16" stroke="#3b2a24" stroke-width="1.2"/><circle cx="-8" cy="-4" r="3.4" fill="#2f2622"/><circle cx="8" cy="-4" r="3.4" fill="#2f2622"/><circle cx="-7" cy="8" r="2.8" fill="#2f2622"/><circle cx="7" cy="8" r="2.8" fill="#2f2622"/><path d="M-11-14q11-10 22 0" fill="#2f2622"/><path d="M-19 2h-7m45 0h7M-16 12l-6 5m38-5 6 5M-15-8l-6-4m36 4 6-4" stroke="#3b2a24" stroke-width="1.1" stroke-linecap="round"/></g>`,
  butterflies: `<path d="M18 36Q80-8 150 34 88 62 18 36Z" fill="#abb884" stroke="#68774d" stroke-width="1.3"/><path d="M26 38Q84 16 146 34" fill="none" stroke="#68774d"/><g transform="translate(86 46) scale(1.6)"><path d="M0 0v34" stroke="#3f3a32" stroke-width="2.4" stroke-linecap="round"/><path d="M0 4C-10 8-16 26-4 30Z" fill="#e8e3cf" stroke="#8a8468" stroke-width="1"/><path d="M0 4C10 10 14 26 3 32Z" fill="#dcd5bb" stroke="#8a8468" stroke-width="1"/><circle cx="-7" cy="18" r="1.8" fill="#5a5448"/></g><path d="m34 76-3 8m96-6-3 8m-86 12-3 8m70-4-3 8" stroke="#829aa2" stroke-width="1.5" stroke-linecap="round"/>`,
  snails: `<ellipse cx="94" cy="98" rx="52" ry="10" fill="#c7d7cf" stroke="#7d8e84"/><path d="M60 96q30-6 54-2" stroke="#f2f6ef" stroke-width="1.4" fill="none"/><g transform="translate(70 76)"><path d="M-30 14q16-6 44-2 8 1 10 6-26 4-54-4Z" fill="#b39a80" stroke="#7a6655" stroke-width="1.1"/><path d="M14 12l8-16m-2 16 10-14" stroke="#7a6655" stroke-width="1.4" stroke-linecap="round"/><circle cx="22" cy="-4" r="1.8" fill="#4d4038"/><circle cx="30" cy="-2" r="1.8" fill="#4d4038"/><circle r="16" fill="#e9d98c" stroke="#8d7a4a" stroke-width="1.2"/><path d="M0 0a5 5 0 0 1 9 2 9 9 0 0 1-15 5 13 13 0 0 1 9-19" fill="none" stroke="#6b5a3a" stroke-width="2.4"/></g>`,
  home: `<path d="M86 100h58v-34H86Zm-7-34 36-28 36 28M90 73h50m-50 9h50m-50 9h50" fill="#e6cc8d" stroke="#7c8057" stroke-width="1.3"/><path d="M108 100v-10a7 7 0 0 1 14 0v10" fill="#687354"/><g transform="translate(47 57) rotate(34) scale(.64)">${bee}</g><path d="M31 94C6 69 42 10 81 38" fill="none" stroke="#a89666" stroke-dasharray="2 4"/>`,
};
const SECTION_NAMES = { bee: 'Bee facts', meadow: 'The meadow' } as const;
const htmlEscapes: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (value: string) => value.replace(/[&<>"']/g, character => htmlEscapes[character]);
function gameMarkup(value: string): string {
  return escapeHTML(value).replace(/\b(W A S D|left mouse|Ctrl|Q|E|F|R)\b/g, control =>
    `<kbd class="fact-key">${control}</kbd>`);
}
function sourceLink(source: FactSource): string {
  const url = new URL(source.url);
  if (url.protocol !== 'https:') throw new Error('Bee fact sources must use HTTPS.');
  return `<a href="${escapeHTML(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.label)}<span aria-hidden="true"> ↗</span><span class="facts-sr-only"> (opens in a new tab)</span></a>`;
}

export function beeFactsMarkup(): string {
  return `<section id="bee-facts" class="journal-page bee-facts-page" role="dialog" aria-modal="true" aria-labelledby="bee-facts-title" hidden>
    <header class="facts-heading"><div><span class="eyebrow">NOTES FROM A SMALL WORLD</span><h2 id="bee-facts-title" tabindex="-1">Bees &amp; the Meadow</h2></div><button class="facts-back" data-action="facts-close">← <span data-facts-return>Field guide</span><kbd>Esc</kbd></button></header>
    <p class="facts-intro">A bee works hard, even without considering predators and pesticides. Our game is inspired by real bee biology, and by the meadow she shares with flowers, snails, ladybirds and butterflies.</p>
    <div class="facts-spread">
      <div class="facts-index" role="tablist" aria-label="Bee and meadow topics" aria-orientation="vertical">${beeFacts.map((fact, index) => {
        const first = index === 0 || beeFacts[index - 1].section !== fact.section;
        const number = index - beeFacts.findIndex(other => other.section === fact.section) + 1;
        const heading = first ? `<span class="facts-group" aria-hidden="true">${SECTION_NAMES[fact.section]}</span>` : '';
        return `${heading}<button id="fact-tab-${fact.id}" role="tab" data-fact-index="${index}" aria-selected="${index === 0}" aria-controls="fact-panel-${fact.id}" tabindex="${index === 0 ? 0 : -1}"><span aria-hidden="true">${String(number).padStart(2, '0')}</span>${escapeHTML(fact.label)}</button>`;
      }).join('')}</div>
      <div class="facts-reader">${beeFacts.map((fact, index) => `<article class="fact-page" id="fact-panel-${fact.id}" role="tabpanel" aria-labelledby="fact-tab-${fact.id}" tabindex="0" ${index === 0 ? '' : 'hidden'}>
        <div class="fact-opening"><div><span class="fact-scope">${escapeHTML(fact.scope)}</span><h3>${escapeHTML(fact.title)}</h3></div><svg class="fact-drawing" viewBox="0 0 170 124" fill="none" aria-hidden="true"><ellipse cx="86" cy="70" rx="64" ry="46" fill="#ede9d5" opacity=".65"/>${drawings[fact.id]}</svg></div>
        <div class="fact-comparison"><section><h4>In nature</h4><p>${escapeHTML(fact.nature)}</p></section><section><h4>In this game</h4><p>${gameMarkup(fact.game)}</p></section></div>
        ${fact.spotting ? `<div class="fact-spotting"><h4>Where to look</h4><p>${gameMarkup(fact.spotting)}</p></div>` : ''}
        <div class="fact-sources"><h4>From the field</h4>${fact.sources.map(sourceLink).join('')}</div>
      </article>`).join('')}</div>
    </div>
    <footer class="facts-footer"><span data-facts-status>The meadow is paused. Take your time.</span><span>Sources open in a new tab.</span></footer>
  </section>`;
}
