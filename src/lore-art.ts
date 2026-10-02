import { LORE_LABELS, type LoreCard, type LoreKind } from './lore';

// Frames for the bee lore cards, one style per kind: a Victorian frame with scrolled
// corners for old beliefs, a pearl-edged trade card for what people once thought, and a
// herbarium label with a pressed poppy for verse. Each sits on watercolour paper: a
// slightly uneven edge, a soft wash and a little grain.
export const LORE_W = 300, LORE_H = 196;

const paper = (tint: string, edge: string) => `
  <defs>
    <filter id="lore-edge" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="lore-wash" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".02 .05" numOctaves="3" seed="8"/><feDisplacementMap in="SourceGraphic" scale="22" xChannelSelector="R" yChannelSelector="B"/><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="lore-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 .42  0 0 0 0 .34  0 0 0 0 .2  0 0 0 -1.6 1.05"/></filter>
    <filter id="lore-ink"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="1" seed="2"/><feDisplacementMap in="SourceGraphic" scale="1.4" xChannelSelector="R" yChannelSelector="G"/></filter>
  </defs>
  <g filter="url(#lore-edge)"><rect x="5" y="5" width="${LORE_W - 10}" height="${LORE_H - 10}" rx="4" fill="#fbf5e5" stroke="${edge}" stroke-width=".7"/></g>
  <g opacity=".42" filter="url(#lore-wash)"><rect x="22" y="20" width="${LORE_W - 44}" height="${LORE_H - 40}" rx="30" fill="${tint}"/></g>
  <rect x="9" y="9" width="${LORE_W - 18}" height="${LORE_H - 18}" filter="url(#lore-grain)" opacity=".5"/>`;

const curl = `<g fill="none" stroke="#8a6a2f" stroke-width="1.1" stroke-linecap="round"><path d="M12 38C12 23 22 12 38 12"/><path d="M38 12C45 12 47 18 43 21C39 24 35 20 38 18"/><path d="M12 38C12 45 18 47 21 43C24 39 20 35 18 38"/><path d="M20 20C25 23 27 27 25 30" stroke-width=".8"/><circle cx="17" cy="17" r="1.7" fill="#8a6a2f" stroke="none"/></g>`;

function belief(): string {
  const W = LORE_W, H = LORE_H, c = W / 2;
  return `${paper('#e9d79e', '#c7ab68')}
  <g filter="url(#lore-ink)">
    <rect x="17" y="17" width="${W - 34}" height="${H - 34}" fill="none" stroke="#8a6a2f" stroke-width="1.4"/>
    <rect x="21" y="21" width="${W - 42}" height="${H - 42}" fill="none" stroke="#b99341" stroke-width=".55"/>
    ${curl}<g transform="translate(${W} 0) scale(-1 1)">${curl}</g><g transform="translate(0 ${H}) scale(1 -1)">${curl}</g><g transform="translate(${W} ${H}) scale(-1 -1)">${curl}</g>
    <path d="M${c} ${H - 25}C${c - 8} ${H - 32} ${c - 18} ${H - 30} ${c - 20} ${H - 25}C${c - 13} ${H - 22} ${c - 6} ${H - 22} ${c} ${H - 25}C${c + 6} ${H - 22} ${c + 13} ${H - 22} ${c + 20} ${H - 25}C${c + 18} ${H - 30} ${c + 8} ${H - 32} ${c} ${H - 25}Z" fill="#b99341" opacity=".85"/>
  </g>
  <ellipse cx="${c}" cy="17" rx="25" ry="10" fill="#fbf5e5"/>
  <ellipse cx="${c - 5}" cy="12" rx="6" ry="3.4" fill="#fbf9f0" stroke="#aaa487" stroke-width=".6" transform="rotate(-14 ${c - 5} 12)"/>
  <ellipse cx="${c + 5}" cy="12" rx="6" ry="3.4" fill="#fbf9f0" stroke="#aaa487" stroke-width=".6" transform="rotate(14 ${c + 5} 12)"/>
  <ellipse cx="${c}" cy="18" rx="9.5" ry="5.4" fill="#e8b84e" stroke="#7a5a2c" stroke-width=".8"/>
  <path d="M${c - 2.5} 13.4v9.2M${c + 2.5} 13.4v9.2" stroke="#4d3b25" stroke-width="1.8"/>
  <circle cx="${c - 9.5}" cy="18" r="2.6" fill="#4d3b25"/>`;
}

function thought(): string {
  const W = LORE_W, H = LORE_H, hex = (x: number, y: number) => `<path d="M${x} ${y - 6.5}l5.6 3.25v6.5L${x} ${y + 6.5}l-5.6-3.25v-6.5Z"/>`;
  const comb = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s} 1)" fill="none" stroke="#b99341" stroke-width="1">${hex(0, 0)}${hex(11.2, 0)}${hex(5.6, 9.75)}</g>`;
  return `${paper('#efc9a8', '#c58a69')}
  <rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="11" fill="none" stroke="#e9d9b8" stroke-width="7" filter="url(#lore-ink)"/>
  <rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="11" fill="none" stroke="#fffaf0" stroke-width="4.6" stroke-dasharray="0 8.6" stroke-linecap="round"/>
  <g filter="url(#lore-ink)">
    <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="5" fill="none" stroke="#b96043" stroke-width="1.1"/>
    ${comb(34, 34, 1)}${comb(W - 34, 34, -1)}
    <path d="M${W / 2 - 42} 57H${W / 2 + 42}" stroke="#b96043" stroke-width=".6"/>
    <circle cx="${W / 2}" cy="57" r="2" fill="#b96043"/>
  </g>`;
}

function verse(): string {
  const W = LORE_W, H = LORE_H;
  // A pressed field poppy: a nodding bud, cut grey-green leaves and one open flower.
  return `${paper('#d9dfc0', '#a9b190')}
  <g filter="url(#lore-ink)">
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" fill="none" stroke="#5b6b36" stroke-width="1.2"/>
    <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="#5b6b36" stroke-width=".45"/>
    <g fill="none" stroke="#6f8452" stroke-width="1.5" stroke-linecap="round"><path d="M50 178C53 150 45 120 52 74"/><path d="M50 140C42 124 32 116 27 102"/></g>
    <path d="M51 158c-7-2-9-7-15-6 3 2 1 4 5 5-5 0-6 3-11 2 4 3 9 4 14 3-4 2-5 5-9 6 6 1 11-2 16-7Z" fill="#7d8f5c"/>
    <path d="M50 120c6-3 7-8 13-8-2 2 0 4-4 6 5-1 6 2 11 0-3 4-8 5-13 5 4 1 5 4 9 4-6 3-11 0-16-3Z" fill="#7d8f5c"/>
    <ellipse cx="25.5" cy="106" rx="4.4" ry="7" fill="#6f8452" transform="rotate(18 25.5 106)"/>
    <path d="M23 111c1 3 4 4 6 2" stroke="#c9473a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <g transform="translate(53 60)">
      <ellipse cx="-11" cy="-7" rx="15" ry="13" fill="#b93b30"/><ellipse cx="11" cy="-7" rx="15" ry="13" fill="#b93b30"/>
      <ellipse cx="-10" cy="7" rx="15" ry="13" fill="#d8574a"/><ellipse cx="10" cy="7" rx="15" ry="13" fill="#d8574a"/>
      <path d="M-18 6c4-3 8-3 11 0M18 6c-4-3-8-3-11 0" stroke="#a83429" stroke-width=".8" fill="none"/>
      <circle r="6.5" fill="#2e2a26"/><circle r="3" fill="#7d8f5c"/>
      <g fill="#2e2a26"><circle cx="-8" cy="-4" r="1"/><circle cx="8" cy="-3" r="1"/><circle cx="-6" cy="6" r="1"/><circle cx="7" cy="6" r="1"/><circle cx="0" cy="-9" r="1"/></g>
    </g>
    <path d="M96 52H${W - 26}" stroke="#5b6b36" stroke-width=".5"/>
    <path d="M96 ${H - 48}H${W - 26}" stroke="#5b6b36" stroke-width=".5" stroke-dasharray="2 3"/>
  </g>`;
}

const FRAMES: Record<LoreKind, () => string> = { belief, thought, verse };
const escape = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** The inside of the card element for one card. */
export function loreCardMarkup(card: LoreCard): string {
  const text = card.kind === 'verse' ? card.lines.map(l => `<span>${escape(l)}</span>`).join('') : escape(card.lines.join(' '));
  return `<svg class="lore-frame" viewBox="0 0 ${LORE_W} ${LORE_H}" aria-hidden="true">${FRAMES[card.kind]()}</svg>
    <div class="lore-text"><span class="lore-label">${LORE_LABELS[card.kind]}</span><p class="lore-line">${text}</p><span class="lore-source">${escape(card.source)}</span></div>`;
}
