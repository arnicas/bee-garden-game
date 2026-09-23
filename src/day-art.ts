// A little painted almanac. All movement is supplied by the simulation clock.
export const dayArt = `<svg class="day-arc" viewBox="0 0 480 100" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="day-thread" x1="24" y1="0" x2="456" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#a9b58b"/><stop offset=".5" stop-color="#d2b068"/><stop offset="1" stop-color="#c58c75"/>
    </linearGradient>
    <radialGradient id="day-glow"><stop stop-color="#ffe8a6" stop-opacity=".7"/><stop offset="1" stop-color="#ffe8a6" stop-opacity="0"/></radialGradient>
    <radialGradient id="day-gold" cx=".35" cy=".28"><stop stop-color="#ffe6a0"/><stop data-day-pigment offset=".72" stop-color="#efc163"/><stop offset="1" stop-color="#d9a551"/></radialGradient>
    <linearGradient id="day-cloud-wash" x2=".25" y2="1"><stop stop-color="#f3f3e8"/><stop offset=".55" stop-color="#d5e1df"/><stop offset="1" stop-color="#9db8bf"/></linearGradient>
  </defs>
  <path d="M24 43Q240 7 456 43" stroke="url(#day-thread)" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1 6" opacity=".75"/>
  <path data-day-trail d="M24 43Q240 7 456 43" pathLength="1" stroke="url(#day-thread)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset="1" opacity=".65"/>
  <g stroke="#8b9271" stroke-width="1" stroke-linecap="round" opacity=".6">
    <path d="M15 52h18m-15-3a6 6 0 0 1 12 0m-6-10v-2m-9 7-2-1m18 1 2-1"/>
    <path d="M447 52h18m-15-3a6 6 0 0 1 12 0m-6-10v-2m-9 7-2-1m18 1 2-1" stroke="#b68870"/>
    <path d="M132 32v4m108-12v5m108 3v4" opacity=".65"/>
  </g>
  <g data-day-sun transform="translate(24 43) scale(.72)">
    <g data-day-heat opacity="0" stroke="#cd7749" stroke-width="1.2" stroke-linecap="round"><path d="M-24 8q-3-4 0-8t0-8M24 8q-3-4 0-8t0-8"/></g>
    <circle data-day-glow r="27" fill="url(#day-glow)"/>
    <g stroke="#c59442" stroke-width="1.15" stroke-linecap="round">
      <path d="M0-14v-3m0 31v3m-14-17h-3m31 0h3m-27-10-2-2m22 22 2 2m-22-2-2 2m22-22 2-2"/>
      <path d="m-5-13-.8-2m11.6 28 .8 2m6.4-20 2-.8m-28 11.6-2 .8m9-26 .8 2m-11.6 24 .8-2m26-11.6-2 .8m-24 11.6 2-.8" opacity=".3"/>
    </g>
    <circle class="day-sun-disc" r="10.5" fill="url(#day-gold)" stroke="#c99a4e" stroke-width=".7"/>
    <path d="M-6-4q2-4 6-4" stroke="#fff6cf" stroke-width="2.4" stroke-linecap="round" opacity=".65"/>
    <path d="M-3-1v1m6-1v1m-5 3q2 2 4 0" stroke="#997844" stroke-width="1.15" stroke-linecap="round"/>
    <ellipse cx="-5.5" cy="2" rx="1.7" ry="1" fill="#d8966b" opacity=".4"/><ellipse cx="5.5" cy="2" rx="1.7" ry="1" fill="#d8966b" opacity=".4"/>
  </g>
  <g data-day-cloud opacity="0">
    <path d="M-23 13c-14-1-14-19-2-21 1-14 23-17 29-4 10-8 24 0 22 10 14 3 12 20-3 20h-46Z" fill="url(#day-cloud-wash)" stroke="#90a6a9" stroke-width=".8" stroke-linejoin="round"/>
    <path d="M-27-3q4-5 10-3m4-8q8-6 14 3m9 3q6-3 10 3" stroke="#fffdf2" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
    <path d="M-22 12q10 5 19 2t23 0" stroke="#93afb9" stroke-width="2" stroke-linecap="round" opacity=".25"/>
    <g data-day-rain stroke="#729aac" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 5">
      <path class="rain-drop rain-drop-one" d="m1 22-4 10"/>
      <path class="rain-drop rain-drop-two" d="m-14 20-4 10"/>
      <path class="rain-drop rain-drop-three" d="m17 20-4 10"/>
    </g>
  </g>
  <g data-day-wind display="none" aria-hidden="true" transform="translate(24 75)">
    <ellipse cx="10" rx="35" ry="15" fill="#fbf5e5" opacity=".28"/>
    <g data-wind-arrow fill="#829464" stroke="#526447" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">
      <path d="M0-12C-2-8-5-4-8-1L-2-3-2 9Q0 12 2 9L2-3 8-1C5-4 2-8 0-12Z"/>
      <path d="M0-7V8" stroke="#fff7d7" stroke-width="1" opacity=".7"/>
      <g data-wind-streaks opacity="0" fill="none"><path d="M-6 4v8m12-8v8"/></g>
    </g>
    <g data-windsock transform="translate(18 -11)" stroke="#827654" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0 0v23m-3 0h6"/>
      <path data-windsock-cloth d="M1 2L16 7v4L1 10Z" fill="#dfb184"/>
      <path data-windsock-stripe d="M5 3.3v8" stroke="#fff4db" stroke-width="3"/>
      <ellipse cx="1" cy="6" rx="1.6" ry="4" fill="#efe0be"/>
    </g>
  </g>
</svg>`;
