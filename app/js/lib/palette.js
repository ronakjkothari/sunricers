/* Cached CSS custom-property reads.
   getComputedStyle is a style-recalc every time it is called, and the old shell
   called it once per bar segment, per z-row and per table row inside render
   loops. Here it runs once per theme change and everything else reads a plain
   object. */

const KEYS = [
  "--ink", "--ink-2", "--ink-3", "--line", "--line-2",
  "--surface", "--surface-2", "--surface-3", "--accent",
  "--c-energy", "--c-water", "--c-carbon", "--c-visits",
  "--c-cooling", "--c-heat", "--c-venue", "--c-other",
  "--v-up", "--v-down",
];

let cache = null;

export function palette() {
  if (cache) return cache;
  const cs = getComputedStyle(document.documentElement);
  cache = {};
  for (const k of KEYS) cache[k] = cs.getPropertyValue(k).trim();
  return cache;
}

export const c = k => palette()[k] || "";

export function invalidate() { cache = null; }

/** Set the theme, drop the cache, remember the choice. */
export function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  invalidate();
  try { localStorage.setItem("pulse-theme", theme); } catch (_) { /* private mode */ }
}

export function initialTheme() {
  try {
    const saved = localStorage.getItem("pulse-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch (_) { /* private mode */ }
  try {
    if (matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch (_) { /* older browser */ }
  return "light";
}

/** Colour per Overview metric / per readiness driver. */
export const METRIC_COLOR = {
  e: "--c-energy", w: "--c-water", co2: "--c-carbon", v: "--c-visits",
};
export const DRIVER_COLOR = {
  energy_kwh: "--c-energy", kg_co2e: "--c-carbon", water_liters: "--c-water",
  cdd: "--c-cooling", uhi: "--c-heat",
};
/** Visit-mix layers. "Lodging" is the spend-side name for the water layer. */
export const LAYER_COLOR = {
  Food: "--c-carbon", Energy: "--c-energy", Water: "--c-water",
  Lodging: "--c-water", Venue: "--c-venue", Other_EFW: "--c-other",
};
