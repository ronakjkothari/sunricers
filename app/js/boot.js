/* Nexus Pulse shell.

   Owns state, routing and view mounting. Views are ES modules loaded on first
   activation, so the map's ~11 MB of place data and MapLibre stay off the boot
   path exactly as the old iframe achieved — without a second document, a second
   stylesheet, a second font load, or the __spatialReady polling that used to
   live in the shell.

   The shell computes no scores. Every readiness number comes out of
   a_integration.json; every monthly series comes out of overview_kpis.json.
   The intervention lab's levers come out of levers.json (optional: without it
   the Scenarios tab falls back to the plain surge slider). */

import { icon } from "./lib/icons.js";
import { setTheme as applyTheme, initialTheme, invalidate } from "./lib/palette.js";
import * as stats from "./lib/stats.js";
import { leverById, buildCustomLever } from "./lib/levers.js";

const TABS = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "compare", label: "Compare hosts", icon: "layers" },
  { id: "spatial", label: "Spatial map", icon: "map" },
  { id: "scenarios", label: "Scenarios", icon: "sliders" },
];

/** "All 11 hosts" as a city value: the map, the lab and Compare sum the eleven. */
export const ALL = "__all__";
const ALL_NAME = "All 11 hosts";
const CUSTOM_KEY = "pulse_custom_levers";

const state = {
  city: null,
  tab: "overview",
  theme: initialTheme(),
  metric: "e",
  surge: 1,
  filter: null,
  driver: null,   // focused readiness driver on the Overview
  levers: new Set(),   // ids of the levers switched on in the lab
};

const views = {};      // id -> loaded module
const mounted = {};    // id -> true once mount() has run
let ctx = null;
let LEV = null, MATCHES = [];

/* ------------------------------------------------------------------ boot */

applyTheme(state.theme);

const opt = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);

Promise.all([
  fetch("data/a_integration.json").then(r => r.json()),
  fetch("data/overview_kpis.json").then(r => r.json()),
  opt("data/levers.json"),
  opt("data/matches.json"),
])
  .then(([contract, series, lev, matches]) => start(contract, series, lev, matches))
  .catch(err => {
    console.error(err);
    document.getElementById("panes").innerHTML = `
      <section class="card panel" style="margin-top:0"><div class="body">
        <h2 style="margin-bottom:8px">Data not found</h2>
        <p class="note">Build the contract and the Overview series, then serve this folder:</p>
        <pre class="pre">python -m engines.playbook.cli --source map --sync-app
python scripts/build_overview_kpis.py
cd app &amp;&amp; python -m http.server 8000</pre>
      </div></section>`;
  });

function start(contract, series, lev, matches) {
  const S = stats.build(contract, series);
  LEV = lev; MATCHES = matches || [];
  if (LEV) mergeCustomLevers();

  ctx = {
    contract, series, stats: S, state,
    setCity, setTab, setTheme, goCompare, showOnMap,
    // "All 11 hosts" helpers: every view goes through these instead of byCity[city]
    ALL, isAll, cityName, cardOf, cardsOf, absolutes,
    // the lab
    get lev() { return LEV; },
    matches: () => MATCHES,
    matchesHere, leversChanged, customLevers, saveCustomLevers,
  };

  // default to the most-pressured host: the demo should open on the argument
  const worst = contract.scorecards.find(k => k.rank === contract.scorecards.length);
  state.city = worst ? worst.host_city : S.cities[0];

  buildRail();
  readHash();
  addEventListener("hashchange", () => { readHash(); render(); });
  render();

  // the embedded map calls these, so the two views never disagree
  window.__leversFromMap = ids => {
    if (!LEV) return;
    state.levers = new Set(ids.filter(id => leverById(LEV, id)));
    writeHash();
  };
  window.__cityFromMap = city => {
    if (city && city !== state.city && (city === ALL || S.byCity[city])) { state.city = city; render(); }
  };
}

/* ----------------------------------------------------------- selection */

const isAll = () => state.city === ALL;
const cityName = () => (isAll() ? ALL_NAME : state.city);
const cardOf = () => (isAll() ? null : ctx.stats.byCity[state.city]);
const cardsOf = () => (isAll() ? ctx.contract.scorecards : [ctx.stats.byCity[state.city]]);
/** Absolute summer totals. For "All hosts" these sum — absolutes are additive. */
function absolutes() {
  if (!isAll()) return ctx.stats.byCity[state.city].ops_scale.absolute;
  const out = { energy_kwh: 0, water_liters: 0, kg_co2e: 0, visits: 0 };
  ctx.contract.scorecards.forEach(c => { for (const k in out) out[k] += c.ops_scale.absolute[k] || 0; });
  return out;
}
const matchesHere = () => MATCHES.filter(m => isAll() || m.m === state.city);

/* --------------------------------------------------------------- routing */

/* hash is #tab/City?levers=id,id so any view in the demo is linkable.
   Split on the first "/" *before* decoding — "New York/New Jersey" is
   percent-encoded, so the raw fragment holds exactly one literal separator. */
function readHash() {
  const raw0 = location.hash.replace(/^#/, "");
  const q = raw0.indexOf("?");
  const raw = q < 0 ? raw0 : raw0.slice(0, q);
  if (q >= 0 && LEV) {
    const ids = new URLSearchParams(raw0.slice(q + 1)).get("levers") || "";
    state.levers = new Set(ids.split(",").filter(id => leverById(LEV, id)));
  }
  const cut = raw.indexOf("/");
  const tab = cut < 0 ? raw : raw.slice(0, cut);
  const city = cut < 0 ? "" : decodeURIComponent(raw.slice(cut + 1));
  if (TABS.some(t => t.id === tab)) state.tab = tab;
  if (city && (city === ALL || ctx.stats.byCity[city])) state.city = city;
}

function writeHash() {
  const ids = [...state.levers].join(",");
  const want = `#${state.tab}/${encodeURIComponent(state.city)}${ids ? `?levers=${ids}` : ""}`;
  if (location.hash !== want) history.replaceState(null, "", want);
}

function setCity(city) {
  if (city !== ALL && !ctx.stats.byCity[city]) return;
  state.city = city;
  render();
}

function setTab(tab) {
  state.tab = tab;
  render();
}

function goCompare(driverKey) {
  state.filter = driverKey || null;
  state.tab = "compare";
  render();
}

/** "Show these levers on the map": open the map tab and scroll to the map itself. */
function showOnMap() {
  state.tab = "spatial";
  render().then(() => { if (views.spatial && views.spatial.scrollToMap) views.spatial.scrollToMap(); });
}

function setTheme(theme) {
  state.theme = theme;
  applyTheme(theme);
  document.getElementById("themebtn").innerHTML = icon(theme === "light" ? "moon" : "sun", 19);
  render();
}

/* --------------------------------------------------------------- levers */

/** The lab (or the map) changed which levers are on: keep the link and the map in step.
    Hidden tabs are not redrawn here — they redraw from state when they next show. */
function leversChanged() {
  writeHash();
  if (views.spatial && views.spatial.steer) views.spatial.steer();
}

const customLevers = () => (LEV ? LEV.levers.filter(l => l.custom) : []);
function loadCustomInputs() {
  try {
    const a = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    return Array.isArray(a) ? a.map(l => l && l.inputs).filter(c => c && c.id) : [];
  } catch (_) { return []; }
}
function saveCustomLevers() {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customLevers())); } catch (_) { /* private mode */ }
}
function mergeCustomLevers() {
  LEV.levers = LEV.levers.filter(l => !l.custom).concat(loadCustomInputs().map(c => buildCustomLever(LEV, c)));
}

/* ------------------------------------------------------------------ shell */

function buildRail() {
  const rail = document.getElementById("rail");
  rail.innerHTML =
    `<div class="mark"><img src="assets/img/icon-64.png" alt="Nexus Pulse" width="64" height="64"></div>` +
    TABS.map(t => `<button data-tab="${t.id}" data-label="${t.label}"
      aria-label="${t.label}">${icon(t.icon, 19)}</button>`).join("") +
    `<div class="sp"></div>
     <button id="themebtn" data-label="Theme" aria-label="Switch light and dark theme">
       ${icon(state.theme === "light" ? "moon" : "sun", 19)}</button>`;

  rail.querySelectorAll("[data-tab]").forEach(b => {
    b.onclick = () => setTab(b.dataset.tab);
  });
  document.getElementById("themebtn").onclick =
    () => setTheme(state.theme === "light" ? "dark" : "light");

  const panes = document.getElementById("panes");
  panes.innerHTML = TABS.map(t => `<div class="pane" id="pane-${t.id}" hidden></div>`).join("");
}

/* ----------------------------------------------------------------- render */

async function render() {
  writeHash();

  document.querySelectorAll("#rail [data-tab]").forEach(b => {
    b.classList.toggle("on", b.dataset.tab === state.tab);
  });
  TABS.forEach(t => {
    document.getElementById("pane-" + t.id).hidden = t.id !== state.tab;
  });
  document.title = `${cityName()} · Nexus Pulse`;

  // only the visible view renders — hidden tabs are not redrawn
  const id = state.tab;
  const mod = await load(id);
  const el = document.getElementById("pane-" + id);
  if (!mounted[id]) { mod.mount(el, ctx); mounted[id] = true; }
  if (typeof mod.activate === "function") mod.activate(ctx);
  else mod.update(ctx);
}

function load(id) {
  if (views[id]) return Promise.resolve(views[id]);
  return import(`./views/${id}.js`).then(m => (views[id] = m));
}

/* Theme changes invalidate every colour the views baked into markup. */
addEventListener("pulse:theme", () => { invalidate(); render(); });
