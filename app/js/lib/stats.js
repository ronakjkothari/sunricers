/* Peer statistics, computed once at boot.

   This is what gives every number on the Overview a connotation. A magnitude
   like "24.7B kWh" cannot be interpreted by anyone; "2nd highest of 11" can.
   Nothing here is new data — it is the eleven host cities compared against
   each other, which the contract already contains and the old shell never used. */

import { isSummer, ordinal } from "./format.js";

export const METRIC_ABS = { e: "energy_kwh", w: "water_liters", co2: "kg_co2e", v: "visits" };

/** Token names used inside meta.formula.stress -> driver keys. */
const FORMULA_TOKENS = {
  energy: "energy_kwh", co2e: "kg_co2e", water: "water_liters", cdd: "cdd", uhi: "uhi",
};

export function median(xs) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(xs, q) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}

/**
 * Stress weights. Prefer the structured field; fall back to parsing the
 * human-readable formula string, which is all the shipped contract carries.
 */
export function weightsOf(contract) {
  const f = (contract.meta && contract.meta.formula) || {};
  if (f.weights && typeof f.weights === "object") return { ...f.weights };
  const out = {};
  const re = /([\d.]+)\s*\*\s*z\(\s*([a-z0-9_]+)\s*\)/gi;
  let m;
  while ((m = re.exec(f.stress || "")) !== null) {
    const key = FORMULA_TOKENS[m[2].toLowerCase()];
    if (key) out[key] = parseFloat(m[1]);
  }
  return out;
}

/**
 * Everything the Overview needs to place one city against the other ten.
 * Runs in a few milliseconds for 11 cities x 60 months.
 */
export function build(contract, series) {
  const cards = contract.scorecards;
  const cities = cards.map(c => c.host_city).sort();
  const byCity = Object.fromEntries(cards.map(c => [c.host_city, c]));
  const weights = weightsOf(contract);
  const n = cards.length;

  /* --- rank per metric on the summer absolute (1 = highest footprint) --- */
  const rankOf = {};
  for (const [mk, abs] of Object.entries(METRIC_ABS)) {
    const ordered = [...cards]
      .map(c => ({ city: c.host_city, v: c.ops_scale.absolute[abs] || 0 }))
      .sort((a, b) => b.v - a.v);
    rankOf[mk] = Object.fromEntries(ordered.map((o, i) => [o.city, i + 1]));
  }

  /* --- rank per resource on the per-shop-month rate (1 = highest rate) ---
     The absolutes above mostly measure city size and give nearly the same
     answer on every metric. Readiness is scored on these rates instead, so
     this is the rank that actually explains where a host sits. */
  const RATE_KEY = { e: "energy_kwh", w: "water_liters", co2: "kg_co2e" };
  const rateRankOf = {};
  for (const [mk, key] of Object.entries(RATE_KEY)) {
    const ordered = [...cards]
      .map(k => ({ city: k.host_city, v: (k.raw_indicators || {})[key] || 0 }))
      .sort((a, b) => b.v - a.v);
    rateRankOf[mk] = Object.fromEntries(ordered.map((o, i) => [o.city, i + 1]));
  }

  /* --- stress -> readiness is a linear rescale, so contributions can be
     expressed in readiness points rather than in abstract z-units.

         readiness = (maxStress - stress) / span * 100

     A host sitting exactly at the 11-host mean on every driver has stress 0
     and therefore scores `neutral`. Each driver then moves it from there by
     `points(contribution)`, and those land exactly on its readiness score —
     which is what makes the waterfall readable as "why this number". */
  const stresses = cards.map(k => k.stress_index);
  const maxStress = Math.max(...stresses), minStress = Math.min(...stresses);
  const span = (maxStress - minStress) || 1;
  const neutral = (maxStress / span) * 100;

  /* --- driver raw values across hosts: median, min, max --- */
  const driverStats = {};
  for (const d of cards[0].drivers) {
    const raws = cards.map(c => {
      const hit = c.drivers.find(x => x.key === d.key);
      return hit ? hit.raw : NaN;
    }).filter(isFinite);
    driverStats[d.key] = { median: median(raws), min: Math.min(...raws), max: Math.max(...raws) };
  }

  /* --- per month, per metric: the 11-host median and interquartile band --- */
  const months = series.months;
  const summerIdx = months.map((m, i) => (isSummer(m) ? i : -1)).filter(i => i >= 0);
  const band = {};
  for (const mk of Object.keys(METRIC_ABS)) {
    const med = new Array(months.length);
    const lo = new Array(months.length);
    const hi = new Array(months.length);
    for (let i = 0; i < months.length; i++) {
      const col = cities.map(c => (series.cities[c][mk] || [])[i]).filter(isFinite);
      med[i] = median(col);
      lo[i] = quantile(col, 0.25);
      hi[i] = quantile(col, 0.75);
    }
    band[mk] = { med, lo, hi };
  }

  return {
    cities, byCity, weights, n, rankOf, rateRankOf, driverStats, band, months, summerIdx,
    neutralReadiness: neutral,

    /** A stress contribution, in readiness points. Negative = costs points. */
    points(stressValue) { return -(stressValue / span) * 100; },

    /**
     * How far a driver's raw value sits from the 11-host median, as a percentage.
     * Kept to one decimal below 10% — Dallas sits exactly on the urban-heat
     * median, and rounding that to a bare "0%" beside an elevated flag reads
     * as a contradiction rather than as the tie it is.
     */
    driverPct(key, raw) {
      const s = driverStats[key];
      if (!s || !isFinite(s.median) || s.median === 0) return 0;
      return (raw - s.median) / s.median * 100;
    },

    /**
     * Each driver's weighted contribution to the stress index.
     * These sum to stress_index, so the waterfall built from them *is* the
     * formula rather than a picture of it. test_shell.js asserts the identity.
     */
    contributions(card) {
      return card.drivers.map(d => ({
        key: d.key,
        label: d.label,
        z: d.z,
        raw: d.raw,
        weight: weights[d.key] || 0,
        value: (weights[d.key] || 0) * d.z,
        elevated: d.elevated,
      }));
    },
  };
}

/* ------------------------------------------------------------------------ */
/* The verdict sentence. One line, plain language, generated from the card so
   it can never drift from the numbers underneath it. */

const PLAIN = {
  energy_kwh: "energy use",
  kg_co2e: "food carbon",
  water_liters: "water use",
  cdd: "cooling demand",
  uhi: "urban heat",
};

export function verdict(card, total) {
  const hot = card.drivers
    .filter(d => d.elevated)
    .sort((a, b) => b.z - a.z)
    .slice(0, 2)
    .map(d => PLAIN[d.key] || d.label.toLowerCase());

  let standing;
  if (card.rank === total) standing = "carries the <b>most summer pressure</b> of the 11 hosts";
  else if (card.rank === 1) standing = "carries the <b>least summer pressure</b> of the 11 hosts";
  else if (card.rank > total / 2) standing = `sits in the <b>more pressured half</b> of the 11 hosts`;
  else standing = `sits in the <b>less pressured half</b> of the 11 hosts`;

  if (!hot.length) {
    return `${card.host_city} ${standing}. No single driver sits above the host average.`;
  }
  const driven = hot.length === 1 ? hot[0] : `${hot[0]} and ${hot[1]}`;

  // "carries the least pressure, driven by cooling demand" reads backwards.
  // For a low-pressure host the elevated driver is the exception, not the cause.
  if (card.rank <= total / 2) {
    return `${card.host_city} ${standing}. Only <b>${driven}</b> ` +
      `${hot.length === 1 ? "sits" : "sit"} above the host average.`;
  }
  return `${card.host_city} ${standing}, driven by <b>${driven}</b>.`;
}

/**
 * Render a distance-from-median percentage. Shared by Overview and Compare so
 * the two cannot drift: driverPct returns a raw float, and every caller needs
 * the same rounding, the same minus glyph, and the same "at median" tie case.
 */
export function pctLabel(pct) {
  if (Math.abs(pct) < 0.05) return "at median";
  const digits = Math.abs(pct) < 10 ? 1 : 0;
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(digits)}%`;
}

/**
 * Name a rank from whichever end of the scale it is closer to.
 *
 * "10th highest rate of 11" is technically right and reads as a criticism of a
 * city that is in fact doing well; "2nd lowest" says the same thing the way a
 * person would. Returns the phrase without the "of n" tail so callers can put
 * it in a sentence or in a chip.
 */
export function polarRank(rank, n, high = "highest", low = "lowest") {
  if (rank <= 1) return high;
  if (rank >= n) return low;
  return rank <= Math.ceil(n / 2)
    ? `${ordinal(rank)} ${high}`
    : `${ordinal(n - rank + 1)} ${low}`;
}

/** Short label for the rank chip. */
export function rankLabel(card, total) {
  if (card.rank === total) return "most pressure";
  if (card.rank === 1) return "least pressure";
  return "mid-pack";
}
