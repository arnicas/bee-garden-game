/** Small field-guide illustrations. The colored contents are live SVG meters. */
export const cargoArt = {
  energy: `<svg class="cargo-art" viewBox="0 0 108 90" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="plate-glaze" cx=".35" cy=".25" r=".8"><stop stop-color="#fffdf0"/><stop offset=".75" stop-color="#efe6c8"/><stop offset="1" stop-color="#d9cca9"/></radialGradient>
      <linearGradient id="plate-food" x1="25" y1="21" x2="68" y2="67" gradientUnits="userSpaceOnUse"><stop stop-color="#f6d779"/><stop offset=".6" stop-color="#e5b54f"/><stop offset="1" stop-color="#c38a35"/></linearGradient>
      <linearGradient id="spoon-wood" x1="86" y1="15" x2="96" y2="66" gradientUnits="userSpaceOnUse"><stop stop-color="#ddbd82"/><stop offset="1" stop-color="#a78250"/></linearGradient>
    </defs>
    <ellipse cx="51" cy="80" rx="35" ry="4" fill="#4d593c" opacity=".12"/>
    <path d="M46 8C66 7 82 22 82 42c1 22-15 36-35 37C25 78 10 63 10 43 9 23 25 9 46 8Z" fill="url(#plate-glaze)" stroke="#8b9270" stroke-width="1.4"/>
    <path d="M20 56C11 36 24 16 44 15m16 1c20 8 24 29 13 44M24 68c10 8 25 9 36 3" stroke="#fffdf2" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="46" cy="43" r="27" fill="#e9ddbc" stroke="#b1aa81" stroke-width=".8"/>
    <circle cx="46" cy="43" r="24" fill="#f9f0d7"/>
    <path data-fill="energy" fill="url(#plate-food)" stroke="#b58b40" stroke-width=".65" stroke-linejoin="round"/>
    <path d="M30 21q7-5 14-5m13 55q8-3 12-9" stroke="#7e8a64" stroke-width=".9" stroke-linecap="round"/>
    <path d="M32 20q-5-7 2-5 3 1 3 3m3-2q-1-6 4-4 3 1 2 4m18 50q7 0 4 4-2 2-5 0" fill="#89966b" opacity=".8"/>
    <circle cx="17" cy="46" r="1" fill="#8d9871"/><circle cx="74" cy="37" r=".9" fill="#8d9871"/>
    <path d="M31 58q6 5 12 5M55 24q6 3 8 6" stroke="#fff5ce" stroke-width="1.1" stroke-linecap="round" opacity=".5"/>
    <g transform="rotate(12 91 44)">
      <path d="M90 33c-1 12-4 28-3 36 0 3 5 4 6 1 1-10 0-25 1-37" fill="url(#spoon-wood)" stroke="#8c754e" stroke-width="1.1"/>
      <ellipse cx="93" cy="23" rx="8" ry="12" fill="url(#spoon-wood)" stroke="#8c754e" stroke-width="1.2"/>
      <ellipse cx="93" cy="22" rx="4.5" ry="7.5" fill="#ba985e" opacity=".7"/>
      <path d="M90 15q-4 7-1 12m1 14-1 23" stroke="#f3dbad" stroke-width="1.2" stroke-linecap="round"/>
    </g>
  </svg>`,
  nectar: `<svg class="cargo-art" viewBox="0 0 108 90" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="jar-glass" x1="25" y1="30" x2="81" y2="75" gradientUnits="userSpaceOnUse"><stop stop-color="#fffcdf" stop-opacity=".85"/><stop offset=".55" stop-color="#f4e8bc" stop-opacity=".4"/><stop offset="1" stop-color="#d5bf86" stop-opacity=".7"/></linearGradient>
      <linearGradient id="jar-honey" x1="30" y1="28" x2="76" y2="80" gradientUnits="userSpaceOnUse"><stop stop-color="#f7d477"/><stop offset=".4" stop-color="#e9b344"/><stop offset="1" stop-color="#c88a30"/></linearGradient>
      <clipPath id="jar-inside"><path d="M34 24h38c0 8 10 7 10 18l-2 30q0 7-9 8H34q-10-1-10-8l-2-30c0-11 12-10 12-18Z"/></clipPath>
    </defs>
    <ellipse cx="53" cy="84" rx="29" ry="4" fill="#4d593c" opacity=".12"/>
    <path d="M32 23h42c0 9 11 8 11 20l-2 30c-1 8-5 10-14 10H35c-10 0-14-3-14-11l-2-29c0-12 13-11 13-20Z" fill="url(#jar-glass)" stroke="#96835a" stroke-width="1.3"/>
    <g clip-path="url(#jar-inside)">
      <rect data-fill="nectar" x="20" y="80" width="66" height="0" fill="url(#jar-honey)"/>
      <path data-honey-surface stroke="#f8d783" stroke-width="2.3" stroke-linecap="round"/>
      <path d="M75 34q4 20 0 39" stroke="#a96924" stroke-width="5" opacity=".13"/>
    </g>
    <path d="M26 38q-2 13 0 24m1 5v4" stroke="#fffef0" stroke-width="3" stroke-linecap="round" opacity=".75"/>
    <path d="M34 77q17 4 35 0" stroke="#fff5ce" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
    <path d="M29 16q22-5 48 0l2 8-8-1-5 4-8-3-7 3-9-3-9 2-6-4Z" fill="#ece6c9" stroke="#95896a" stroke-width="1"/>
    <path d="M30 16h47M35 20l3 4m11-5v5m13-5 2 5m9-5 2 3" stroke="#a8ae86" stroke-width="1"/>
    <rect x="30" y="10" width="47" height="9" rx="4" fill="#87956b" stroke="#697957" stroke-width="1.2"/>
    <path d="M35 13h35" stroke="#d6dfba" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M39 44q14-3 29 0l-1 18q-14 3-29 0Z" fill="#fcf4d8" stroke="#c3ae7b" stroke-width=".8"/>
    <g transform="translate(53 53) rotate(-12)">
      <path d="M-2-1c-10-9-13 2-3 3m8-3c10-9 13 2 3 3" fill="#ebe9cf" stroke="#8c895f" stroke-width=".8"/>
      <ellipse cy="3" rx="5" ry="6" fill="#bd8d3c"/><path d="M-4 1h8m-8 4h8" stroke="#665737" stroke-width="1.7"/>
      <path d="m-2-3-2-3m6 3 2-3" stroke="#665737" stroke-width=".8" stroke-linecap="round"/>
    </g>
    <g class="reserve-mark" stroke="#69734e" stroke-width="1.3" stroke-linecap="round"><path d="M77 0h10m-2-2 2 2-2 2"/></g>
  </svg>`,
  pollen: `<svg class="cargo-art" viewBox="0 0 108 90" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="pouch-linen" x1="28" y1="30" x2="81" y2="78" gradientUnits="userSpaceOnUse"><stop stop-color="#f2dfb5"/><stop offset=".55" stop-color="#dfc592"/><stop offset="1" stop-color="#bea476"/></linearGradient>
      <pattern id="pollen-seeds" width="15" height="13" patternUnits="userSpaceOnUse">
        <path d="M4 1c5 0 7 5 3 7-5 3-8-6-3-7Z" fill="#f3c544" stroke="#bd9336" stroke-width=".7"/>
        <path d="M11 7c4-2 7 2 4 5-3 3-7-3-4-5Z" fill="#dfae37" stroke="#b78a31" stroke-width=".7"/>
        <path d="m3 3 2-1m6 7 2-1" stroke="#fff0ac" stroke-width="1" stroke-linecap="round"/>
      </pattern>
      <clipPath id="pouch-window"><path d="M33 36q20-6 39 0l5 29q-1 11-22 12-23-1-24-12Z"/></clipPath>
    </defs>
    <ellipse cx="53" cy="83" rx="32" ry="4" fill="#4d593c" opacity=".13"/>
    <path d="M30 24q22 9 45 0c-1 15 12 28 12 41 0 14-13 19-33 19-19 0-33-5-34-18-1-15 12-30 10-42Z" fill="url(#pouch-linen)" stroke="#967e55" stroke-width="1.4"/>
    <path d="M34 31q20 7 37 0m-43 9q-8 23-2 33m52-32q9 22 2 32" stroke="#b2996b" stroke-width="1" stroke-linecap="round"/>
    <path d="M33 36q20-6 39 0l5 29q-1 11-22 12-23-1-24-12Z" fill="#aa956e" opacity=".23"/>
    <g clip-path="url(#pouch-window)"><rect data-fill="pollen" x="28" y="77" width="52" height="0" fill="url(#pollen-seeds)"/></g>
    <path d="M33 37q20-6 39 0l5 28q-1 11-22 12-23-1-24-12Z" stroke="#f4e8c8" stroke-width="1.3" stroke-dasharray="2 3"/>
    <ellipse cx="53" cy="24" rx="23" ry="7" fill="#947c55" stroke="#8c7652" stroke-width="1.1"/>
    <ellipse cx="53" cy="23" rx="19" ry="4" fill="#d2b581"/>
    <path d="M31 23q22 9 44 0" stroke="#f6e5c1" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M32 30q20 7 41-1m0 0c15-14 18-1 1 2 14 1 15 10 5 7l-6-9m2 4q-4 10 4 15" stroke="#778664" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M76 16c-2-8 8-8 8-8s1 9-8 8Z" fill="#9daa79" stroke="#758562" stroke-width=".8"/>
    <path d="m76 19 6-9" stroke="#758562" stroke-width=".8"/>
    <path d="M28 72q3 5 9 6m33 0 6-3" stroke="#f5e4bf" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`,
};

export function energyWedge(fraction: number): string {
  if (fraction <= 0) return '';
  if (fraction >= .995) return 'M46 19a24 24 0 1 1 0 48a24 24 0 1 1 0-48Z';
  const angle = fraction * Math.PI * 2;
  const x = 46 + Math.sin(angle) * 24, y = 43 - Math.cos(angle) * 24;
  return `M46 43V19A24 24 0 ${fraction > .5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
}
