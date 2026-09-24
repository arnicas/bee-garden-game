import './bee-facts.css';

interface FactSource { label: string; url: string }
interface BeeFact {
  id: string;
  label: string;
  title: string;
  scope: string;
  nature: string;
  game: string;
  sources: readonly FactSource[];
}

/** Interpretive notes, not simulation rules. Research trail: artifacts/bee-facts-sources.md. */
export const beeFacts: readonly BeeFact[] = [
  {
    id: 'vision', label: 'A different light', title: 'Flowers in another light.', scope: 'Honeybees',
    nature: 'Honeybees have ultraviolet, blue and green colour receptors. A flower can show them patterns we cannot see. Ultraviolet is part of a richer visual world, rather than a separate night-vision mode.',
    game: 'Q makes this difference visible to human eyes. The glowing tips that suggest matching flowers are a game guide, not a literal view through a bee’s eyes.',
    sources: [{ label: 'Honeybee colour vision · Hempel de Ibarra et al.', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4035557/' }],
  },
  {
    id: 'food', label: 'Two kinds of food', title: 'Sweetness and sunshine.', scope: 'Honeybees & other bees',
    nature: 'Nectar supplies carbohydrates; pollen supplies protein, fats and other nutrients. Honeybee foragers carry nectar in their crop, and can pass some into the gut to fuel their own flight. Not every collected drop is reserved for the colony.',
    game: 'Hold F or left mouse to sip nectar on a flower. Nectar feeds your wings and fills the hive’s jar. Pollen fills a separate pouch. The shared harvest goal makes one little journey from several kinds of foraging.',
    sources: [
      { label: 'Food for bees · University of Minnesota Extension', url: 'https://extension.umn.edu/agriculture/specialty-crops/pollination/habitat' },
      { label: 'The complex life of the honey bee · Purdue Extension', url: 'https://ag.purdue.edu/department/extension/ppp/resources/ppp-publications/mobile/ppp-116-pol-91.html' },
    ],
  },
  {
    id: 'pollen', label: 'A dusting of gold', title: 'Tiny travellers, carried home.', scope: 'Worker honeybees',
    nature: 'A honeybee grooms pollen from her body and packs it into baskets on her hind legs. A little nectar helps the grains hold together. Loose grains on the body can also travel between flowers.',
    game: 'Use W A S D to walk through anthers and collect pollen. Your newest colour gathers on your knuckles; older colours remain as flecks. These visible front-leg grains are a game reminder, not real pollen baskets.',
    sources: [
      { label: 'Honeybee basic biology · University of Arizona Extension', url: 'https://extension.arizona.edu/publication/honeybee-series-honeybee-basic-biology' },
      { label: 'Native pollinators · Agriculture and Agri-Food Canada', url: 'https://www.fs.usda.gov/wildflowers/pollinators/documents/AgCanadaNativePollinators.pdf' },
    ],
  },
  {
    id: 'pollination', label: 'One flower to another', title: 'A small visit. A new beginning.', scope: 'Pollination & honeybee foraging',
    nature: 'Pollination moves pollen from an anther to a receptive stigma; successful fertilization comes later. Honeybees often keep visiting one flower species, helping its pollen reach a compatible flower. This flower constancy is a tendency, not an unbreakable rule.',
    game: 'Carry pollen to another flower of the same type to help it. Each flower earns one mark in your journal. Real seed formation is more involved than a single landing.',
    sources: [
      { label: 'Native pollinators · Agriculture and Agri-Food Canada', url: 'https://www.fs.usda.gov/wildflowers/pollinators/documents/AgCanadaNativePollinators.pdf' },
      { label: 'Flower constancy · Grüter & Ratnieks', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3306322/' },
    ],
  },
  {
    id: 'weather', label: 'Shelter from Rain', title: 'Let the shower pass.', scope: 'Bumblebees; game weather is simplified',
    nature: 'Bumblebees can cope with cool, wet weather. Their hairy bodies and the heat from their flight muscles help; staying still reduces their energy needs. A resting bee is not necessarily in trouble, and different bees tolerate weather differently.',
    game: 'Press E to land or shelter; press E again once settled to rest. A brief rest spends stored nectar to restore energy and speeds daylight; stillness alone is not food. Rain builds cold and drains energy: leaf undersides and dense grass shelter you, but flowers and leaf tops remain exposed. Blue edges warn of cold or low energy. The rapid cold penalty is a game choice, not a measured bee temperature.',
    sources: [{ label: 'Bumblebees in bad weather · Bumblebee Conservation Trust', url: 'https://www.bumblebeeconservation.org/learn-about-bumblebees/faqs/bad-weather/' }],
  },
  {
    id: 'heat', label: 'Sun & shade', title: 'A moment in the shade.', scope: 'Honeybee research; game heat is simplified',
    nature: 'Flight muscles produce heat, and sunshine adds warmth. Honeybees can adjust their wingbeats and use evaporative cooling to avoid overheating. Hot, dry conditions also increase the danger of water loss. Their heat balance is more subtle than simply running out of energy in the sun.',
    game: 'Orange edges warn that you’re overheating. E near a broad leaf tucks you underneath; dense grass near the soil also cools you. Flowers and leaf tops stay exposed. Shade stops the extra drain; nectar restores energy. Press E once settled to rest, using stored nectar while daylight advances. Watch the sun on the day strip: its orange glow and heat waves mark the hot spell. Our fast heat penalty is a game simplification.',
    sources: [
      { label: 'Keeping cool in flight · Glass et al.', url: 'https://pubmed.ncbi.nlm.nih.gov/38227669/' },
      { label: 'Foraging in sun and shade · Kovac & Stabentheiner', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3298660/' },
    ],
  },
  {
    id: 'flowers', label: 'Three meadow flowers', title: 'Each flower has its gift.', scope: 'Corn poppy, oxeye daisy & cornflower',
    nature: 'Corn poppies make almost no nectar, but more pollen than almost any other meadow flower; bees carry it home in dark grey loads. Cornflowers are rich in nectar. What looks like one oxeye daisy is really hundreds of tiny flowers: each white “petal” is one, and the yellow centre is packed with more. Each holds only a little nectar, and the daisy’s plentiful pollen comes a little at a time over about two weeks.',
    game: 'Each flower gives what its real counterpart does best. Cornflowers hold the most nectar; poppies hold the most pollen and no nectar at all; daisies offer some of each. Choose your next flower by what you still need. Amounts are simplified: here each daisy is a single stop, and every flower offers its whole share at once.',
    sources: [
      { label: 'Food for pollinators: urban meadow nectar and pollen · PLOS One', url: 'https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0158117' },
      { label: 'Bees love poppies · Buzz About Bees', url: 'https://www.buzzaboutbees.net/Bees-poppies.html' },
    ],
  },
  {
    id: 'home', label: 'The way home', title: 'A harvest worth sharing.', scope: 'Honeybees',
    nature: 'Back at the hive, successful honeybee foragers can use a waggle dance to share the direction and distance of a profitable flower patch with nestmates. This is a honeybee behaviour, not a dance performed by every kind of bee.',
    game: 'When you have enough nectar and pollen to make the hive happy, the R (Return Home) control appears as “Way home” in the UI. Press R for guidance, then follow the hive marker to the meadow edge. Your heavier harvest changes the flight home. One outing stands for a whole day; real trips do not follow this clock. In our ending at the hive, two returning bees perform a simplified, simulated waggle dance, tracing little figure-eights. Their dance is decorative and does not communicate flower locations.',
    sources: [{ label: 'Decoding waggle dances · University of Sussex', url: 'https://www.sussex.ac.uk/lasi/sussexplan/dances' }],
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
  home: `<path d="M86 100h58v-34H86Zm-7-34 36-28 36 28M90 73h50m-50 9h50m-50 9h50" fill="#e6cc8d" stroke="#7c8057" stroke-width="1.3"/><path d="M108 100v-10a7 7 0 0 1 14 0v10" fill="#687354"/><g transform="translate(47 57) rotate(34) scale(.64)">${bee}</g><path d="M31 94C6 69 42 10 81 38" fill="none" stroke="#a89666" stroke-dasharray="2 4"/>`,
};
const htmlEscapes: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (value: string) => value.replace(/[&<>"']/g, character => htmlEscapes[character]);
function gameMarkup(value: string): string {
  return escapeHTML(value).replace(/\b(W A S D|left mouse|Q|E|F|R)\b/g, control =>
    `<kbd class="fact-key">${control}</kbd>`);
}
function sourceLink(source: FactSource): string {
  const url = new URL(source.url);
  if (url.protocol !== 'https:') throw new Error('Bee fact sources must use HTTPS.');
  return `<a href="${escapeHTML(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.label)}<span aria-hidden="true"> ↗</span><span class="facts-sr-only"> (opens in a new tab)</span></a>`;
}

export function beeFactsMarkup(): string {
  return `<section id="bee-facts" class="journal-page bee-facts-page" role="dialog" aria-modal="true" aria-labelledby="bee-facts-title" hidden>
    <header class="facts-heading"><div><span class="eyebrow">NOTES FROM A SMALL WORLD</span><h2 id="bee-facts-title" tabindex="-1">Small wonders.</h2></div><button class="facts-back" data-action="facts-close">← <span data-facts-return>Field guide</span><kbd>Esc</kbd></button></header>
    <p class="facts-intro">A bee works hard, even without considering predators and pesticides. Our game is inspired by some real bee biology challenges.</p>
    <div class="facts-spread">
      <div class="facts-index" role="tablist" aria-label="Bee fact topics" aria-orientation="vertical">${beeFacts.map((fact, index) => `<button id="fact-tab-${fact.id}" role="tab" data-fact-index="${index}" aria-selected="${index === 0}" aria-controls="fact-panel-${fact.id}" tabindex="${index === 0 ? 0 : -1}"><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${escapeHTML(fact.label)}</button>`).join('')}</div>
      <div class="facts-reader">${beeFacts.map((fact, index) => `<article class="fact-page" id="fact-panel-${fact.id}" role="tabpanel" aria-labelledby="fact-tab-${fact.id}" tabindex="0" ${index === 0 ? '' : 'hidden'}>
        <div class="fact-opening"><div><span class="fact-scope">${escapeHTML(fact.scope)}</span><h3>${escapeHTML(fact.title)}</h3></div><svg class="fact-drawing" viewBox="0 0 170 124" fill="none" aria-hidden="true"><ellipse cx="86" cy="70" rx="64" ry="46" fill="#ede9d5" opacity=".65"/>${drawings[fact.id]}</svg></div>
        <div class="fact-comparison"><section><h4>In nature</h4><p>${escapeHTML(fact.nature)}</p></section><section><h4>In this game</h4><p>${gameMarkup(fact.game)}</p></section></div>
        <div class="fact-sources"><h4>From the field</h4>${fact.sources.map(sourceLink).join('')}</div>
      </article>`).join('')}</div>
    </div>
    <footer class="facts-footer"><span data-facts-status>The meadow is paused. Take your time.</span><span>Sources open in a new tab.</span></footer>
  </section>`;
}
