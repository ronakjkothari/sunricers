/* Host-city identity: photos, blur-up placeholders, and the readiness ramp.
   Shared by Overview and Compare so a city looks the same wherever it is named. */

import { c } from "./palette.js";

/* Plan D's host_city labels do not all reduce to their file stem. */
const IMG_SLUG = {
  "New York/New Jersey": "new-york",
  "San Francisco Bay Area": "san-francisco",
  "Kansas City": "kansas-city",
  "Los Angeles": "los-angeles",
};

export const imgSlug = city => IMG_SLUG[city] || city.toLowerCase().replace(/[^a-z]+/g, "-");

/** @param {number} size one of the widths build_city_images.py emits: 1200 or 320 */
export const photo = (city, size) => `assets/img/${imgSlug(city)}-${size}.webp`;

/** Readiness ramp: hot at low scores, cool at high. Not a good/bad red-green. */
export const scoreColour = s =>
  (s < 33 ? c("--c-energy") : s < 66 ? c("--c-cooling") : c("--c-water"));

/* --- blur-up placeholders, fetched once and shared ----------------------- */

let lqip = {};
let pending = null;

export function loadBlurs() {
  if (pending) return pending;
  pending = fetch("assets/img/lqip.json")
    .then(r => (r.ok ? r.json() : {}))
    .then(d => (lqip = d))
    .catch(() => ({}));      // the blur-up is a nicety, not a requirement
  return pending;
}

export const blur = city => lqip[city] || "";
