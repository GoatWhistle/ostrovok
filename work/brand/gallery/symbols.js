const PIN = "M32 61C26 50 14 40 14 26a18 18 0 1 1 36 0c0 14-12 24-18 35Z"
const wave = (y) => `M4 ${y}q7-7 14 0t14 0t14 0t14 0`

export const SYMBOLS = {
  pinDot: `<path class="b" fill-rule="evenodd" d="${PIN}M32 17a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z"/><circle class="a" cx="32" cy="26" r="5"/>`,
  crosshair: `<circle class="sb" cx="32" cy="32" r="19" stroke-width="5"/><rect class="b" x="29.5" y="2" width="5" height="13"/><rect class="b" x="29.5" y="49" width="5" height="13"/><rect class="b" x="2" y="29.5" width="13" height="5"/><rect class="b" x="49" y="29.5" width="13" height="5"/><circle class="a" cx="32" cy="32" r="7"/>`,
  pinSun: `<path class="b" fill-rule="evenodd" d="${PIN}M21 31a11 11 0 0 1 22 0Z"/><path class="a" d="M25 31a7 7 0 0 1 14 0Z"/>`,
  foldedMap: `<path class="b" d="M5 14 22 8v42L5 56Z"/><path class="a" d="M25 8l14 6v42l-14-6Z"/><path class="b" d="M42 14 59 8v42l-17 6Z"/>`,
  letterF: `<path class="b" d="M14 8h34v9H24v11h16v9H24v21H14Z"/><circle class="a" cx="47" cy="32.5" r="6"/>`,
  trig: `<path class="b" fill-rule="evenodd" d="M32 6 56 52H8ZM32 25 44 47H20Z"/><circle class="a" cx="32" cy="39" r="4.5"/><rect class="b" x="4" y="56" width="56" height="5"/>`,
  letterL: `<path class="b" d="M12 6h12v38h32v12H12Z"/><circle class="a" cx="43" cy="21" r="9"/>`,
  route: `<path class="sb" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" d="M10 50 26 30l14 10 14-24"/><circle class="b" cx="10" cy="50" r="6"/><circle class="b" cx="26" cy="30" r="5"/><circle class="b" cx="40" cy="40" r="5"/><path class="a" d="M54 6l9 9-9 9-9-9Z"/>`,
  letterW: `<path class="sb" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" d="M8 14 20 52 32 26l12 26 12-38"/><circle class="b" cx="20" cy="52" r="5"/><circle class="b" cx="44" cy="52" r="5"/><circle class="a" cx="56" cy="14" r="7"/>`,
  window: `<rect class="sb" x="10" y="8" width="44" height="48" rx="8" stroke-width="5"/><rect class="b" x="10" y="38" width="44" height="4"/><path class="a" d="M21 38a11 11 0 0 1 22 0Z"/><rect class="b" x="25" y="46" width="14" height="3"/>`,
  letterV: `<path class="b" d="M32 59 5 8h10l17 33L49 8h10Z"/><circle class="a" cx="32" cy="15" r="7.5"/>`,
  eye: `<path class="sb" stroke-width="5" stroke-linejoin="round" d="M4 32c10-16 46-16 56 0-10 16-46 16-56 0Z"/><circle class="a" cx="32" cy="32" r="8.5"/>`,
  binoculars: `<rect class="b" x="12" y="12" width="14" height="16" rx="3"/><rect class="b" x="38" y="12" width="14" height="16" rx="3"/><rect class="b" x="26" y="26" width="12" height="7"/><circle class="sb" cx="19" cy="40" r="12" stroke-width="5"/><circle class="sb" cx="45" cy="40" r="12" stroke-width="5"/><circle class="a" cx="45" cy="40" r="5"/>`,
  contour: `<path class="sb" stroke-width="4.5" d="M10 36C8 22 20 8 34 9c14 1 22 12 20 26-2 14-14 21-26 20C17 54 11 46 10 36Z"/><path class="sb" stroke-width="4.5" d="M19.5 35c-1-9 7-16.5 15-15.5 8 1 12.5 7 11.5 14.5-1 8-8 12.5-15 11.5-7 0-10.5-5-11.5-10.5Z"/><path class="a" d="M28 33c0-4 3-6.5 6-6.5s5.5 3 5.5 6-3 5.5-6 5.5-5.5-2-5.5-5Z"/>`,
  rings: `<circle class="sb" cx="32" cy="32" r="25" stroke-width="6"/><circle class="sb" cx="32" cy="32" r="13.5" stroke-width="6"/><circle class="a" cx="32" cy="32" r="5"/>`,
  waves: `<path class="sb" stroke-width="5.5" stroke-linecap="round" d="${wave(18)}"/><path class="sa" stroke-width="5.5" stroke-linecap="round" d="${wave(32)}"/><path class="sb" stroke-width="5.5" stroke-linecap="round" d="${wave(46)}"/>`,
  horizon: `<path class="a" d="M13 36a19 19 0 0 1 38 0Z"/><rect class="b" x="4" y="39" width="56" height="6"/><rect class="b" x="15" y="49" width="34" height="4.5"/><rect class="b" x="24" y="57" width="16" height="4"/>`,
  letterH: `<rect class="b" x="9" y="7" width="11" height="50"/><rect class="b" x="44" y="7" width="11" height="50"/><rect class="b" x="20" y="38" width="24" height="5"/><path class="a" d="M23.5 38a8.5 8.5 0 0 1 17 0Z"/>`,
  compass: `<circle class="sb" cx="32" cy="32" r="27" stroke-width="4.5"/><path class="a" d="M32 9 41 32H23Z"/><path class="b" d="M23 32h18l-9 23Z"/>`,
  globe: `<circle class="sb" cx="32" cy="34" r="24" stroke-width="4.5"/><ellipse class="sb" cx="32" cy="34" rx="10" ry="24" stroke-width="4"/><rect class="b" x="8" y="32" width="48" height="4"/><circle class="a" cx="32" cy="10" r="7"/>`,
  benchmark: `<rect class="a" x="6" y="8" width="52" height="8"/><path class="sb" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="miter" d="M14 54 32 24l18 30"/><rect class="b" x="28.75" y="24" width="6.5" height="36"/>`,
  ridges: `<path class="sb" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" d="M4 34 17 22l10 7 14-17 19 22"/><path class="sb" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" d="M4 46 17 34l10 7 14-17 19 22"/><path class="sb" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" d="M4 58 17 46l10 7 14-17 19 22"/><circle class="a" cx="41" cy="10" r="6"/>`,
  notebook: `<rect class="sb" x="15" y="6" width="40" height="52" rx="4" stroke-width="5"/><rect class="b" x="8" y="14" width="10" height="5" rx="2"/><rect class="b" x="8" y="29.5" width="10" height="5" rx="2"/><rect class="b" x="8" y="45" width="10" height="5" rx="2"/><path class="a" transform="translate(21 11) scale(.62)" d="${PIN}"/>`,
  shore: `<circle class="a" cx="42" cy="17" r="9"/><path class="sb" stroke-width="5" stroke-linecap="round" d="${wave(37)}"/><path class="b" d="M4 50q7-7 14 0t14 0t14 0t14 0V61H4Z"/>`,
  key: `<circle class="sb" cx="32" cy="18" r="12.5" stroke-width="6"/><circle class="a" cx="32" cy="18" r="5"/><rect class="b" x="29" y="30" width="6" height="31"/><rect class="b" x="35" y="44" width="10" height="5"/><rect class="b" x="35" y="53" width="7" height="5"/>`,
  letterP: `<path class="b" fill-rule="evenodd" d="M14 6h22a17 17 0 0 1 0 34H25v19H14ZM36 15.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z"/><circle class="a" cx="36" cy="23" r="3.5"/>`,
  pinCheck: `<path class="b" fill-rule="evenodd" d="${PIN}M32 15a11 11 0 1 0 0 22a11 11 0 1 0 0-22Z"/><path class="sa" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M26.5 26.5l4 4 7.5-8"/>`,
  sunTile: `<path class="b" fill-rule="evenodd" d="M18 4h28a14 14 0 0 1 14 14v28a14 14 0 0 1-14 14H18A14 14 0 0 1 4 46V18A14 14 0 0 1 18 4ZM18 38a14 14 0 0 1 28 0ZM12 41h40v4H12ZM22 49h20v3.5H22Z"/><g class="tile-fill"><path class="a" d="M18 38a14 14 0 0 1 28 0Z"/><rect class="a" x="12" y="41" width="40" height="4"/><rect class="a" x="22" y="49" width="20" height="3.5"/></g>`,
  stamp: `<circle class="sb" cx="32" cy="32" r="26" stroke-width="4" stroke-dasharray="5 4.2"/><circle class="b" cx="32" cy="32" r="18"/><path class="a" transform="translate(22.5 15.5) scale(.6)" d="${PIN}"/>`,
}

export const DEVICES = {
  pin: (s) => `<path class="DEV" transform="scale(${s / 64})" d="${PIN}"/>`,
  pinHollow: (s) => `<path class="b" fill-rule="evenodd" transform="scale(${s / 64})" d="${PIN}M32 17a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z"/>`,
  sun: (s) => `<path class="a" transform="scale(${s / 64})" d="M8 52a24 24 0 0 1 48 0Z"/><rect class="a" transform="scale(${s / 64})" x="2" y="55" width="60" height="7"/>`,
  rings: (s) => `<g transform="scale(${s / 64})">${SYMBOLS.rings}</g>`,
  dot: (s) => `<circle class="a" cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/>`,
  diamond: (s) => `<path class="a" transform="scale(${s / 64})" d="M32 2l30 30-30 30L2 32Z"/>`,
}
