/* The intervention lab's arithmetic. No DOM in here.

   Levers come from data/levers.json (built by scripts/build_levers.py from the
   sourced cards in interventions/). Each cut is [low, mid, high] = 10th / 50th /
   90th percentile, as a fraction of the per-visit factor for one shop type.
   Several levers on the same shop type compound (1-a)(1-b), never add.

   Every function takes the levers file and the scorecards it needs as
   arguments, so scripts/test_shell.js can run the same code against the real
   app/data JSON. */

export const RES = [["kwh", "Energy", "kWh"], ["water", "Water", "L"], ["co2", "CO₂e", "kg CO₂e"]];
export const RES_COLOR = { kwh: "--c-energy", water: "--c-water", co2: "--c-carbon" };
export const RES_LABEL = Object.fromEntries(RES.map(([r, l]) => [r, l]));
export const RES_UNIT = Object.fromEntries(RES.map(([r, , u]) => [r, u]));
export const BUCKETS = [
  ["before", "Before the tournament · contracts, grants, rules months ahead"],
  ["during", "During the tournament · event-week protocols, citywide"],
  ["match day", "Match day · stadium and fans, shown on the match card"],
];
export const KEY = { kwh: "energy_kwh", water: "water_liters", co2: "kg_co2e" };
export const DRIVER_RES = { energy_kwh: "kwh", water_liters: "water", kg_co2e: "co2" };
export const COST_TIERS = [
  "$0 · nothing to buy",
  "$ · small kit, pays back in months",
  "$$ · real money, pays back in years",
  "$$$ · big budget",
];
/** kg CO₂e per kg of wasted food (FAO, Food Wastage Footprint, 2013) */
export const FOOD_WASTE_CO2 = 2.5;
/** shop types a custom lever can touch: id, label, what one of them is called */
export const CSEGS = [
  ["restaurant", "Restaurants", "visit"], ["grocery", "Grocery & convenience", "visit"],
  ["hotel", "Hotels", "stay"], ["venue", "Venues", "visit"],
];

/** plain-words equivalents, same constants as the map page's KPI tiles */
export const EQUIV = {
  kwh: v => `${Math.round(v / 900).toLocaleString()} homes' electricity for a month`,
  water: v => `${Math.round(v / 9000).toLocaleString()} people's water for a month`,
  co2: v => `${Math.round(v / 4600).toLocaleString()} cars driven for a year`,
};

export const leverById = (LEV, id) => (LEV ? LEV.levers.find(l => l.id === id) : undefined) || null;
export const costTier = l => l.cost_tier || null;
export const segLabel = seg => (CSEGS.find(s => s[0] === seg) || [seg, seg])[1];
export const segWord = seg => (seg === "fans" ? "fan" : (CSEGS.find(s => s[0] === seg) || [0, 0, "visit"])[2]);

const foodSplit = (LEV, card) => (LEV.food_split || {})[card.host_city] || { restaurant: 0.73, grocery: 0.27 };

/**
 * Split the cities' summer absolutes into shop types, so a lever can cut only
 * the type it touches. Visits per layer come from D's visit_mix; the Food layer
 * is split restaurants/grocery with our card-customer shares; each type's
 * footprint is visits × its intensity factor, then rescaled so the types add up
 * exactly to D's city totals (so this table agrees with the Overview tab).
 * `cards` is one scorecard for a city, or all eleven for "All hosts".
 */
export function segmentPiles(LEV, cards) {
  const seg = {}, tot = { kwh: 0, water: 0, co2: 0 };
  cards.forEach(c => {
    const a = c.ops_scale.absolute, mix = c.ops_scale.visit_mix || {}, fs = foodSplit(LEV, c);
    const visits = {};
    for (const [s, def] of Object.entries(LEV.segments)) {
      const lv = (a.visits || 0) * (mix[def.layer] || 0);
      visits[s] = def.layer === "Food" ? lv * (fs[s] ?? 0) : lv;
    }
    for (const r of Object.keys(tot)) {
      let raw = 0;
      for (const s in visits) raw += visits[s] * LEV.segments[s].factor[r];
      const scale = raw ? (a[KEY[r]] || 0) / raw : 0;
      for (const s in visits) {
        seg[s] ||= { kwh: 0, water: 0, co2: 0 };
        seg[s][r] += visits[s] * LEV.segments[s].factor[r] * scale;
      }
      tot[r] += a[KEY[r]] || 0;
    }
  });
  return { seg, tot };
}

/** summer visits per shop type, the same split segmentPiles() uses */
export function segmentVisits(LEV, cards) {
  const v = {}; let all = 0;
  cards.forEach(c => {
    const a = c.ops_scale.absolute, mix = c.ops_scale.visit_mix || {}, fs = foodSplit(LEV, c);
    all += a.visits || 0;
    for (const [s, def] of Object.entries(LEV.segments)) {
      const lv = (a.visits || 0) * (mix[def.layer] || 0);
      v[s] = (v[s] || 0) + (def.layer === "Food" ? lv * (fs[s] ?? 0) : lv);
    }
  });
  return { v, all };
}

/** Combined fraction KEPT per shop type and resource, [low, mid, high], for the levers that are on. */
export function combinedCuts(LEV, onIds) {
  const keep = {};
  const on = [...onIds].map(id => leverById(LEV, id)).filter(l => l && !l.offmap);
  on.forEach(l => {
    for (const [s, cuts] of Object.entries(l.cuts)) {
      for (const [r, v] of Object.entries(cuts)) {
        // an overlapping lever's piece is dropped when the lever it overlaps with is also on
        const ov = l.overlap && Object.entries(l.overlap)
          .some(([oid, rs]) => rs.includes(r) && onIds.has(oid));
        if (ov) continue;
        keep[s] ||= {}; keep[s][r] ||= [1, 1, 1];
        for (let i = 0; i < 3; i++) keep[s][r][i] *= (1 - v[i]);
      }
    }
  });
  return keep;
}

/** total saving as a fraction of the pile, [low, mid, high] per resource, for a keep table */
export function totalCut(seg, tot, keep) {
  const cut = {};
  for (const [r] of RES) {
    const base = tot[r];
    if (!base) { cut[r] = [0, 0, 0]; continue; }
    cut[r] = [0, 1, 2].map(i => {
      let s = 0;
      for (const sg in seg) s += seg[sg][r] * (1 - ((keep[sg] && keep[sg][r]) ? keep[sg][r][i] : 1));
      return s / base;
    });
  }
  return cut;
}

/** one lever alone, middle value: fraction of each resource's pile it cuts */
export function aloneCut(l, seg, tot) {
  const out = {};
  if (!l || l.offmap) return out;
  for (const [r] of RES) {
    const base = tot[r]; if (!base) continue;
    let s = 0;
    for (const [sg, cuts] of Object.entries(l.cuts)) if (cuts[r] && seg[sg]) s += seg[sg][r] * cuts[r][1];
    if (s > 1e-6) out[r] = s / base;
  }
  return out;
}

const zWord = z => (z == null ? "" : Math.abs(z) < 0.25 ? "about average" : z > 0.75 ? "well above the other hosts"
  : z > 0 ? "above the other hosts" : z < -0.75 ? "well below the other hosts" : "below the other hosts");

/**
 * The one ranking both the lab table and the Compare tab's plays read.
 * Ranks the levers on the three things the data can carry: the cut on each
 * resource kept separate (a city can be fine on energy and terrible on water,
 * so there is no blended number), the reach (share of the city's summer visits
 * at the shops the lever touches) and the cost tier from the card. The city's
 * problem is Plan D's driver z-scores versus the other hosts. Acceptance and
 * legacy are not scored here on purpose: they are judgement, not data.
 *
 * `card` is the selected city's scorecard, or null for "All hosts";
 * `matches` are that city's 2026 fixtures (all of them for "All hosts").
 */
export function rankLevers(LEV, cards, card, matches) {
  const { seg, tot } = segmentPiles(LEV, cards);
  const { v: sv, all: allV } = segmentVisits(LEV, cards);
  const ms = matches || [];
  const seats = ms.reduce((s, m) => s + (m.a || m.cap || 0), 0);
  const z = {};
  if (card) card.drivers.forEach(d => { if (DRIVER_RES[d.key]) z[DRIVER_RES[d.key]] = d.z; });
  const top = card ? RES.map(([r]) => r).sort((a, b) => (z[b] ?? -9) - (z[a] ?? -9))[0] : null;
  const worst = top && z[top] >= 0.25 ? top : null;   // nothing stands out below a quarter of a standard deviation
  const heat = card ? card.drivers.filter(d => (d.key === "cdd" || d.key === "uhi") && d.z > 0.25) : [];
  const rows = LEV.levers.map(l => {
    const cut = {}; let reach = 0;
    if (l.offmap) {
      for (const [r] of RES) { const pf = l.offmap.per_fan[r]; cut[r] = pf && tot[r] ? pf[1] * seats / tot[r] : 0; }
    } else {
      const a = aloneCut(l, seg, tot);
      for (const [r] of RES) cut[r] = a[r] || 0;
      for (const sg of Object.keys(l.cuts)) reach += (sv[sg] || 0);
      reach = allV ? reach / allV : 0;
    }
    return { l, cut, reach, best: Math.max(...RES.map(([r]) => cut[r])) };
  });
  rows.sort((a, b) => (worst ? (b.cut[worst] - a.cut[worst]) : 0) || (b.best - a.best));
  const pressing = worst ? rows.filter(x => x.cut[worst] > 1e-6) : rows.filter(x => x.best > 1e-6);
  return { card, rows, pressing, worst, top, z, heat, ms, seats, seg, tot, zWord };
}

/**
 * The organiser's own lever: typed savings per visit (kWh, litres, kg CO₂e; food
 * waste already converted) for each shop type it touches, or per fan for a
 * stadium idea. Dividing by the per-visit factor in intensity_factors.csv turns
 * it into the same [low, mid, high] fraction the studied levers use, so
 * compounding, bars, the map's rings and the match card are all shared.
 */
export function buildCustomLever(LEV, c) {
  const l = {
    id: c.id, title: c.title, bucket: c.fans ? "match day" : (c.bucket || "before"),
    plain: c.plain || "", owner: c.owner || "",
    touches: c.fans ? [] : (c.segs || []).slice(), evidence: "your estimate",
    evidence_plain: "Your own per-visit estimate typed into the lab, not a study.",
    dials: [], custom: true, inputs: c,
    cost_tier: { n: c.cost ?? 1, t: COST_TIERS[c.cost ?? 1] },
  };
  if (c.fans) {
    const pf = c.pf || {}, per = {};
    if (pf.kwh) per.kwh = pf.kwh;
    if (pf.water) per.water = pf.water;
    if (pf.co2) per.co2 = pf.co2;   // already in kg CO₂e (food waste was converted when typed)
    l.offmap = {
      per_fan: per,
      unit_note: "per attending fan, your estimate" +
        (pf.co2unit === "food" ? `; food waste counted at ${FOOD_WASTE_CO2} kg CO₂e per kg` : ""),
    };
  } else {
    l.cuts = {};
    for (const seg of (c.segs || [])) {
      const s = LEV.segments[seg]; if (!s) continue;
      const f = s.factor, pv = (c.pv || {})[seg] || {}, cuts = {};
      for (const r of ["kwh", "water", "co2"]) if (pv[r]) cuts[r] = pv[r].map(x => Math.min(1, x / f[r]));
      if (Object.keys(cuts).length) l.cuts[seg] = cuts;
    }
  }
  return l;
}

/** the id a freshly typed custom lever gets */
export const customId = title =>
  "custom_" + title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) +
  "_" + Date.now().toString(36);
