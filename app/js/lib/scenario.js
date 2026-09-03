/* Scenario maths for the impact map.

   Every play in Plan D's catalogue is written spatially in its title — "hotel
   linen", "commercial kitchen", "high-UHI hospitality corridors" — and then
   applied to a whole city anyway. This module supplies the missing half: the
   spatial scope each play acts on, so a lever hits the 515 lodging shops rather
   than all 20,569.

   The percentages are NOT defined here. They come from the contract, so the UI
   can never drift from the engine. Only the scope lives here, because the scope
   is a reading of the play's intent that the data does not encode.

   Everything below compiles to MapLibre expressions rather than to recomputed
   GeoJSON: changing month, metric or lever is then a single setPaintProperty,
   with no per-tick allocation. */

/** kWh / litres / kg CO₂e per customer, by shop layer. From intensity_factors.csv. */
export const FACTORS = {
  Food: { e: 2.8, w: 25, co2: 3.5 },
  Energy: { e: 45, w: 1.5, co2: 12 },
  Water: { e: 28, w: 300, co2: 2 },
  Venue: { e: 4, w: 15, co2: 2.5 },
  Other_EFW: { e: 3, w: 12, co2: 1.8 },
};
const LAYERS = ["Food", "Energy", "Water", "Venue", "Other_EFW"];

export const METRICS = {
  c: { label: "Customers", unit: "customers", icon: "visits", token: "--c-visits" },
  e: { label: "Energy", unit: "kWh", icon: "energy", token: "--c-energy" },
  w: { label: "Water", unit: "L", icon: "water", token: "--c-water" },
  co2: { label: "CO₂e", unit: "kg CO₂e", icon: "carbon", token: "--c-carbon" },
};

/**
 * Where each play actually bites. `layers` filters on shop type; `minHeat`
 * means the lever is gated on the urban-heat slider; `ring` limits it to shops
 * within N km of the stadium.
 */
export const SCOPE = {
  plant_forward_concessions: {
    layers: ["Food", "Venue"],
    note: "food service and venues",
  },
  hotel_water_reuse: {
    layers: ["Water"],
    note: "lodging",
  },
  kitchen_water_efficiency: {
    layers: ["Food"],
    note: "food service",
  },
  cool_roofs_shade_uhi: {
    layers: ["Food", "Venue", "Water"],
    minHeat: true,
    note: "hospitality above the heat threshold",
  },
  peak_cooling_setpoints: {
    ring: 5,
    note: "within 5 km of the stadium",
  },
  gasoline_visit_shift: {
    layers: ["Energy"],
    ring: 5,
    note: "fuel retail within 5 km of the stadium",
  },
};

/**
 * Merge the contract's play catalogue with the scopes above.
 * @returns {{id,title,note,scope,effect:{e:number,w:number,co2:number}}[]}
 */
export function buildLevers(contract) {
  const seen = new Map();
  for (const k of contract.scorecards) {
    for (const p of [...(k.recommended_plays || []), ...(k.general_options || [])]) {
      if (seen.has(p.id) || !SCOPE[p.id]) continue;
      const e = p.expected_effects || {};
      seen.set(p.id, {
        id: p.id,
        title: p.title,
        owner: p.owner,
        scope: SCOPE[p.id],
        note: SCOPE[p.id].note,
        // contract percentages -> multipliers; customers are never changed by a
        // retrofit, only the intensity of what those customers consume
        effect: {
          c: 0,
          e: (e.energy_pct || 0) / 100,
          w: (e.water_pct || 0) / 100,
          co2: (e.food_co2e_pct || 0) / 100,
        },
      });
    }
  }
  return [...seen.values()];
}

/* --------------------------------------------------------- expressions -- */

/** Per-customer intensity for a metric, as a match over the layer property. */
function intensity(metric) {
  if (metric === "c") return 1;
  const pairs = [];
  for (const l of LAYERS) pairs.push(l, FACTORS[l][metric]);
  return ["match", ["get", "l"], ...pairs, FACTORS.Other_EFW[metric]];
}

/** The raw value of one shop for `metric` in month `i`, before any lever. */
export function baseValue(metric, i) {
  const m = ["coalesce", ["get", "m" + i], 0];
  return metric === "c" ? m : ["*", m, intensity(metric)];
}

/* ------------------------------------------------- the surge response --
   A surge does not land evenly. build_surge_model.py fits, per shop type and
   per distance band, how each segment has actually moved when a host city got
   busier: lodging and venues amplify, fuel retail lags, and shops near the
   stadium respond harder still. A surge of S multiplies a shop by S^beta
   rather than by S. */

let MODEL = null;
export function setSurgeModel(m) { MODEL = m; }
export function surgeModel() { return MODEL; }

/** Elasticity for one shop, in plain JS. */
export function shopBeta(shop) {
  if (!MODEL) return 1;
  const layer = (MODEL.layers || {})[shop.l];
  let b = layer ? layer.elasticity : 1;
  const near = MODEL.near_stadium;
  if (near && (shop.d ?? Infinity) <= near.within_km) b += near.extra;
  return b;
}

/** The same elasticity as an expression, so the map can paint it. */
function betaExpr() {
  if (!MODEL) return 1;
  const pairs = [];
  for (const l of LAYERS) {
    const hit = (MODEL.layers || {})[l];
    pairs.push(l, hit ? hit.elasticity : 1);
  }
  const layerPart = ["match", ["get", "l"], ...pairs, 1];
  const near = MODEL.near_stadium;
  if (!near || !near.extra) return layerPart;
  return ["+", layerPart,
    ["case", ["<=", ["coalesce", ["get", "d"], 1e9], near.within_km], near.extra, 0]];
}

/** Does this shop fall inside a lever's scope? */
function inScope(scope, heatMin) {
  const tests = [];
  if (scope.layers) tests.push(["in", ["get", "l"], ["literal", scope.layers]]);
  if (scope.minHeat) tests.push([">=", ["coalesce", ["get", "u"], 0], heatMin]);
  if (scope.ring) tests.push(["<=", ["coalesce", ["get", "d"], 1e9], scope.ring]);
  if (!tests.length) return true;
  return tests.length === 1 ? tests[0] : ["all", ...tests];
}

/**
 * Combined multiplier for a metric under the active levers. Levers compound
 * rather than override, so two water plays on the same shop both apply.
 * @param {object[]} levers  active levers
 * @param {string} metric
 * @param {number} heatMin   the urban-heat threshold the user chose
 * @param {number} surge     visitor multiplier, applied to every shop
 */
export function multiplier(levers, metric, heatMin, surge = 1) {
  const parts = [];
  // a visitor surge scales demand itself, so it moves every metric — but by
  // the segment's measured elasticity, not uniformly
  if (surge !== 1) parts.push(["^", surge, betaExpr()]);
  for (const lv of levers) {
    const eff = lv.effect[metric] || 0;
    if (!eff) continue;
    parts.push(["case", inScope(lv.scope, heatMin), 1 + eff, 1]);
  }
  if (!parts.length) return 1;
  return parts.length === 1 ? parts[0] : ["*", ...parts];
}

/** Value after the scenario is applied. */
export function scenarioValue(metric, i, levers, heatMin, surge) {
  const mult = multiplier(levers, metric, heatMin, surge);
  const base = baseValue(metric, i);
  return mult === 1 ? base : ["*", base, mult];
}

/** Signed change the scenario makes: negative means avoided. */
export function deltaValue(metric, i, levers, heatMin, surge) {
  const mult = multiplier(levers, metric, heatMin, surge);
  if (mult === 1) return 0;
  return ["*", baseValue(metric, i), ["-", mult, 1]];
}

/* ------------------------------------------------------------ totals ---- */

/**
 * The same maths in plain JS, for the stat pills and the day chart. Kept beside
 * the expressions deliberately: if the two ever disagree the map is lying, and
 * test_shell.js checks one against the other.
 */
export function shopMultiplier(shop, levers, metric, heatMin, surge = 1) {
  let mult = surge === 1 ? 1 : Math.pow(surge, shopBeta(shop));
  for (const lv of levers) {
    const eff = lv.effect[metric] || 0;
    if (!eff) continue;
    const s = lv.scope;
    if (s.layers && !s.layers.includes(shop.l)) continue;
    if (s.minHeat && !((shop.u || 0) >= heatMin)) continue;
    if (s.ring && !((shop.d ?? Infinity) <= s.ring)) continue;
    mult *= 1 + eff;
  }
  return mult;
}

/** @returns {{base:number, scenario:number}} totals across `shops` for one month. */
export function totals(shops, monthly, i, metric, levers, heatMin, surge) {
  let base = 0, scen = 0;
  for (let n = 0; n < shops.length; n++) {
    const s = shops[n];
    const cust = monthly[n] ? (monthly[n][i] || 0) : 0;
    if (!cust) continue;
    const v = metric === "c" ? cust : cust * (FACTORS[s.l] || FACTORS.Other_EFW)[metric];
    base += v;
    scen += v * shopMultiplier(s, levers, metric, heatMin, surge);
  }
  return { base, scenario: scen };
}

/** Great-circle-ish distance in km; fine at city scale. */
export function km(x1, y1, x2, y2) {
  const dy = (y1 - y2) * 111;
  const dx = (x1 - x2) * 111 * Math.cos((y1 * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}
