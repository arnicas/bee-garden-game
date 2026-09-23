/** A tiny field-guide bouquet for the pollination tally. */
export const happyMeadowArt = `<svg class="meadow-art" viewBox="0 0 94 82" fill="none" aria-hidden="true">
  <defs>
    <radialGradient id="happy-daisy"><stop stop-color="#fffef2"/><stop offset="1" stop-color="#eadfbc"/></radialGradient>
    <radialGradient id="happy-poppy"><stop stop-color="#edab80"/><stop offset="1" stop-color="#ce7961"/></radialGradient>
    <radialGradient id="happy-cornflower"><stop stop-color="#ccd1e0"/><stop offset="1" stop-color="#8d9fb9"/></radialGradient>
    <radialGradient id="happy-gold"><stop stop-color="#ffe6a0"/><stop offset="1" stop-color="#dfb856"/></radialGradient>
  </defs>
  <ellipse cx="48" cy="76" rx="34" ry="3" fill="#667951" opacity=".12"/>
  <g stroke="#7b8c60" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M44 75q-2-25-23-35m27 35q-4-22 0-51m4 51q2-20 23-34"/>
    <path d="M37 63c-12 1-18-9-18-9s13-2 18 9Z" fill="#a0af7c"/>
    <path d="M44 53c-10-3-13-13-13-13s12 2 13 13Z" fill="#b6bd89"/>
    <path d="M48 62c0-11 13-14 13-14s-3 12-13 14Z" fill="#9bab76"/>
    <path d="M61 59c10 3 16-6 16-6s-12-3-16 6Z" fill="#b2bb87"/>
    <path d="m40 76-4-6m17 6 6-5m-6 4 2-6" stroke-width=".9"/>
  </g>
  <g transform="translate(21 39) rotate(-16)">
    <path d="M0-10C-12-23-24-6-12 2c-7 13 8 19 13 9 12 6 19-7 11-12C21-13 7-21 0-10Z" fill="url(#happy-poppy)" stroke="#b8785e" stroke-width="1"/>
    <path d="M-13-7q-1-5 4-7M5-14q5-1 8 4m-20 20 5 3" stroke="#f8d4a9" stroke-width="1" stroke-linecap="round"/>
    <circle r="8.5" fill="url(#happy-gold)" stroke="#c39247" stroke-width=".75"/>
    <path d="M-3-1v1m6-1v1m-6 3q3 4 6 0" stroke="#715f3c" stroke-width="1.35" stroke-linecap="round"/>
    <ellipse cx="-5.5" cy="2.5" rx="1.5" ry=".9" fill="#d9946c" opacity=".6"/><ellipse cx="5.5" cy="2.5" rx="1.5" ry=".9" fill="#d9946c" opacity=".6"/>
  </g>
  <g transform="translate(48 22) rotate(8)">
    <g fill="url(#happy-daisy)" stroke="#b3ad87" stroke-width=".8">
      <ellipse cy="-11" rx="4.5" ry="9"/><ellipse cy="-11" rx="4.5" ry="9" transform="rotate(45)"/>
      <ellipse cy="-11" rx="4.5" ry="9" transform="rotate(90)"/><ellipse cy="-11" rx="4.5" ry="9" transform="rotate(135)"/>
      <ellipse cy="-11" rx="4.5" ry="9" transform="rotate(180)"/><ellipse cy="-11" rx="4.5" ry="9" transform="rotate(225)"/>
      <ellipse cy="-11" rx="4.5" ry="9" transform="rotate(270)"/><ellipse cy="-11" rx="4.5" ry="9" transform="rotate(315)"/>
    </g>
    <circle r="10" fill="url(#happy-gold)" stroke="#c3a15e" stroke-width=".9"/>
    <path d="M-3.5-2v1.3m7-1.3v1.3m-7 3.4q3.5 4.8 7 0" stroke="#75603c" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="-6.5" cy="2.8" rx="1.8" ry="1" fill="#d5a271" opacity=".65"/><ellipse cx="6.5" cy="2.8" rx="1.8" ry="1" fill="#d5a271" opacity=".65"/>
    <path d="M-5-6q4-3 7-1" stroke="#fff4c6" stroke-width="1.2" stroke-linecap="round"/>
  </g>
  <g transform="translate(76 41) rotate(17)">
    <path d="m0-15 4 5 7-3-1 7 6 3-5 5 3 6-7 1-3 6-5-5-6 3-1-7-6-3 5-5-3-6 7-1Z" fill="url(#happy-cornflower)" stroke="#7e8da1" stroke-width="1" stroke-linejoin="round"/>
    <path d="m-8-6 3 3m9-6-1 4m7 8-4-1m-4 9-1-4" stroke="#e0e3e9" stroke-width="1" stroke-linecap="round"/>
    <circle r="7.8" fill="#f3e5b9" stroke="#a6a080" stroke-width=".8"/>
    <path d="M-3-1v1m6-1v1m-6 3q3 3.5 6 0" stroke="#706544" stroke-width="1.3" stroke-linecap="round"/>
    <ellipse cx="-5" cy="2.5" rx="1.4" ry=".8" fill="#d6ad92" opacity=".7"/><ellipse cx="5" cy="2.5" rx="1.4" ry=".8" fill="#d6ad92" opacity=".7"/>
  </g>
  <path class="meadow-thanks" d="M77 16c-14-7-9-15-3-10 4-7 13-2 3 10Z" fill="#cf9478" stroke="#b87c62" stroke-width=".7"/>
</svg>`;

/** Small pen-and-wash blooms for the transfer notice; no shared SVG IDs. */
export const pollinationFlowers = {
  poppy: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M24 13C14-3 0 10 10 23 0 33 14 47 25 36 39 47 50 31 38 23 49 10 33-1 24 13Z" fill="#db7965" stroke="#ad6553" stroke-width="1.1"/>
    <path d="M11 16Q5 9 14 8m16-1q8-1 10 7M9 32q3 6 9 5" stroke="#f9c6a3" stroke-width="1.5" stroke-linecap="round"/>
    <path d="m12 16 8 6m14-9-7 10m6 10-7-6m-12 8 8-9" stroke="#a8554c" stroke-width=".8" opacity=".45"/>
    <circle cx="24" cy="24" r="7" fill="#62534b"/><circle cx="24" cy="24" r="3.3" fill="#9e8860"/>
    <path d="M21 22h1m4 0h1m-5 5q2 1 4-1" stroke="#eee0b8" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,
  daisy: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <g transform="translate(24 24)" fill="#fffbed" stroke="#bcb18e" stroke-width=".85">
      ${Array.from({ length: 10 }, (_, i) => `<ellipse cy="-12.5" rx="4.2" ry="10" transform="rotate(${i * 36})"/>`).join('')}
      <circle r="9" fill="#e8bd60" stroke="#b99549"/>
      <path d="M-5-4q4-3 8-1" stroke="#fff0b7" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M-3-1v1m6-1v1m-6 3q3 3 6 0" stroke="#826c43" stroke-width="1.2" stroke-linecap="round"/>
    </g>
  </svg>`,
  cornflower: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="m24 3 4 8 8-6-1 11 10-1-6 9 7 6-11 2 2 10-10-4-5 8-4-10-10 5 2-11-8-3 8-7-6-9 11 3 1-11 6 8Z" fill="#87a7cd" stroke="#7089aa" stroke-width="1" stroke-linejoin="round"/>
    <path d="m23 9 1 10m12-7-7 9m11 6-10-1m0 12-4-9m-10 8 5-9m-10-7 8 3m-5-12 7 8" stroke="#e1eaf2" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="7.5" fill="#746483" stroke="#665d78" stroke-width=".8"/>
    <path d="M21 22v1m6-1v1m-6 3q3 3 6 0" stroke="#f1e8d4" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,
};

/** Species silhouettes stay recognizable before their pollination colors fill in. */
export const coveragePetals = {
  poppy: `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path class="petal-color" d="M16 29C12 24 2 19 3 10 4 3 12 1 16 7 21 1 29 4 29 11c0 8-9 15-13 18Z" fill="#d78068"/>
    <path d="M16 29C12 24 2 19 3 10 4 3 12 1 16 7 21 1 29 4 29 11c0 8-9 15-13 18Z" stroke="#ad775c" stroke-width="1"/>
    <path d="M16 27q-3-8-8-13m8 13 1-14m-1 13q6-8 8-12" stroke="#a9654f" stroke-width=".7" opacity=".5"/>
    <path d="M6 10q1-5 5-3m9 0q4-2 6 2" stroke="#ffe4bf" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,
  daisy: `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path class="petal-color" d="M15 30C9 23 4 12 8 5c3-5 12-4 15 1 4 9-2 20-8 24Z" fill="#fffdf1"/>
    <path d="M15 30C9 23 4 12 8 5c3-5 12-4 15 1 4 9-2 20-8 24Z" stroke="#a99f77" stroke-width="1.1"/>
    <path d="M15 28q-3-10-2-19m3 18q5-12 4-17" stroke="#c8bd95" stroke-width=".8" stroke-linecap="round"/>
    <path d="M15 30q-4-5-4-8 5 3 9 0-1 4-5 8Z" fill="#d9b455"/>
    <path d="M10 7q3-4 7-2" stroke="#fffef8" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,
  cornflower: `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path class="petal-color" d="M15 30 7 20 3 7l7 3 2-8 6 7 7-6 1 10 5-1-8 13Z" fill="#8dadd1"/>
    <path d="M15 30 7 20 3 7l7 3 2-8 6 7 7-6 1 10 5-1-8 13Z" stroke="#748caa" stroke-width="1" stroke-linejoin="round"/>
    <path d="M15 28 10 15m6 12 1-13m0 12 7-10" stroke="#6883a4" stroke-width=".8" stroke-linecap="round" opacity=".7"/>
    <path d="m8 12 3 6m3-11 3 5m6-4-2 5" stroke="#dceaf5" stroke-width="1" stroke-linecap="round"/>
  </svg>`,
};
