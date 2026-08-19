/**
 * Regression test for the Plan A shell (app/index.html).
 *
 *   node scripts/test_shell.js        # from the repo root
 *
 * There is no browser here. Instead the page's inline script is run against a
 * minimal DOM stub and the real app/data JSON, which catches the failures that
 * actually bite: a contract field that moved, a render path that throws on one
 * city, an empty state that renders as a hole, a deep link that will not restore.
 *
 * What it cannot check is pixels — layout, the MapLibre resize inside the
 * iframe, and dark mode still need a human with a browser. See app/README.md.
 *
 * Stdlib only. Exits non-zero on the first category that fails.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "app");

// --- minimal DOM ------------------------------------------------------------
// Every innerHTML write is recorded so assertions can inspect what was drawn.
const writes = [];
const nodes = new Map();

function makeNode(id) {
  const node = {
    id, hidden: false, value: "", textContent: "", dataset: {}, style: {},
    _html: "",
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, force) {
        if (force === undefined) this._s.has(c) ? this._s.delete(c) : this._s.add(c);
        else force ? this._s.add(c) : this._s.delete(c);
      },
    },
    querySelectorAll() { return []; },
    querySelector() { return node_(id + " > child"); },
    setAttribute() {}, getAttribute() { return null; }, appendChild() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 264 }; },
    clientWidth: 1000, clientHeight: 264,
  };
  Object.defineProperty(node, "innerHTML", {
    get() { return this._html; },
    set(v) { this._html = String(v); writes.push([id, this._html]); },
  });
  Object.defineProperty(node, "parentElement", { get: () => node_(id + " > parent") });
  return node;
}
const node_ = id => {
  if (!nodes.has(id)) nodes.set(id, makeNode(id));
  return nodes.get(id);
};

global.document = {
  getElementById: node_,
  querySelectorAll: () => [],
  documentElement: { setAttribute() {}, getAttribute() { return "light"; } },
  body: { classList: node_("body").classList },
};
global.getComputedStyle = () => ({ getPropertyValue: () => "#123456" });
global.location = { hash: "", search: "" };
global.history = { replaceState(_s, _t, h) { global.location.hash = h; } };
global.addEventListener = () => {};
global.fetch = url => Promise.resolve({
  ok: true,
  json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(APP, url), "utf8"))),
});

// --- load the page's script into the real global scope ----------------------
// runInThisContext, not eval: the page's top-level `const`s (state, C, BY, ...)
// must land in the global lexical scope for the assertions below to reach them.
const html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
const inline = /<script>([\s\S]*?)<\/script>/.exec(html);
if (!inline) fail("app/index.html has no inline <script> block");
vm.runInThisContext(inline[1], { filename: "app/index.html" });

// --- assertions -------------------------------------------------------------
const results = [];
let failed = 0;
function check(ok, label) {
  results.push(`${ok ? "  ok  " : "  FAIL"} ${label}`);
  if (!ok) failed++;
  return ok;
}
function section(name) { results.push(`\n${name}`); }
function fail(msg) { console.error("test_shell: " + msg); process.exit(2); }
const lastWrite = id => { const hit = writes.filter(([k]) => k === id).pop(); return hit ? hit[1] : null; };
function drew(id, ...needles) {
  const got = lastWrite(id);
  if (got === null) return check(false, `#${id} never rendered`);
  const missing = needles.filter(n => !got.includes(n));
  return check(missing.length === 0,
    `#${id} rendered${missing.length ? ` — missing ${JSON.stringify(missing)}` : ` (${got.length} chars)`}`);
}

setTimeout(run, 400);   // let the page's fetch/Promise.all settle

function run() {
  if (typeof C === "undefined" || !C) fail("the shell never finished booting — check app/data/*.json");
  const cities = C.scorecards.map(c => c.host_city);

  section("Contract shape (what the shell reads must exist)");
  check(C.scorecards.length === 11, `11 scorecards (got ${C.scorecards.length})`);
  const missing = [];
  const need = (obj, keys, where) =>
    keys.forEach(k => { if (obj == null || obj[k] === undefined) missing.push(`${where}.${k}`); });
  need(C.meta, ["engine_version", "generated_at", "disclaimer", "formula", "indicator_source"], "meta");
  need(C.meta.formula, ["stress", "readiness", "window", "uncertainty_pct"], "meta.formula");
  C.scorecards.forEach(c => {
    const w = `scorecards[${c.host_city}]`;
    need(c, ["rank", "readiness_score", "readiness_band", "drivers", "raw_indicators",
             "ops_scale", "peer_cities", "recommended_plays", "general_options"], w);
    need(c.raw_indicators, ["energy_kwh", "water_liters", "kg_co2e", "cdd", "uhi", "shops", "shop_months"], `${w}.raw_indicators`);
    need(c.ops_scale.absolute, ["energy_kwh", "water_liters", "kg_co2e", "visits"], `${w}.ops_scale.absolute`);
    need(c.ops_scale, ["visit_mix", "spend", "poi_structure", "climate", "top_brands_by_visits"], `${w}.ops_scale`);
    if (c.drivers.length !== 5) missing.push(`${w}.drivers has ${c.drivers.length}, expected 5`);
    [...c.recommended_plays, ...c.general_options].forEach(p =>
      need(p, ["id", "title", "owner", "effort", "legacy_use", "expected_effects",
               "illustrative_absolute_delta", "rationale", "steal_from_peers"], `${w}.play[${p.id}]`));
  });
  check(missing.length === 0, missing.length ? `missing fields:\n       ${missing.join("\n       ")}` : "every field the shell reads is present");

  section("Overview series");
  check(S.months.length > 0, `${S.months.length} months (${S.months[0]}..${S.months[S.months.length - 1]})`);
  const seriesBad = [];
  cities.forEach(c => {
    if (!S.cities[c]) return seriesBad.push(`${c}: no series`);
    ["e", "w", "co2", "v", "cdd"].forEach(k => {
      const a = S.cities[c][k];
      if (!Array.isArray(a) || a.length !== S.months.length) seriesBad.push(`${c}.${k}`);
    });
  });
  check(seriesBad.length === 0, seriesBad.length ? `bad series: ${seriesBad.join(", ")}` : "all 11 hosts have 5 complete series");

  // the Overview chart and D's Compare tab must agree about the same city
  const summer = S.months.map((m, i) => (+m.slice(5, 7) === 6 || +m.slice(5, 7) === 7) ? i : -1).filter(i => i >= 0);
  let worst = 0, worstAt = "";
  cities.forEach(city => {
    const abs = BY[city].ops_scale.absolute;
    [["e", "energy_kwh"], ["w", "water_liters"], ["co2", "kg_co2e"], ["v", "visits"]].forEach(([k, f]) => {
      const mine = summer.reduce((t, i) => t + S.cities[city][k][i], 0);
      const drift = abs[f] ? Math.abs(mine - abs[f]) / abs[f] : 0;
      if (drift > worst) { worst = drift; worstAt = `${city}.${f}`; }
    });
  });
  check(worst <= 0.005, `Overview summer totals match ops_scale.absolute (worst ${(worst * 100).toFixed(4)}% at ${worstAt || "—"})`);

  section("First paint");
  drew("kpis", "Energy", "Water", "CO₂e", "Visits", "summer total", "per trading shop-month");
  drew("presschips", "chip");
  drew("chart", "polyline", "rect");
  drew("serielegend", "Cooling degree days");
  drew("struct", "Visit mix", "Busiest brands", "mixbar");
  drew("strip", "readiness", "card");
  drew("cmpleft", "Pressure drivers", "city_cards/", "per shop-month");
  drew("cmpright", "playcard", "Owner:", "Effort:");
  drew("surgetbl", "Baseline summer");
  drew("levers", "lever");
  drew("drvfilter", "All hosts");
  drew("discbody", "z(energy)", "Two grains", "Contract");

  section("Render sweep — every city × metric × surge × tab");
  const errors = [];
  for (const city of cities.concat(["__all__"])) {
    for (const metric of ["e", "w", "co2", "v"]) {
      for (const surge of [1, 1.55, 2]) {
        for (const tab of ["overview", "compare", "spatial", "scenarios"]) {
          state.city = city; state.metric = metric; state.surge = surge; state.tab = tab;
          try { renderAll(); }
          catch (e) { errors.push(`${city}/${metric}/${surge}/${tab}: ${e.message}`); }
        }
      }
    }
  }
  check(errors.length === 0, errors.length
    ? `render errors:\n       ${errors.slice(0, 8).join("\n       ")}`
    : `${(cities.length + 1) * 4 * 3 * 4} combinations rendered clean`);

  section("Empty states");
  state.surge = 1; state.tab = "compare";
  cities.forEach(city => {
    state.city = city; renderAll();
    const html = lastWrite("cmpright");
    const plays = BY[city].recommended_plays.length, gen = BY[city].general_options.length;
    const showsPlays = plays > 0 ? html.includes("playcard") : html.includes("No pressing plays");
    const showsGen = gen > 0 ? html.includes("general option") : !html.includes("general option");
    check(showsPlays && showsGen, `${city}: ${plays} plays / ${gen} general options render correctly`);
  });

  section("Spatial wiring (the pop-out and the iframe must agree with the shell)");
  for (const city of ["Miami", "New York/New Jersey", "__all__"]) {
    state.city = city; state.theme = "dark"; state.tab = "spatial"; renderAll();
    const href = nodes.get("popout").href || "";
    const title = nodes.get("spatialtitle").textContent;
    const wantCity = `city=${encodeURIComponent(city)}`;
    check(href.includes(wantCity) && href.includes("theme=dark") && title.length > 0,
      `${city}: pop-out carries city+theme (${href}), title "${title}"`);
  }
  state.theme = "light";

  section("Pressure filter");
  Object.entries(C.indexes.by_primary_driver).forEach(([driver, expected]) => {
    state.filter = driver; drawStrip();
    const n = (lastWrite("strip").match(/data-city=/g) || []).length;
    check(n === expected.length, `${driver} → ${n} hosts (contract says ${expected.length})`);
  });
  state.filter = null; drawStrip();
  check((lastWrite("strip").match(/data-city=/g) || []).length === 11, "no filter → all 11 hosts");

  section("Deep links (a demo URL must survive a reload)");
  let hashBad = [];
  for (const city of cities.concat(["__all__"])) {
    for (const tab of ["overview", "compare", "spatial", "scenarios"]) {
      state.city = city; state.tab = tab; writeHash();
      const url = global.location.hash;
      state.city = null; state.tab = null;          // simulate a cold load on that URL
      readHash();
      if (state.city !== city || state.tab !== tab) hashBad.push(`${url} → ${state.tab}/${state.city}`);
    }
  }
  check(hashBad.length === 0, hashBad.length
    ? `broken round-trips:\n       ${hashBad.join("\n       ")}`
    : `${(cities.length + 1) * 4} round-trips restore exactly`);

  global.location.hash = "#compare"; state.city = null; readHash();
  check(state.tab === "compare" && !!state.city, `#compare with no city → ${state.tab}/${state.city}`);
  global.location.hash = "#nonsense"; state.city = null; readHash();
  check(state.tab === "overview" && !!state.city, `unknown hash falls back → ${state.tab}/${state.city}`);

  console.log(results.join("\n"));
  console.log(failed
    ? `\n${failed} check(s) FAILED`
    : `\nAll checks passed. Pixels still need a browser: layout, the map's size inside the iframe, and dark mode.`);
  process.exit(failed ? 1 : 0);
}
