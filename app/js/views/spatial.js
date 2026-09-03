/* Impact map — where the load sits, and what moves it.

   This is the merge of the old Spatial and Scenarios tabs. Keeping them apart
   was what made Scenarios a stub: every play in the catalogue is written
   spatially ("hotel linen", "high-UHI corridors") but had no geometry to act
   on, so it multiplied a citywide total instead. Here a lever hits the shops it
   names, and the map shows where.

   Two performance rules hold the whole thing up:

   1. Sources are built ONCE per city, carrying all 61 monthly customer counts
      as properties m0..m60. Scrubbing months is a paint-property swap, not a
      GeoJSON rebuild — the old page re-serialised up to 6,300 features every
      300 ms during playback.
   2. Metric, levers and surge compile into the same expression, so changing a
      scenario is also a paint swap. Only the district view, where one cell
      mixes shop types, is recomputed in JS — and only when the scenario
      changes, never when the month does. */

import { fmt, full, esc, pretty } from "../lib/format.js";
import { icon } from "../lib/icons.js";
import { c } from "../lib/palette.js";
import { photo, cityOption, byRank } from "../lib/city.js";
import {
  FACTORS, METRICS, buildLevers, scenarioValue, deltaValue,
  shopMultiplier, totals, km, setSurgeModel, surgeModel,
} from "../lib/scenario.js";

// vendored rather than pulled from a CDN: the demo has to work on venue wifi,
// and a 900 KB script on the critical path of one tab is worth owning
const MAPLIBRE = "vendor/maplibre-gl";
/* Carto's vector basemaps are free and keyless; their raster endpoint is not —
   it serves "API KEY REQUIRED" straight onto the tiles. If the style cannot be
   reached at all the map falls back to a plain ground and still draws every
   shop, because the data is the point and the basemap is context. */
const BASEMAP = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

/**
 * Decide the basemap up front rather than reacting to error events: a vector
 * style emits errors for any sprite or glyph it cannot fetch, and treating
 * those as "the basemap is down" threw away a perfectly good map.
 */
async function resolveStyle(theme) {
  const url = BASEMAP[theme] || BASEMAP.light;
  try {
    const ctl = new AbortController();
    const bail = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(bail);
    if (!r.ok) throw new Error(`basemap ${r.status}`);
    return await r.json();
  } catch (err) {
    console.warn("basemap unavailable, drawing on a plain ground:", err.message);
    return fallbackStyle();
  }
}

/** No network, no glyphs, no sprite — always renders. */
function fallbackStyle() {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "bg", type: "background",
               paint: { "background-color": c("--surface-3") } }],
  };
}
const LAYER_TOKEN = {
  Food: "--c-carbon", Energy: "--c-energy", Water: "--c-water",
  Venue: "--c-venue", Other_EFW: "--c-other",
};
const LAYER_LABEL = {
  Food: "Food", Energy: "Fuel & energy", Water: "Lodging & water",
  Venue: "Venues", Other_EFW: "Other",
};
const GRID = 0.01;          // district cell size in degrees, same as the heat tiles
const RINGS = [2, 5];       // km; the +30% match-day effect was measured within 2

let root = null, ctx = null;
let map = null, ready = false, loading = false;
let libs = null;            // promise for the MapLibre script

/** Per-city bundle, rebuilt only when the city changes. */
let city = null;
let styledTheme = null;   // which basemap the map is currently wearing

/** View state, local to this tab. */
const view = {
  i: 47,                    // month index; 47 = 2023-11 until data lands
  metric: "e",
  mode: "shops",            // shops | districts
  heat: false,
  diff: false,
  playing: false,
  levers: new Set(),
  heatMin: 8,
  surge: 1,
  matchId: null,
  panel: false,             // scenario drawer open
};
let levers = [];            // catalogue, built once from the contract
let timer = null;

/* ---------------------------------------------------------------- mount */

export function mount(el, context) {
  root = el;
  ctx = context;
  levers = buildLevers(ctx.contract);

  root.innerHTML = `
    <div class="mapstage bleed" id="sp-stage">
      <div class="mapcanvas" id="sp-map"></div>

      <div class="mapctl" id="sp-ctl"></div>

      <div class="mapright" id="sp-right">
        <div class="mappills" id="sp-pills"></div>
        <button class="scenbtn" id="sp-scenbtn">${icon("sliders", 16)}<span>Scenario</span>
          <em class="scount" id="sp-scount" hidden>0</em></button>
      </div>
      <aside class="scenpanel" id="sp-scen" hidden></aside>

      <div class="mapbottom">
        <div class="maprow">
          <button class="helpbtn" id="sp-helpbtn" aria-label="How to read this map"
            title="How to read this map">${icon("info", 16)}</button>
          <div class="maplegend" id="sp-legend"></div>
        </div>
        <div class="mapscrub" id="sp-scrub"></div>
      </div>

      <aside class="helppanel" id="sp-help" hidden></aside>

      <div class="maploading" id="sp-loading">Loading the map…</div>
    </div>

    <div class="secthead">
      <div class="shtxt">
        <h2 id="sp-title">Impact map</h2>
        <p id="sp-cap"></p>
      </div>
    </div>

    <div class="mapdetail">
      <section class="card panel" style="margin-top:0">
        <header><h2>Day by day</h2><span class="sp"></span>
          <span class="eyebrow" id="sp-daycap"></span></header>
        <div class="chartwrap">
          <svg id="sp-day" viewBox="0 0 1000 240" role="img"
               aria-label="Customers per day inside the selected month"></svg>
        </div>
        <div class="chartlegend" id="sp-daylegend"></div>
      </section>

      <section class="card panel" style="margin-top:0">
        <header><h2>Plays that apply here</h2></header>
        <div class="body" id="sp-plays"></div>
      </section>
    </div>`;

  root.querySelector("#sp-scenbtn").onclick = () => {
    view.panel = !view.panel;
    drawScenario();
  };
  root.querySelector("#sp-helpbtn").onclick = () => toggleHelp();
  document.addEventListener("click", ev => {
    const menu = root.querySelector("#sp-citymenu");
    if (menu && !menu.hidden && !menu.contains(ev.target) && !ev.target.closest(".mpick")) {
      menu.hidden = true;
    }
  });
}

/**
 * The guide. This tool packs a lot in — a heat index nobody has seen before, two
 * ways of aggregating the same shops, levers with spatial scopes — and none of
 * that is guessable. It is one click away and never on screen uninvited.
 */
function toggleHelp(force) {
  const el = root.querySelector("#sp-help");
  const open = force != null ? force : el.hidden;
  el.hidden = !open;
  root.querySelector("#sp-helpbtn").classList.toggle("on", open);
  if (!open) return;

  el.innerHTML = `
    <div class="scenhead">
      <h3>How to read this map</h3>
      <button class="drop" id="sp-helpclose" aria-label="Close">${icon("close", 14)}</button>
    </div>

    <dl class="helpdl">
      <dt>Every dot is one shop</dt>
      <dd>20,569 food, fuel, lodging and venue businesses across the eleven hosts,
        from five years of card-spend data. Size is the metric you picked; colour is
        the type of shop. Faded dots contribute little to that metric — switch to
        Water and the map dims to the lodging that actually drives it.</dd>

      <dt>Districts</dt>
      <dd>The same shops summed into 1.1 km squares. Use it to see where load
        concentrates rather than which business carries it.</dd>

      <dt>Heat index</dt>
      <dd>Urban heat, 1 (cool) to 11 (hot), from surface-temperature readings averaged
        into the same 1.1 km squares. It matters because cooling load rides on it: a
        hot corridor full of hotels and kitchens costs more energy to run for the same
        trade. <b>It has no dates</b>, so unlike everything else here it does not change
        as you move through time.</dd>

      <dt>The month scrubber</dt>
      <dd>61 months, Dec 2019 to Dec 2024. Press play to watch demand move. The dot
        scale is fixed across all months, so growth is real growth and not a rescale.</dd>

      <dt>Matches</dt>
      <dd>Picking one of the 78 fixtures flies to that stadium and draws the 2 km and
        5 km rings. The measured match-day effect is <b>+30%</b> within 2 km — from 566
        NFL games and 19 Copa América matches, not a forecast.</dd>

      <dt>Scenario</dt>
      <dd>A visitor surge, and the plays from the playbook. Each play acts only on the
        shops it names — "hotel linen reuse" touches lodging, not all 20,569 — and the
        pills at the top show what moves. <b>Show the change only</b> turns the map into
        a difference view: what the scenario avoids, and where.</dd>

      <dt>Two things this is not</dt>
      <dd>Not a forecast — a 2026 match is shown against the same calendar month of
        2024. And the sample data are transformed, so these demonstrate a method rather
        than ground truth for any real city.</dd>
    </dl>`;
  root.querySelector("#sp-helpclose").onclick = () => toggleHelp(false);
}

export function activate(context) {
  ctx = context;
  if (!ready && !loading) { boot(); return; }
  if (!ready) return;
  // the pane was hidden when the map was built if the user landed elsewhere
  // first; resizing on every activation is cheap and avoids a 0x0 canvas
  map.resize();
  applyTheme();
  refreshCity();
}

export function update(context) { ctx = context; }

/* ------------------------------------------------------------- loading */

function loadMapLibre() {
  if (libs) return libs;
  libs = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MAPLIBRE + ".css";
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = MAPLIBRE + ".js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("MapLibre failed to load"));
    document.head.appendChild(s);
  });
  return libs;
}

const slugOf = name => (ctx.mapIndex && ctx.mapIndex[name] && ctx.mapIndex[name].slug) || "";

/** Progress is shown, not hidden: this tab pulls ~1.5 MB and a 900 KB library. */
function say(msg) {
  const el = root && root.querySelector("#sp-loading");
  if (el) el.textContent = msg;
}

async function boot() {
  loading = true;
  try {
    say("Loading map tables…");
    const [idx, months, matches, stadiums, surge] = await Promise.all([
      fetch("data/index.json").then(r => r.json()),
      fetch("data/months.json").then(r => r.json()),
      fetch("data/matches.json").then(r => r.json()).catch(() => []),
      fetch("data/stadiums.json").then(r => r.json()).catch(() => ({})),
      fetch("data/surge_model.json").then(r => r.json()).catch(() => null),
    ]);
    setSurgeModel(surge);
    ctx.mapIndex = idx.cities;
    ctx.months = months;
    ctx.matches = matches;
    ctx.stadiums = stadiums;
    const summers = months
      .map((m, j) => (m.endsWith("-06") || m.endsWith("-07") ? j : -1))
      .filter(j => j >= 0);
    view.i = summers.length ? summers[summers.length - 1] : months.length - 1;

    say("Loading the map library…");
    await loadMapLibre();
    say(`Loading ${ctx.state.city}…`);
    await loadCity(ctx.state.city);
    say("Drawing…");
    await initMap();
  } catch (err) {
    console.error(err);
    say(`Map failed to load: ${err && err.message ? err.message : err}`);
  } finally {
    loading = false;
  }
}

/** One city's tables. Roughly 1.5 MB, down from the 11.7 MB the old page pulled. */
async function loadCity(name) {
  const slug = slugOf(name);
  const smName = name.replace(/\//g, "_");
  const [shops, heat, daily, sm] = await Promise.all([
    fetch(`data/places/${slug}.json`).then(r => r.json()),
    fetch(`data/heat/${slug}.json`).then(r => r.json()),
    fetch(`data/daily/${slug}.json`).then(r => r.json()),
    fetch(`data/sm/${encodeURIComponent(smName)}.json`).then(r => r.json()),
  ]);

  const at = new Map(sm.keys.map((k, n) => [k, n]));
  const monthly = shops.map(s => sm.v[at.get(s.k)] || []);

  const stadium = Object.entries(ctx.stadiums)
    .find(([, v]) => v.m === name)?.[1] || null;
  if (stadium) {
    for (const s of shops) s.d = km(s.x, s.y, stadium.x, stadium.y);
  }

  // Fixed scales, computed once across every month, so dots keep their meaning
  // while you scrub. The 95th percentile rather than the maximum: one gas
  // station at 45 kWh per customer is 100x a taqueria, and scaling to it
  // rendered the median shop at 0.27 px — invisible.
  const max = {};
  for (const mk of Object.keys(METRICS)) {
    const vals = [];
    for (let n = 0; n < shops.length; n++) {
      const f = mk === "c" ? 1 : (FACTORS[shops[n].l] || FACTORS.Other_EFW)[mk];
      const row = monthly[n];
      for (let j = 0; j < row.length; j++) if (row[j]) vals.push(row[j] * f);
    }
    vals.sort((a, b) => a - b);
    max[mk] = vals.length ? vals[Math.floor(vals.length * 0.95)] : 1;
  }

  city = { name, shops, monthly, heat, daily, stadium, max, cells: cellIndex(shops) };
  view.matchId = null;
}

/** Shops bucketed into 0.01° cells once, so district rebuilds are cheap. */
function cellIndex(shops) {
  const cells = new Map();
  shops.forEach((s, n) => {
    const key = `${Math.floor(s.x / GRID)}|${Math.floor(s.y / GRID)}`;
    let cell = cells.get(key);
    if (!cell) cells.set(key, (cell = { x: (Math.floor(s.x / GRID) + 0.5) * GRID,
                                        y: (Math.floor(s.y / GRID) + 0.5) * GRID, idx: [] }));
    cell.idx.push(n);
  });
  return [...cells.values()];
}

/* ------------------------------------------------------------- the map */

/** Resolve once the stage actually has a height, so MapLibre never measures 0. */
function whenSized(el) {
  if (el.clientHeight > 0) return Promise.resolve();
  return new Promise(resolve => {
    const ro = new ResizeObserver(() => {
      if (el.clientHeight > 0) { ro.disconnect(); resolve(); }
    });
    ro.observe(el);
    setTimeout(() => { ro.disconnect(); resolve(); }, 3000);   // never hang
  });
}

async function initMap() {
  const stage = root.querySelector("#sp-stage");
  // A map built into a 0-height container gets MapLibre's 400x300 fallback and
  // a fitBounds that zooms to the wrong continent. Wait for real layout first,
  // then keep watching: the stage is a vh clamp, so it moves with the window.
  await whenSized(stage);

  const first = city.shops[0] || { x: -98, y: 39 };
  const style = await resolveStyle(ctx.state.theme);
  styledTheme = ctx.state.theme;
  map = new maplibregl.Map({
    container: root.querySelector("#sp-map"),
    style,
    center: [first.x, first.y],
    zoom: 9.4,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => map.resize()).observe(stage);
  }

  // sprite and glyph misses are noisy but harmless; the basemap itself was
  // already decided by resolveStyle before the map was constructed
  map.on("error", e => console.warn("map:", (e && e.error && e.error.message) || e));

  map.on("style.load", () => {
    for (const id of ["heat", "shops", "districts", "rings", "stadium"]) {
      if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty() });
    }
    map.addLayer({ id: "heat-fill", type: "fill", source: "heat",
      paint: { "fill-color": ["get", "col"], "fill-opacity": 0.5 } });
    map.addLayer({ id: "district-fill", type: "fill", source: "districts",
      paint: { "fill-color": ["get", "col"], "fill-opacity": 0.72,
               "fill-outline-color": "rgba(0,0,0,0.12)" } });
    map.addLayer({ id: "ring-line", type: "line", source: "rings",
      paint: { "line-color": c("--ink"), "line-width": 1.6, "line-dasharray": [2, 2],
               "line-opacity": 0.7 } });
    map.addLayer({ id: "shop-dots", type: "circle", source: "shops",
      paint: { "circle-color": ["get", "col"], "circle-opacity": 0.82,
               "circle-stroke-width": 0.7, "circle-stroke-color": c("--surface") } });
    // a ring around whichever shop has its card open, so you do not lose it in
    // 20,000 dots the moment you look away
    map.addLayer({ id: "shop-sel", type: "circle", source: "shops",
      filter: ["==", ["get", "i"], -1],
      paint: { "circle-color": "rgba(0,0,0,0)",
               "circle-stroke-width": 2, "circle-stroke-color": c("--accent") } });
    map.addLayer({ id: "stadium-pt", type: "circle", source: "stadium",
      paint: { "circle-radius": 7, "circle-color": c("--accent"),
               "circle-stroke-width": 2.5, "circle-stroke-color": "#fff" } });

    if (ready) {
      // a re-style (theme swap): the layers above were just re-added, so the
      // data and paint have to go back on with them
      buildSources();
      drawAll();
      return;
    }

    map.on("click", "shop-dots", e => popup(e.features[0], e.lngLat));
    map.on("click", "district-fill", e => popup(e.features[0], e.lngLat, true));
    for (const l of ["shop-dots", "district-fill"]) {
      map.on("mouseenter", l, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; });
    }

    ready = true;
    root.querySelector("#sp-loading").hidden = true;
    map.resize();
    buildSources();
    drawAll();
  });
}

const empty = () => ({ type: "FeatureCollection", features: [] });

/** Built once per city. Month, metric and scenario are all expressions on top. */
function buildSources() {
  const feats = city.shops.map((s, n) => {
    const props = { i: n, l: s.l, u: s.u ?? 0, n: s.n, d: s.d ?? 1e9,
                    col: c(LAYER_TOKEN[s.l] || "--c-other") };
    const row = city.monthly[n];
    for (let j = 0; j < row.length; j++) if (row[j]) props["m" + j] = row[j];
    return { type: "Feature", properties: props, geometry: { type: "Point", coordinates: [s.x, s.y] } };
  });
  map.getSource("shops").setData({ type: "FeatureCollection", features: feats });

  const ramp = ["--h1", "--h2", "--h3", "--h4", "--h5", "--h6"].map(() => null);
  const heatCols = [c("--c-water"), c("--c-cooling"), c("--c-heat"), c("--c-energy")];
  map.getSource("heat").setData({
    type: "FeatureCollection",
    features: city.heat.map(h => ({
      type: "Feature",
      properties: { col: heatCols[Math.min(heatCols.length - 1,
        Math.max(0, Math.round(((h.u - 1) / 10) * (heatCols.length - 1))))] },
      geometry: square(h.x, h.y, GRID / 2),
    })),
  });

  if (city.stadium) {
    map.getSource("stadium").setData({ type: "FeatureCollection", features: [{
      type: "Feature", properties: {},
      geometry: { type: "Point", coordinates: [city.stadium.x, city.stadium.y] } }] });
  }
  flyToCity(true);
}

const square = (x, y, h) => ({ type: "Polygon", coordinates: [[
  [x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h], [x - h, y - h]]] });

function flyToCity(instant) {
  const xs = city.shops.map(s => s.x), ys = city.shops.map(s => s.y);
  const b = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
  // padding keeps the fitted bounds clear of the floating chrome, but only if
  // the canvas is big enough to give it away
  const cv = map.getCanvas();
  const w = cv.clientWidth || 800, h = cv.clientHeight || 500;
  const pad = {
    top: Math.min(90, h * 0.14),
    bottom: Math.min(130, h * 0.2),
    left: Math.min(300, w * 0.26),
    right: Math.min(90, w * 0.08),
  };
  map.fitBounds(b, { padding: pad, duration: instant ? 0 : 600, maxZoom: 13 });
}

/* --------------------------------------------------------- the repaint */

const activeLevers = () => levers.filter(l => view.levers.has(l.id));

/** The hot path. Month, metric and scenario all resolve to paint properties. */
function paint() {
  if (!ready) return;
  const act = activeLevers();
  const mk = view.metric;
  const scale = city.max[mk];

  const val = view.diff
    ? deltaValue(mk, view.i, act, view.heatMin, view.surge)
    : scenarioValue(mk, view.i, act, view.heatMin, view.surge);

  // Area-proportional: radius on sqrt so a dot twice the area means twice the
  // load. In difference mode the floor is higher — the changed shops are the
  // only ones drawn, and they still have to be clickable.
  const floor = view.diff ? 5 : 2;
  const dot = k => ["max", floor, ["min", 30,
    ["*", k, ["sqrt", ["/", ["abs", val], scale]]]]];
  const size = ["interpolate", ["linear"], ["zoom"], 8, dot(7), 13, dot(20)];
  // the zoom curve has to stay the outermost expression, so the ring's 4 px of
  // clearance is added inside each stop rather than around the whole thing
  const ringSize = ["interpolate", ["linear"], ["zoom"],
    8, ["+", dot(7), 4], 13, ["+", dot(20), 4]];

  // Size alone barely moved when the metric changed: normalising each metric by
  // its own p95 puts the median shop at ~6 px whichever one you pick. Fading
  // the small contributors is what makes "which shops drive water" legible —
  // pick Water and the map dims to the lodging that actually drives it.
  const share = ["min", 1, ["^", ["/", ["abs", val], scale], 0.45]];
  const fade = ["+", 0.14, ["*", 0.76, share]];

  map.setPaintProperty("shop-dots", "circle-radius", size);
  map.setPaintProperty("shop-dots", "circle-color",
    view.diff ? ["case", ["<", val, 0], c("--c-carbon"), c("--c-energy")] : ["get", "col"]);
  map.setPaintProperty("shop-dots", "circle-opacity",
    view.mode === "shops" ? (view.diff ? 0.92 : fade) : 0);
  map.setPaintProperty("shop-dots", "circle-stroke-opacity",
    view.mode === "shops" ? (view.diff ? 0.9 : ["*", 0.8, share]) : 0);
  // the ring sits just outside the dot, whatever the dot's current size
  map.setPaintProperty("shop-sel", "circle-radius", ringSize);
  map.setPaintProperty("shop-sel", "circle-stroke-opacity", view.mode === "shops" ? 1 : 0);
  markSelected();
  map.setLayoutProperty("heat-fill", "visibility", view.heat ? "visible" : "none");
  map.setLayoutProperty("district-fill", "visibility", view.mode === "districts" ? "visible" : "none");

  if (view.mode === "districts") paintDistricts();
  paintRings();
}

/**
 * Districts are the one thing expressions cannot do: a cell mixes shop types,
 * so a per-layer lever cannot be resolved inside the paint expression. It is
 * recomputed here — but only when the scenario or metric changes, never when
 * the month does, so playback stays allocation-free.
 */
let districtCache = null;
function rebuildDistricts() {
  const act = activeLevers();
  const mk = view.metric;
  const out = city.cells.map(cell => {
    const series = new Float32Array(ctx.months.length);
    for (const n of cell.idx) {
      const s = city.shops[n], row = city.monthly[n];
      const f = mk === "c" ? 1 : (FACTORS[s.l] || FACTORS.Other_EFW)[mk];
      const m = shopMultiplier(s, act, mk, view.heatMin, view.surge);
      const eff = view.diff ? f * (m - 1) : f * m;
      if (!eff) continue;
      for (let j = 0; j < series.length; j++) series[j] += (row[j] || 0) * eff;
    }
    return { cell, series };
  });
  let max = 0;
  for (const d of out) for (const v of d.series) max = Math.max(max, Math.abs(v));
  districtCache = { out, max: max || 1, key: districtKey() };
}
const districtKey = () =>
  `${view.metric}|${view.diff}|${view.heatMin}|${view.surge}|${[...view.levers].sort().join(",")}`;

function paintDistricts() {
  if (!districtCache || districtCache.key !== districtKey()) rebuildDistricts();
  const { out, max } = districtCache;
  const cool = c("--c-water"), hot = c("--c-energy"), save = c("--c-carbon");
  map.getSource("districts").setData({
    type: "FeatureCollection",
    features: out.map(({ cell, series }) => {
      const v = series[view.i] || 0;
      const t = Math.min(1, Math.abs(v) / max);
      return {
        type: "Feature",
        properties: { col: mix(view.diff && v < 0 ? save : cool, hot, t), v, t },
        geometry: square(cell.x, cell.y, GRID / 2),
      };
    }).filter(f => f.properties.t > 0.008),
  });
}

/** Cheap two-stop blend in sRGB; good enough for a choropleth ramp. */
function mix(a, b, t) {
  const p = s => { const m = s.trim().match(/\w\w/g); return m ? m.map(h => parseInt(h, 16)) : [0, 0, 0]; };
  const [r1, g1, b1] = p(a.replace("#", "")), [r2, g2, b2] = p(b.replace("#", ""));
  const f = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${f(r1, r2)},${f(g1, g2)},${f(b1, b2)})`;
}

function paintRings() {
  const m = ctx.matches.find(x => x.id === view.matchId);
  if (!m || !city.stadium) { map.getSource("rings").setData(empty()); return; }
  map.getSource("rings").setData({
    type: "FeatureCollection",
    features: RINGS.map(r => ({ type: "Feature", properties: { km: r },
      geometry: ring(city.stadium.x, city.stadium.y, r) })),
  });
}

function ring(x, y, kmR, n = 64) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([x + (kmR / (111 * Math.cos((y * Math.PI) / 180))) * Math.cos(a),
              y + (kmR / 111) * Math.sin(a)]);
  }
  return { type: "Polygon", coordinates: [pts] };
}

/* The open popup is live: scrubbing a month or moving a lever changes the very
   numbers it is showing, so it re-renders rather than going stale. */
let openPopup = null, openShop = -1;

/**
 * One shop's whole history for the metric on screen, baseline against scenario,
 * with the month you are on marked. A single month tells you a shop is large;
 * the series tells you whether it is seasonal, whether it is growing, and how
 * wide the play's saving actually opens over five years. It re-renders on every
 * scrub, so leaving the popup open and pressing play traces the shop through.
 */
function shopSpark(n) {
  const s = city.shops[n];
  const mk = view.metric, m = METRICS[mk];
  const f = mk === "c" ? 1 : (FACTORS[s.l] || FACTORS.Other_EFW)[mk];
  const row = city.monthly[n] || [];
  const base = ctx.months.map((_, j) => (row[j] || 0) * f);
  if (!base.some(v => v > 0)) return "";

  const mult = shopMultiplier(s, activeLevers(), mk, view.heatMin, view.surge);
  const changed = Math.abs(mult - 1) > 1e-6;
  const scen = base.map(v => v * mult);

  const W = 258, H = 44, pad = 3;
  const top = Math.max(...base, ...scen) || 1;
  const X = j => (j / Math.max(1, base.length - 1)) * W;
  const Y = v => H - pad - (v / top) * (H - pad * 2);
  const pts = a => a.map((v, j) => `${X(j).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");

  let out = "";
  if (changed) {
    out += `<polygon points="${pts(base)} ${pts(scen).split(" ").reverse().join(" ")}"
      fill="${c("--c-carbon")}" opacity="0.18"/>`;
    out += `<polyline points="${pts(base)}" fill="none" stroke="${c("--ink-3")}"
      stroke-width="1.2" stroke-dasharray="4 3"/>`;
  }
  out += `<polyline points="${pts(changed ? scen : base)}" fill="none"
    stroke="${c(m.token)}" stroke-width="1.8" stroke-linejoin="round"/>`;

  const j = view.i, cx = X(j).toFixed(1);
  out += `<line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke="${c(m.token)}"
    stroke-width="1" opacity="0.35"/>`;
  out += `<circle cx="${cx}" cy="${Y((changed ? scen : base)[j]).toFixed(1)}" r="3"
    fill="${c(m.token)}" stroke="${c("--surface")}" stroke-width="1.5"/>`;

  return `<div class="pspark">
    <div class="psparkhead"><span>${esc(m.label)} over time</span>
      <span>${esc(pretty(ctx.months[0]))} – ${esc(pretty(ctx.months[ctx.months.length - 1]))}</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${out}</svg>
  </div>`;
}

function shopPopupHtml(n) {
  const s = city.shops[n];
  const cust = (city.monthly[n] || [])[view.i] || 0;
  const act = activeLevers();
  const rows = ["e", "w", "co2"].map(mk => {
    const m = METRICS[mk];
    const f = (FACTORS[s.l] || FACTORS.Other_EFW)[mk];
    const base = cust * f;
    const after = base * shopMultiplier(s, act, mk, view.heatMin, view.surge);
    const moved = Math.abs(after - base) > 0.5;
    return `<div class="pr ${mk === view.metric ? "on" : ""}">
      <span><i style="background:${c(m.token)}"></i>${esc(m.label)}</span>
      <span class="pv">${fmt(after)} <u>${esc(m.unit)}</u>
      ${moved ? `<em style="color:${after < base ? c("--c-carbon") : c("--c-energy")}">
        ${after < base ? "−" : "+"}${fmt(Math.abs(after - base))}</em>` : ""}</span></div>`;
  }).join("");

  return `<div class="phead">
      <i class="pdot" style="background:${c(LAYER_TOKEN[s.l] || "--c-other")}"></i>
      <b>${esc(s.n || "Shop")}</b>
    </div>
    <div class="psub">${esc(LAYER_LABEL[s.l] || s.l)} · heat ${(+(s.u || 0)).toFixed(1)}${
      s.d != null && s.d < 1e8 ? ` · ${s.d.toFixed(1)} km from the stadium` : ""}</div>
    ${shopSpark(n)}
    <div class="prows">
      <div class="pr"><span>Customers</span><span class="pv">${fmt(cust)}</span></div>
      ${rows}
    </div>
    <div class="pfoot">${pretty(ctx.months[view.i])}${
      act.length || view.surge !== 1
        ? ` · ${act.length} lever${act.length === 1 ? "" : "s"} applied`
        : " · no scenario applied"}</div>`;
}

function refreshPopup() {
  if (!openPopup || openShop < 0) return;
  openPopup.setHTML(shopPopupHtml(openShop));
}

/** Ring the shop whose card is open; -1 matches nothing, which clears it. */
function markSelected() {
  if (ready && map.getLayer("shop-sel")) {
    map.setFilter("shop-sel", ["==", ["get", "i"], openShop]);
  }
}

function popup(f, lngLat, isCell) {
  const p = f.properties;
  const m = METRICS[view.metric];
  if (openPopup) { openPopup.remove(); openPopup = null; openShop = -1; markSelected(); }

  const html = isCell
    ? `<b>District</b><div class="pr"><span>${esc(m.label)}</span><span>${fmt(Math.abs(p.v))}
        ${esc(m.unit)}${view.diff ? " avoided" : ""}</span></div>
       <div class="pfoot">${pretty(ctx.months[view.i])}</div>`
    : shopPopupHtml(p.i);

  openPopup = new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: "302px", focusAfterOpen: false })
    .setLngLat(lngLat).setHTML(html).addTo(map);
  openShop = isCell ? -1 : p.i;
  openPopup.on("close", () => { openPopup = null; openShop = -1; markSelected(); });
  markSelected();
  nudgeIntoClear(lngLat);
}

/* The controls float on the map, so a shop clicked in the bottom-right corner
   would open its card underneath the scrubber or behind the drawer. Rather than
   let them fight, slide the map a little so the shop sits in open water. */
function nudgeIntoClear(lngLat) {
  const box = map.getContainer().getBoundingClientRect();
  const at = map.project(lngLat);
  const chrome = parseFloat(
    getComputedStyle(root.querySelector("#sp-stage")).getPropertyValue("--map-bottom")) || 164;

  const top = 210;                                   // control cluster + pills
  const right = view.panel ? 380 : 24;               // the open scenario drawer
  const bottom = chrome + 40;                        // legend + scrubber + room

  let dx = 0, dy = 0;
  if (at.y > box.height - bottom) dy = at.y - (box.height - bottom);
  else if (at.y < top) dy = at.y - top;
  if (at.x > box.width - right) dx = at.x - (box.width - right);
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) map.panBy([dx, dy], { duration: 320 });
}

/* ---------------------------------------------------------- the chrome */

function drawAll() {
  drawControls();
  drawScenario();
  drawScrub();
  paint();
  drawPills();
  drawDay();
  drawPlays();
  drawLegend();
  drawCaption();
}

function drawLegend() {
  const box = root.querySelector("#sp-legend");
  if (view.diff) {
    box.innerHTML = `<span class="lgk">Change</span>
      <span><i style="background:${c("--c-carbon")}"></i>avoided</span>
      <span><i style="background:${c("--c-energy")}"></i>added</span>`;
    return;
  }
  if (view.mode === "districts") {
    box.innerHTML = `<span class="lgk">${esc(METRICS[view.metric].label)}</span>
      <span class="ramp"><i style="background:${c("--c-water")}"></i><i
        style="background:${c("--c-cooling")}"></i><i
        style="background:${c("--c-energy")}"></i></span>
      <span class="lgs">low → high per district</span>`;
    return;
  }
  box.innerHTML = `<span class="lgk">Shop type</span>` +
    Object.entries(LAYER_LABEL).map(([k, label]) =>
      `<span><i style="background:${c(LAYER_TOKEN[k])}"></i>${esc(label)}</span>`).join("");
}

function drawCaption() {
  root.querySelector("#sp-title").textContent = `Impact map · ${city.name}`;
  const n = activeLevers().length;
  root.querySelector("#sp-cap").textContent =
    `Every shop in ${city.name}, sized by ${METRICS[view.metric].label.toLowerCase()} in ` +
    `${pretty(ctx.months[view.i])}. ` +
    (n ? `${n} lever${n === 1 ? "" : "s"} active — the map shows where they land.`
       : `Open Scenario to model a play and see where it would bite.`);
}

function drawControls() {
  const cities = ctx.stats.cities;
  root.querySelector("#sp-ctl").innerHTML = `
    <div class="pickwrap">
      <button class="mpick" id="sp-citypick" aria-haspopup="true" aria-expanded="false">
        <img src="${photo(city.name, 320)}" alt="">
        <span class="mpn">${esc(city.name)}</span>
        ${icon("chevDown", 15)}
      </button>
      <div class="citymenu" id="sp-citymenu" hidden></div>
    </div>
    <div class="mseg" id="sp-metric">${Object.entries(METRICS).map(([k, m]) =>
      `<button data-m="${k}" class="${view.metric === k ? "on" : ""}"
         title="${m.label}">${icon(m.icon, 15)}</button>`).join("")}</div>
    <div class="mseg" id="sp-mode">
      <button data-v="shops" class="${view.mode === "shops" ? "on" : ""}">Shops</button>
      <button data-v="districts" class="${view.mode === "districts" ? "on" : ""}">Districts</button>
    </div>
    <button class="mtog ${view.heat ? "on" : ""}" id="sp-heat">${icon("heat", 15)} Heat</button>
    <select id="sp-match" class="mmatch">
      <option value="">No match selected</option>
      ${ctx.matches.filter(m => m.m === city.name).map(m =>
        `<option value="${m.id}" ${view.matchId === m.id ? "selected" : ""}
          >${m.d.slice(5)} · ${esc(m.t1)} v ${esc(m.t2)}</option>`).join("")}
    </select>`;

  root.querySelector("#sp-citypick").onclick = ev => {
    ev.stopPropagation();
    const menu = root.querySelector("#sp-citymenu");
    const opening = menu.hidden;
    if (opening) drawCityMenu();
    menu.hidden = !opening;
    root.querySelector("#sp-citypick").setAttribute("aria-expanded", String(opening));
  };
  root.querySelectorAll("#sp-metric button").forEach(b => {
    b.onclick = () => {
      view.metric = b.dataset.m;
      drawControls(); paint(); drawPills(); drawDay(); drawLegend(); drawCaption();
      refreshPopup();   // the shop card charts the metric on screen
    };
  });
  root.querySelectorAll("#sp-mode button").forEach(b => {
    b.onclick = () => {
      view.mode = b.dataset.v;
      if (openPopup) { openPopup.remove(); openPopup = null; openShop = -1; }
      drawControls(); paint(); drawLegend();
    };
  });
  root.querySelector("#sp-heat").onclick = () => { view.heat = !view.heat; drawControls(); paint(); };
  root.querySelector("#sp-match").onchange = e => {
    view.matchId = e.target.value === "" ? null : +e.target.value;
    const m = ctx.matches.find(x => x.id === view.matchId);
    if (m) {
      const at = ctx.months.indexOf("2024-" + m.d.slice(5, 7));
      if (at >= 0) view.i = at;
      map.flyTo({ center: [city.stadium.x, city.stadium.y], zoom: 11.4, duration: 500 });
    }
    drawAll();
  };
}

function drawCityMenu() {
  const menu = root.querySelector("#sp-citymenu");
  menu.setAttribute("role", "listbox");
  menu.innerHTML = byRank(ctx.stats)
    .map(name => cityOption(name, ctx.stats, name === city.name)).join("");
  menu.querySelectorAll(".cityopt").forEach(b => {
    b.onclick = () => { menu.hidden = true; ctx.setCity(b.dataset.city); };
  });
}

function drawPills() {
  const act = activeLevers();
  const box = root.querySelector("#sp-pills");
  const shown = ["e", "w", "co2"];
  box.innerHTML = shown.map(mk => {
    const t = totals(city.shops, city.monthly, view.i, mk, act, view.heatMin, view.surge);
    const m = METRICS[mk];
    const delta = t.scenario - t.base;
    return `<div class="pill3">
      <span class="p3k">${icon(m.icon, 13)} ${m.label}</span>
      <span class="p3v num">${fmt(view.diff ? Math.abs(delta) : t.scenario)}
        <em>${esc(m.unit)}</em></span>
      ${delta ? `<span class="p3d num">${delta < 0 ? "−" : "+"}${fmt(Math.abs(delta))} vs base</span>`
              : `<span class="p3d">${pretty(ctx.months[view.i])}</span>`}
    </div>`;
  }).join("");
}

/* --------------------------------------------------------- the scrubber */

function drawScrub() {
  const box = root.querySelector("#sp-scrub");
  const months = ctx.months;
  const series = months.map((_, j) => {
    let s = 0;
    for (let n = 0; n < city.monthly.length; n++) s += city.monthly[n][j] || 0;
    return s;
  });
  const mx = Math.max(...series, 1);
  const W = 1000, H = 46;
  const bw = W / months.length;

  const bars = series.map((v, j) => {
    const h = Math.max(1.5, (v / mx) * (H - 8));
    return `<rect x="${(j * bw).toFixed(2)}" y="${(H - h).toFixed(1)}"
      width="${(bw - 1).toFixed(2)}" height="${h.toFixed(1)}" rx="1"
      fill="${j === view.i ? c("--accent") : c("--ink-3")}"
      opacity="${j === view.i ? 1 : 0.42}"><title>${esc(pretty(months[j]))}</title></rect>`;
  }).join("");

  // 61 identical grey boxes are impossible to aim at. Rule an axis under them
  // and tick each January, with the year named just to the right of its tick —
  // a centred year label would put "2024" over the summer of 2024.
  let ticks = "";
  months.forEach((m, j) => {
    if (!m.endsWith("-01")) return;
    ticks += `<span style="left:${((j / months.length) * 100).toFixed(3)}%">${esc(m.slice(0, 4))}</span>`;
  });

  box.innerHTML = `
    <button class="tbtn" id="sp-play" aria-label="${view.playing ? "Pause" : "Play"}">
      ${view.playing ? "❚❚" : "▶"}</button>
    <button class="tbtn" id="sp-prev" aria-label="Previous month">←</button>
    <button class="tbtn" id="sp-next" aria-label="Next month">→</button>
    <span class="tnow num">${pretty(months[view.i])}</span>
    <span class="scrubtrack">
      <svg class="scrubsvg" id="sp-scrubsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
           role="slider" aria-label="Month" aria-valuenow="${view.i}"
           aria-valuetext="${esc(pretty(months[view.i]))}">${bars}</svg>
      <span class="scrubax" aria-hidden="true">${ticks}</span>
    </span>`;

  root.querySelector("#sp-play").onclick = togglePlay;
  root.querySelector("#sp-prev").onclick = () => step(-1);
  root.querySelector("#sp-next").onclick = () => step(1);
  const svg = root.querySelector("#sp-scrubsvg");
  const pick = ev => {
    const b = svg.getBoundingClientRect();
    const j = Math.floor(((ev.clientX - b.left) / b.width) * months.length);
    setMonth(Math.max(0, Math.min(months.length - 1, j)));
  };
  svg.onclick = pick;
  svg.onmousemove = ev => { if (ev.buttons === 1) pick(ev); };
}

function setMonth(j) {
  view.i = j;
  paint();
  refreshPopup();
  drawPills();
  drawDay();
  drawCaption();
  // only the bars and the label change; redrawing the whole bar is cheap enough
  const svg = root.querySelector("#sp-scrubsvg");
  if (svg) {
    svg.setAttribute("aria-valuenow", String(j));
    svg.setAttribute("aria-valuetext", pretty(ctx.months[j]));
    svg.querySelectorAll("rect").forEach((r, n) => {
      r.setAttribute("fill", n === j ? c("--accent") : c("--ink-3"));
      r.setAttribute("opacity", n === j ? "1" : "0.42");
    });
    root.querySelector(".tnow").textContent = pretty(ctx.months[j]);
  }
}

const step = d => setMonth((view.i + d + ctx.months.length) % ctx.months.length);

function togglePlay() {
  view.playing = !view.playing;
  clearInterval(timer);
  if (view.playing) timer = setInterval(() => step(1), 420);
  const b = root.querySelector("#sp-play");
  if (b) b.textContent = view.playing ? "❚❚" : "▶";
}

/* -------------------------------------------------- the scenario drawer */

function drawScenario() {
  const el = root.querySelector("#sp-scen");
  el.hidden = !view.panel;
  const btn = root.querySelector("#sp-scenbtn");
  btn.classList.toggle("on", view.panel);
  btn.hidden = view.panel;   // the drawer has its own close button
  root.querySelector("#sp-stage").classList.toggle("panelopen", view.panel);
  const n = view.levers.size;
  const badge = root.querySelector("#sp-scount");
  badge.hidden = !n;
  badge.textContent = String(n);
  if (!view.panel) return;

  const gated = levers.filter(l => l.scope.minHeat).map(l => l.title);

  el.innerHTML = `
    <div class="scenhead">
      <h3>Scenario</h3>
      <button class="drop" id="sp-scenclose" aria-label="Close">${icon("close", 14)}</button>
    </div>

    <div class="scenblock">
      <label class="scenlabel">Visitor surge
        <span class="num">${view.surge.toFixed(2)}×</span></label>
      <input type="range" id="sp-surge" min="1" max="2" step="0.05" value="${view.surge}">
      <details class="scendisc">
        <summary>How a surge is distributed</summary>
        ${surgeTable()}
      </details>
    </div>

    <div class="scenblock">
      <label class="scenlabel">Plays</label>
      ${levers.map(l => {
        const on = view.levers.has(l.id);
        const hit = countScope(l);
        return `<button class="lever ${on ? "on" : ""}" data-lever="${l.id}"
            ${hit ? "" : "disabled title=\"No shop in this city falls in this play's scope\""}>
          <span class="lvtop"><span class="lvname">${esc(l.title)}</span>
            ${on ? icon("check", 14) : icon("plus", 14)}</span>
          <span class="lvscope">${esc(l.note)} · <b>${full(hit)}</b> shops${hit ? "" : " — nothing to act on here"}</span>
          <span class="lveff">${["e", "w", "co2"].filter(k => l.effect[k]).map(k =>
            `<em style="color:${c(METRICS[k].token)}">${METRICS[k].label} ${(l.effect[k] * 100).toFixed(0)}%</em>`).join("")}</span>
        </button>`;
      }).join("")}
    </div>

    <div class="scenblock">
      <label class="scenlabel">Heat threshold
        <span class="num">${view.heatMin.toFixed(1)} <em>of 11</em></span></label>
      <input type="range" id="sp-heatmin" min="1" max="11" step="0.5" value="${view.heatMin}">
      <p class="scennote">A shop counts as a "high-UHI corridor" above this urban-heat
        index. It is a judgement call, so it is yours to set rather than ours to bury.
        Gates <b>${esc(gated.join(", ") || "no play")}</b> — and the shop counts below
        move as you drag it.</p>
    </div>

    <label class="difftog">
      <input type="checkbox" id="sp-diff" ${view.diff ? "checked" : ""}>
      Show the change only
    </label>
    <button class="btn sm" id="sp-reset">Reset scenario</button>`;

  root.querySelector("#sp-scenclose").onclick = () => { view.panel = false; drawScenario(); };
  root.querySelector("#sp-surge").oninput = e => {
    view.surge = +e.target.value; scenarioChanged();
  };
  root.querySelector("#sp-heatmin").oninput = e => {
    view.heatMin = +e.target.value; scenarioChanged();
  };
  root.querySelector("#sp-diff").onchange = e => { view.diff = e.target.checked; scenarioChanged(); };
  root.querySelector("#sp-reset").onclick = () => {
    view.levers.clear(); view.surge = 1; view.diff = false; view.heatMin = 8; scenarioChanged();
  };
  root.querySelectorAll("[data-lever]").forEach(b => {
    b.onclick = () => {
      const id = b.dataset.lever;
      view.levers.has(id) ? view.levers.delete(id) : view.levers.add(id);
      scenarioChanged();
    };
  });
}

/**
 * The surge is not a flat multiplier. build_surge_model.py fits how each shop
 * type and each distance band has actually moved when a host city got busier;
 * showing those coefficients is what makes the slider defensible rather than
 * decorative.
 */
function surgeTable() {
  const m = surgeModel();
  if (!m) return `<p class="scennote">Applied evenly — run
    <code>scripts/build_surge_model.py</code> to fit the measured response.</p>`;

  const named = { Food: "Food", Venue: "Venues", Water: "Lodging",
                  Energy: "Fuel", Other_EFW: "Other" };
  const rows = Object.entries(m.layers || {})
    .sort((a, b) => b[1].elasticity - a[1].elasticity)
    .map(([k, v]) => `<tr>
      <td>${named[k] || k}</td>
      <td class="num">×${Math.pow(view.surge, v.elasticity).toFixed(2)}</td>
      <td class="num el">β ${v.elasticity.toFixed(2)}</td>
      <td class="num r2">R²&nbsp;${v.r2.toFixed(2)}</td></tr>`).join("");

  const near = m.near_stadium;
  const nearRow = near && near.extra
    ? `<tr class="nearrow"><td>within ${near.within_km} km</td>
       <td class="num">+${((Math.pow(view.surge, near.extra) - 1) * 100).toFixed(0)}%</td>
       <td class="num el">β +${near.extra.toFixed(2)}</td>
       <td class="num r2">R²&nbsp;${near.r2.toFixed(2)}</td></tr>` : "";

  return `<table class="surgetbl">${rows}${nearRow}</table>
    <p class="scennote">Measured, not assumed: each segment's response to a busier
      city, fitted across 61 months and 11 hosts. Lodging and venues amplify a
      surge; fuel retail lags it. Noisy estimates are shrunk toward proportional,
      which is why a low R² sits near β&nbsp;1.</p>`;
}

function scenarioChanged() {
  drawScenario();
  paint();
  refreshPopup();
  drawLegend();
  drawPills();
  drawDay();
  drawPlays();
  drawCaption();
}

function countScope(l) {
  let n = 0;
  for (const s of city.shops) if (shopMultiplier(s, [l], "e", view.heatMin) !== 1 ||
      shopMultiplier(s, [l], "w", view.heatMin) !== 1 ||
      shopMultiplier(s, [l], "co2", view.heatMin) !== 1) n++;
  return n;
}

/* ------------------------------------------------------- the day chart */

/**
 * Per-layer effect of the current scenario, customer-weighted for this month.
 * The daily table is city x layer x day, so a lever scoped by heat or distance
 * cannot be applied to it shop by shop — but the ratio of scenario to baseline
 * within each layer can, and that is exact in aggregate.
 */
function layerRatios(metric) {
  const act = activeLevers();
  const base = {}, scen = {};
  for (let n = 0; n < city.shops.length; n++) {
    const sh = city.shops[n];
    const cust = (city.monthly[n] || [])[view.i] || 0;
    if (!cust) continue;
    const f = metric === "c" ? 1 : (FACTORS[sh.l] || FACTORS.Other_EFW)[metric];
    const v = cust * f;
    base[sh.l] = (base[sh.l] || 0) + v;
    scen[sh.l] = (scen[sh.l] || 0) + v * shopMultiplier(sh, act, metric, view.heatMin, view.surge);
  }
  const out = {};
  for (const l in base) out[l] = base[l] ? scen[l] / base[l] : 1;
  return out;
}

function drawDay() {
  const svg = root.querySelector("#sp-day");
  const month = ctx.months[view.i];
  const rows = city.daily.filter(r => r.d.slice(0, 7) === month);
  const mk = view.metric, m = METRICS[mk];
  const act = activeLevers();
  const changed = act.length > 0 || view.surge !== 1;

  root.querySelector("#sp-daycap").textContent =
    `${pretty(month)} · ${m.label.toLowerCase()} per day`;

  if (!rows.length) {
    svg.innerHTML = "";
    root.querySelector("#sp-daylegend").innerHTML =
      `<span class="muted">No daily rows for this month.</span>`;
    return;
  }

  const ratio = layerRatios(mk);
  const dayBase = new Map(), dayScen = new Map();
  for (const r of rows) {
    const f = mk === "c" ? 1 : (FACTORS[r.l] || FACTORS.Other_EFW)[mk];
    const v = r.c * f;
    dayBase.set(r.d, (dayBase.get(r.d) || 0) + v);
    dayScen.set(r.d, (dayScen.get(r.d) || 0) + v * (ratio[r.l] ?? 1));
  }
  const days = [...dayBase.keys()].sort();

  // card spend lands on the settlement day, so raw days show a Monday spike;
  // a centred 7-day mean is the honest shape
  const smooth = arr => arr.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(arr.length - 1, i + 3); j++) { sum += arr[j]; n++; }
    return sum / n;
  });
  const rawB = days.map(d => dayBase.get(d));
  const base = smooth(rawB);
  const scen = smooth(days.map(d => dayScen.get(d)));

  const W = 1000, H = 240, pad = { l: 66, r: 18, t: 16, b: 30 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const mx = Math.max(...rawB, ...scen, 1);
  const X = i => pad.l + (i / Math.max(1, days.length - 1)) * iw;
  const Y = v => pad.t + ih - (v / mx) * ih;
  const line = a => a.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");

  let out = "";
  for (let g = 0; g <= 3; g++) {
    const y = pad.t + ih - (g / 3) * ih;
    out += `<line class="gline" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"/>`;
    out += `<text class="glabel" x="${pad.l - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">${fmt(mx * g / 3)}</text>`;
  }

  // the saving is the band between the two lines — the point of the panel
  if (changed) {
    const top = base.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    const bot = scen.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).reverse();
    out += `<polygon points="${top.concat(bot).join(" ")}"
      fill="${c("--c-carbon")}" opacity="0.16"/>`;
  }
  out += `<polyline points="${line(rawB)}" fill="none" stroke="${c("--ink-3")}"
    stroke-width="1" opacity="0.35"/>`;
  if (changed) {
    out += `<polyline points="${line(base)}" fill="none" stroke="${c("--ink-3")}"
      stroke-width="1.8" stroke-dasharray="5 4"/>`;
  }
  out += `<polyline points="${line(changed ? scen : base)}" fill="none"
    stroke="${c(m.token)}" stroke-width="2.6" stroke-linejoin="round"/>`;
  days.forEach((d, i) => {
    if (+d.slice(8) % 7 === 1) {
      out += `<text class="glabel" x="${X(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${+d.slice(8)}</text>`;
    }
  });
  svg.innerHTML = out;

  const totB = base.reduce((a, b) => a + b, 0), totS = scen.reduce((a, b) => a + b, 0);
  const delta = totS - totB;
  root.querySelector("#sp-daylegend").innerHTML = changed
    ? `<span><i style="background:${c(m.token)}"></i>with the scenario</span>
       <span><i class="dash"></i>baseline</span>
       <span><i class="box" style="background:${c("--c-carbon")};opacity:.3"></i>
         ${delta < 0 ? "avoided" : "added"} — <b>${fmt(Math.abs(delta))} ${esc(m.unit)}</b>
         across ${days.length} days (${(Math.abs(delta) / (totB || 1) * 100).toFixed(1)}%)</span>`
    : `<span><i style="background:${c(m.token)}"></i>7-day mean</span>
       <span><i style="background:${c("--ink-3")};opacity:.4"></i>as recorded</span>
       <span class="muted">Card spend is stamped on the settlement day, so raw days spike on Mondays.</span>`;
}

/* ----------------------------------------------------- plays that apply */

function drawPlays() {
  const k = ctx.stats.byCity[city.name];
  const box = root.querySelector("#sp-plays");
  if (!k) { box.innerHTML = ""; return; }
  const pressing = new Set((k.recommended_plays || []).map(p => p.id));

  box.innerHTML = `<p class="note" style="margin-bottom:12px">
      Plays Plan D marks as pressing for ${esc(city.name)}. Switching one on models it
      against the shops it names.</p>` +
    levers.map(l => {
      const on = view.levers.has(l.id);
      const press = pressing.has(l.id);
      return `<button class="applyrow ${on ? "on" : ""}" data-lever2="${l.id}">
        <span class="arname">${esc(l.title)}</span>
        <span class="archip ${press ? "press" : ""}">${press ? "pressing here" : "available"}</span>
        <span class="arscope">${full(countScope(l))} shops</span>
        <span class="arto">${on ? icon("check", 15) : icon("plus", 15)}</span>
      </button>`;
    }).join("");

  box.querySelectorAll("[data-lever2]").forEach(b => {
    b.onclick = () => {
      const id = b.dataset.lever2;
      view.levers.has(id) ? view.levers.delete(id) : view.levers.add(id);
      scenarioChanged();
    };
  });
}

/* ------------------------------------------------------- city switching */

/** Swap positron for dark-matter when the theme flips. Our layers are added on
    style.load, so they survive the swap without being re-registered here. */
async function applyTheme() {
  if (!ready || ctx.state.theme === styledTheme) return;
  styledTheme = ctx.state.theme;
  const style = await resolveStyle(styledTheme);
  // diff:false is load-bearing. With the default diff, MapLibre works out how to
  // turn positron into dark-matter and, since shop-dots/heat/districts are in the
  // old style but not the new one, dutifully removes them — silently, and without
  // firing style.load, so nothing puts them back. A full reload fires style.load,
  // which re-adds the layers and repaints them.
  map.setStyle(style, { diff: false });
}

async function refreshCity() {
  if (!ready || !city) return;
  if (city.name === ctx.state.city) { drawAll(); return; }
  root.querySelector("#sp-loading").hidden = false;
  root.querySelector("#sp-loading").textContent = `Loading ${ctx.state.city}…`;
  if (openPopup) { openPopup.remove(); openPopup = null; openShop = -1; }
  await loadCity(ctx.state.city);
  districtCache = null;
  buildSources();
  root.querySelector("#sp-loading").hidden = true;
  drawAll();
}
