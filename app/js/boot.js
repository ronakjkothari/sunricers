/* Nexus Pulse shell.

   Owns state, routing and view mounting. Views are ES modules loaded on first
   activation, so the map's ~11 MB of place data and MapLibre stay off the boot
   path exactly as the old iframe achieved — without a second document, a second
   stylesheet, a second font load, or the __spatialReady polling that used to
   live in the shell.

   The shell computes no scores. Every readiness number comes out of
   a_integration.json; every monthly series comes out of overview_kpis.json. */

import { icon } from "./lib/icons.js";
import { setTheme as applyTheme, initialTheme, invalidate } from "./lib/palette.js";
import * as stats from "./lib/stats.js";

const TABS = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "compare", label: "Compare hosts", icon: "layers" },
  { id: "spatial", label: "Impact map", icon: "map" },
];

const state = {
  city: null,
  tab: "overview",
  theme: initialTheme(),
  metric: "e",
  filter: null,
  driver: null,          // focused readiness driver on the Overview
  partners: [],          // hosts compared against state.city on Compare
  compareScroll: null,   // one-shot landing target for Compare
};

const views = {};      // id -> loaded module
const mounted = {};    // id -> true once mount() has run
let ctx = null;

/* ------------------------------------------------------------------ boot */

applyTheme(state.theme);

Promise.all([
  fetch("data/a_integration.json").then(r => r.json()),
  fetch("data/overview_kpis.json").then(r => r.json()),
])
  .then(([contract, series]) => start(contract, series))
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

function start(contract, series) {
  const S = stats.build(contract, series);

  ctx = {
    contract, series, stats: S, state,
    setCity, setTab, setTheme, goCompare,
  };

  // default to the most-pressured host: the demo should open on the argument
  const worst = contract.scorecards.find(k => k.rank === contract.scorecards.length);
  state.city = worst ? worst.host_city : S.cities[0];

  buildRail();
  readHash();
  addEventListener("hashchange", () => { readHash(); render(); });
  render();
}

/* --------------------------------------------------------------- routing */

function readHash() {
  const raw = location.hash.replace(/^#/, "");
  const cut = raw.indexOf("/");
  const tab = cut < 0 ? raw : raw.slice(0, cut);
  const city = cut < 0 ? "" : decodeURIComponent(raw.slice(cut + 1));
  if (TABS.some(t => t.id === tab)) state.tab = tab;
  if (city && ctx.stats.byCity[city]) state.city = city;
}

function writeHash() {
  const want = `#${state.tab}/${encodeURIComponent(state.city)}`;
  if (location.hash !== want) history.replaceState(null, "", want);
}

function setCity(city) {
  if (!ctx.stats.byCity[city]) return;
  state.city = city;
  render();
}

function setTab(tab) {
  state.tab = tab;
  render();
}

/**
 * @param {string|null} driverKey  pre-filter the leaderboard to hosts elevated on it
 * @param {string|null} scrollTo   section for Compare to land on ("playbook"),
 *   so "open the full playbook" does not dump you at the top of a page whose
 *   first two bands are a leaderboard and a comparison you did not ask for
 */
function goCompare(driverKey, scrollTo) {
  state.filter = driverKey || null;
  state.compareScroll = scrollTo || null;
  state.tab = "compare";
  render();
}

function setTheme(theme) {
  state.theme = theme;
  applyTheme(theme);
  document.getElementById("themebtn").innerHTML = icon(theme === "light" ? "moon" : "sun", 19);
  render();
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
  document.title = `${state.city} · Nexus Pulse`;

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
