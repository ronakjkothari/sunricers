/* Line icons, drawn once. Stroked with currentColor so they inherit whatever
   the surrounding text or resource colour is. No icon font, no CDN.

   Stroke weight is deliberately heavy (2.1 at 24px): hairline icons read as
   tentative next to Montserrat's weight, and disappear entirely in the rail. */

const P = {
  energy: '<path d="M13 2.5 5 13.4a.6.6 0 0 0 .48 1H11l-.9 7.1 8-10.9a.6.6 0 0 0-.48-1H12z"/>',
  water: '<path d="M12 2.8s6 6.1 6 10.1a6 6 0 0 1-12 0c0-4 6-10.1 6-10.1z"/>',
  carbon: '<path d="M17.4 18.2a4.1 4.1 0 0 0 .3-8.2A6 6 0 0 0 6.2 11 3.6 3.6 0 0 0 7 18.2z"/><path d="M9.2 21.6c1.6-1.2 2.4-2.9 2.4-5"/>',
  visits: '<circle cx="9" cy="8" r="3.3"/><path d="M2.7 20a6.3 6.3 0 0 1 12.6 0"/><path d="M16.6 5.5a3.3 3.3 0 0 1 0 5.9M18.1 20a6.4 6.4 0 0 0-2.1-4.7"/>',
  cooling: '<path d="M12 2.6v18.8M4.1 7.1l15.8 9.8M19.9 7.1 4.1 16.9"/><path d="m9.5 4.5 2.5 2.6 2.5-2.6M9.5 19.5l2.5-2.6 2.5 2.6"/>',
  heat: '<circle cx="12" cy="12" r="4"/><path d="M12 2.2v2.3M12 19.5v2.3M2.2 12h2.3M19.5 12h2.3M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/>',

  /* dashboard: the four-panel grid every reference design uses for "overview" */
  grid: '<rect x="3" y="3" width="7.4" height="7.4" rx="2"/><rect x="13.6" y="3" width="7.4" height="7.4" rx="2"/><rect x="3" y="13.6" width="7.4" height="7.4" rx="2"/><rect x="13.6" y="13.6" width="7.4" height="7.4" rx="2"/>',

  rank: '<path d="M4 20.5V10.5M10 20.5V4M16 20.5v-7.5M21.5 20.5h-19"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5.4M12 7.5v.7"/>',
  map: '<path d="M9.2 3.2 3.2 5.7v15.1l6-2.7 5.6 2.9 6-2.6V3.4l-6 2.7z"/><path d="M9.2 3.2v15.1M14.8 6.1v15.1"/>',
  book: '<path d="M4.2 4.8A2.3 2.3 0 0 1 6.5 2.5h12.8v17H6.5a2.3 2.3 0 0 0-2.3 2.3z"/><path d="M4.2 4.8v16.8"/>',
  layers: '<path d="M12 2.9 2.8 7.4 12 11.9l9.2-4.5z"/><path d="m2.8 12.2 9.2 4.5 9.2-4.5M2.8 16.9l9.2 4.5 9.2-4.5"/>',
  sliders: '<path d="M4 21v-6.5M4 10.2V3M12 21v-9.5M12 7.2V3M20 21v-4.5M20 12.2V3M1.6 14.5h4.8M9.6 7.2h4.8M17.6 16.5h4.8"/>',

  arrow: '<path d="M4.5 12h13.5M12.5 5.8 18.7 12l-6.2 6.2"/>',
  chev: '<path d="M9 5.5 15.5 12 9 18.5"/>',
  chevDown: '<path d="M5.5 9 12 15.5 18.5 9"/>',
  download: '<path d="M12 3.2v12.2M7.4 10.8 12 15.4l4.6-4.6M3.8 20.4h16.4"/>',
  moon: '<path d="M20.6 14.5A8.7 8.7 0 0 1 9.5 3.4a8.7 8.7 0 1 0 11.1 11.1z"/>',
  sun: '<circle cx="12" cy="12" r="4.1"/><path d="M12 2.2v2.3M12 19.5v2.3M2.2 12h2.3M19.5 12h2.3M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  check: '<path d="m5 12.6 4.7 4.7L19 7.9"/>',
  anchor: '<circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="8.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.2 16.2 4.3 4.3"/>',
};

/**
 * @param {string} name  key of P
 * @param {number} size  px, square
 * @param {number} [weight]  stroke width in the 24-unit viewBox
 */
export function icon(name, size = 18, weight = 2.1) {
  const d = P[name] || P.info;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
    stroke="currentColor" stroke-width="${weight}" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

/** Icon key per readiness driver and per Overview metric. */
export const DRIVER_ICON = {
  energy_kwh: "energy",
  kg_co2e: "carbon",
  water_liters: "water",
  cdd: "cooling",
  uhi: "heat",
};
