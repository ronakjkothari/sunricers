/* Compare hosts — Plan D's surface.

   Three bands:
     A  leaderboard   where all eleven stand; also the selector for B and C
     B  head to head  how the chosen hosts differ, and on which drivers
     C  playbook      the full recommendation set for the anchor host

   The anchor is the shared `state.city`, so picking a host here also moves the
   Overview. Partners are local to this page. Overview shows a host's top two
   plays; this page is where the whole playbook lives, which is why the deep
   dive stays rather than deferring to Overview. */

import { fmt, full, esc, pretty, isSummer, niceMax, ordinal, slug } from "../lib/format.js";
import { icon, DRIVER_ICON } from "../lib/icons.js";
import { c, METRIC_COLOR, DRIVER_COLOR } from "../lib/palette.js";
import { METRIC_ABS, pctLabel, polarRank } from "../lib/stats.js";
import { photo, scoreColour, loadBlurs } from "../lib/city.js";

const PLAIN = {
  energy_kwh: "Energy use", kg_co2e: "Food carbon", water_liters: "Water use",
  cdd: "Cooling demand", uhi: "Urban heat",
};
const UNIT = {
  energy_kwh: "kWh", kg_co2e: "kg", water_liters: "L",
  cdd: "degree-days", uhi: "index",
};
/** Formula order, so the matrix and the legend always agree. */
const DRIVERS = ["energy_kwh", "kg_co2e", "water_liters", "cdd", "uhi"];

const METRICS = {
  v: { label: "Visits", unit: "visits", icon: "visits" },
  e: { label: "Energy", unit: "kWh", icon: "energy" },
  w: { label: "Water", unit: "L", icon: "water" },
  co2: { label: "CO₂e", unit: "kg CO₂e", icon: "carbon" },
};
const MORDER = ["v", "e", "w", "co2"];

/** Play effect key -> the absolute it moves, and the metric colour. */
const EFFECT_METRIC = [
  ["energy_pct", "energy_kwh", "e"],
  ["water_pct", "water_liters", "w"],
  ["food_co2e_pct", "kg_co2e", "co2"],
];

/** Slot colours for the comparison set. Slot 0 is always the anchor. */
const SET_TOKENS = ["--accent", "--c-water", "--c-carbon", "--c-venue"];
const MAX_PARTNERS = 3;

let root = null;
let ctx = null;
let lastAnchor = null;
let metric = "e";

/* ---------------------------------------------------------------- mount */

export function mount(el, context) {
  root = el;
  ctx = context;
  root.innerHTML = `
    <div class="secthead">
      <div class="shtxt">
        <h2>Compare hosts</h2>
        <p>All eleven on one scale, any of them side by side, and the full playbook
           for whichever host you anchor on.</p>
      </div>
    </div>

    <section class="card panel" style="margin-top:0">
      <header>
        <h2>Readiness leaderboard</h2>
        <span class="chip">0–100 · higher means less summer pressure</span>
      </header>
      <div class="body">
        <div class="filterrow" id="cp-filter"></div>
        <div class="board" id="cp-board"></div>
        <p class="note" id="cp-note"></p>
      </div>
    </section>

    <section class="card panel" id="cp-h2h">
      <header>
        <h2>Head to head</h2>
        <span class="sp"></span>
        <div class="setbar" id="cp-set"></div>
      </header>
      <div class="body">
        <p class="subcap" id="cp-matrixcap"></p>
        <div class="matrix" id="cp-matrix"></div>
        <div class="h2hsplit">
          <div>
            <h3 class="subhead">What separates them</h3>
            <p class="subcap" id="cp-decompcap"></p>
            <div id="cp-decomp"></div>
            <div class="dlegend" id="cp-dlegend"></div>
          </div>
          <div>
            <h3 class="subhead">Size is not pressure</h3>
            <p class="subcap">Every host by summer volume against its readiness. If size
               decided the score these would sit on a line.</p>
            <div id="cp-scatter"></div>
          </div>
        </div>
      </div>
    </section>

    <section class="card panel">
      <header>
        <h2>Footprint through the year</h2>
        <span class="sp"></span>
        <div class="mswitch" id="cp-mswitch" role="group" aria-label="Chart metric"></div>
      </header>
      <div class="chartwrap">
        <svg id="cp-chart" viewBox="0 0 1000 320" role="img"
             aria-label="Monthly footprint for the compared hosts"></svg>
        <div class="tip" id="cp-tip"></div>
      </div>
      <div class="chartlegend" id="cp-legend"></div>
    </section>

    <section class="card panel" id="cp-playbook">
      <header>
        <h2 id="cp-pbtitle">Playbook</h2>
        <span class="sp"></span>
        <span class="eyebrow" id="cp-pbcap"></span>
      </header>
      <div class="pbbody" id="cp-plays"></div>
      <div class="exits" id="cp-exits"></div>
    </section>

    <section class="card panel">
      <header>
        <h2>Where these plays transfer</h2>
        <span class="chip">the case for stealing one</span>
      </header>
      <div class="body">
        <div class="pmatrix" id="cp-pmatrix"></div>
        <div class="pmkey">
          <span><b class="pmk press"></b> pressing here</span>
          <span><b class="pmk opt"></b> available, not pressing</span>
          <span><b class="pmk none"></b> not indicated</span>
        </div>
      </div>
    </section>`;

  loadBlurs().then(() => draw());
}

export function update(context) {
  ctx = context;
  syncPartners();
  draw();
  landing();
}

/* ------------------------------------------------------------- helpers */

const anchor = () => ctx.stats.byCity[ctx.state.city];

/** Anchor first, then partners. Slot order drives every colour on the page. */
const setCities = () => [ctx.state.city, ...ctx.state.partners];
const slotColour = i => c(SET_TOKENS[i % SET_TOKENS.length]);

/**
 * Partners are peers *of the anchor*, so moving the anchor reseeds them.
 * The contract's own `peer_cities` is the meaningful default.
 */
function syncPartners() {
  const { state } = ctx;
  if (state.city === lastAnchor && Array.isArray(state.partners)) return;
  lastAnchor = state.city;
  const k = anchor();
  state.partners = k ? (k.peer_cities || []).slice(0, 2) : [];
}

function draw() {
  drawFilter();
  drawBoard();
  drawSet();
  drawMatrix();
  drawDecomp();
  drawScatter();
  drawSwitch();
  drawChart();
  drawPlaybook();
  drawPlayMatrix();
}

/** Someone who asked for the playbook should not land on a leaderboard. */
function landing() {
  const want = ctx.state.compareScroll;
  if (!want) return;
  ctx.state.compareScroll = null;
  const el = root.querySelector("#cp-" + want);
  if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function setAnchor(city) {
  if (city === ctx.state.city) return;
  ctx.state.partners = (ctx.state.partners || []).filter(p => p !== city);
  ctx.setCity(city);           // shared with Overview, so both pages agree
}

function togglePartner(city) {
  const { state } = ctx;
  if (city === state.city) return;              // the anchor is always in
  const at = state.partners.indexOf(city);
  if (at >= 0) state.partners.splice(at, 1);
  else if (state.partners.length < MAX_PARTNERS) state.partners.push(city);
  else state.partners = [...state.partners.slice(1), city];   // oldest drops out
  draw();
}

/* ---------------------------------------------------- A. the leaderboard */

function drawFilter() {
  const box = root.querySelector("#cp-filter");
  const f = ctx.state.filter;
  box.innerHTML = `<span class="eyebrow">Elevated on</span>
    <button class="fchip ${!f ? "on" : ""}" data-f="">All hosts</button>` +
    DRIVERS.map(k => `<button class="fchip ${f === k ? "on" : ""}" data-f="${k}">
      ${icon(DRIVER_ICON[k], 14)} ${PLAIN[k]}</button>`).join("");
  box.querySelectorAll(".fchip").forEach(b => {
    b.onclick = () => { ctx.state.filter = b.dataset.f || null; drawFilter(); drawBoard(); };
  });
}

function visible() {
  const cards = [...ctx.contract.scorecards].sort((a, b) => a.rank - b.rank);
  if (!ctx.state.filter) return cards;
  return cards.filter(k => k.drivers.some(d => d.key === ctx.state.filter && d.elevated));
}

function drawBoard() {
  const cards = visible(), { state, stats } = ctx;

  root.querySelector("#cp-board").innerHTML = cards.length ? cards.map(k => {
    const city = k.host_city;
    const isAnchor = city === state.city;
    const slot = setCities().indexOf(city);
    const isPartner = slot > 0;
    // the bar always encodes readiness — letting set membership recolour it
    // made one channel mean two different things
    const col = scoreColour(k.readiness_score);
    const band = k.readiness_band;

    const add = isAnchor
      ? `<button class="ladd" disabled title="Anchor — the playbook below follows this host"
           aria-label="${esc(city)} is the anchor">${icon("anchor", 15)}</button>`
      : `<button class="ladd ${isPartner ? "on" : ""}" data-add="${esc(city)}"
           aria-pressed="${isPartner}"
           title="${isPartner ? "Remove from the comparison" : "Add to the comparison"}"
           >${icon(isPartner ? "check" : "plus", 15)}</button>`;

    return `<div class="lrow ${isAnchor ? "anchor" : ""} ${isPartner ? "partner" : ""}">
      <button class="lmain" data-anchor="${esc(city)}"
          title="Anchor the playbook on ${esc(city)}">
        <span class="lrank">#${k.rank}</span>
        <img class="lthumb" src="${photo(city, 320)}" alt="" loading="lazy" width="320" height="214">
        <span class="lname">${esc(city)}${slot >= 0
          ? `<i class="slot" style="background:${slotColour(slot)}"
               title="in the comparison"></i>` : ""}</span>
        <span class="lbar">
          <em style="left:${band[0]}%;width:${Math.max(0, band[1] - band[0])}%"></em>
          <i style="width:${Math.max(2, k.readiness_score)}%;background:${col}"></i>
        </span>
        <span class="lscore num" style="color:${col}">${k.readiness_score.toFixed(1)}</span>
      </button>
      ${add}
    </div>`;
  }).join("") : `<div class="empty">No host is elevated on that driver.</div>`;

  root.querySelectorAll("#cp-board [data-anchor]").forEach(b => {
    b.onclick = () => setAnchor(b.dataset.anchor);
  });
  root.querySelectorAll("#cp-board [data-add]").forEach(b => {
    b.onclick = () => togglePartner(b.dataset.add);
  });

  root.querySelector("#cp-note").innerHTML = ctx.state.filter
    ? `Showing ${cards.length} of ${stats.n} hosts elevated on <b>${PLAIN[ctx.state.filter]}</b>.
       The pale block is the ±15 uncertainty band. Click a host to anchor it; ⊕ adds it to the comparison.`
    : `The pale block is the ±15 uncertainty band. Click a host to anchor the playbook on it;
       ⊕ adds it to the comparison above.`;
}

/* ---------------------------------------------------- B. the comparison */

function drawSet() {
  root.querySelector("#cp-set").innerHTML = setCities().map((city, i) => {
    const isAnchor = i === 0;
    return `<span class="setchip ${isAnchor ? "is-anchor" : ""}">
      <img src="${photo(city, 320)}" alt="" loading="lazy">
      ${esc(city)}
      ${isAnchor
        ? `<span class="tag">anchor</span>`
        : `<i style="background:${slotColour(i)}"></i>
           <button class="drop" data-drop="${esc(city)}"
             aria-label="Remove ${esc(city)}">${icon("close", 12)}</button>`}
    </span>`;
  }).join("") + (ctx.state.partners.length < MAX_PARTNERS
    ? `<span class="note" style="margin-left:4px">⊕ a host below to add</span>` : "");

  root.querySelectorAll("#cp-set [data-drop]").forEach(b => {
    b.onclick = () => togglePartner(b.dataset.drop);
  });
}

function drawMatrix() {
  const { stats } = ctx;
  const cities = setCities();
  const box = root.querySelector("#cp-matrix");
  box.style.gridTemplateColumns = `minmax(150px, 210px) repeat(${cities.length}, minmax(0, 1fr))`;

  root.querySelector("#cp-matrixcap").textContent =
    `Rates per trading shop-month — the grain readiness is scored on. The tick is the ` +
    `11-host median; the bar runs from it to each host's value.`;

  let html = `<span class="mhead">Driver</span>` + cities.map((city, i) =>
    `<span class="mcity" style="--mc:${slotColour(i)}">
       <img src="${photo(city, 320)}" alt="" loading="lazy"><span>${esc(city)}</span>
     </span>`).join("");

  for (const key of DRIVERS) {
    const s = stats.driverStats[key];
    const span = (s.max - s.min) || 1;
    const posOf = v => ((v - s.min) / span) * 100;
    const mid = posOf(s.median);
    const w = ctx.stats.weights[key] || 0;

    html += `<span class="mlabel" style="--dc:${c(DRIVER_COLOR[key])}">
      ${icon(DRIVER_ICON[key], 16)} ${PLAIN[key]} <em>${(w * 100).toFixed(0)}%</em></span>`;

    for (const city of cities) {
      const k = stats.byCity[city];
      const d = k.drivers.find(x => x.key === key);
      const raw = d ? d.raw : NaN;
      const me = posOf(raw);
      const lo = Math.min(mid, me), width = Math.abs(me - mid);
      const pct = stats.driverPct(key, raw);
      const label = pctLabel(pct);
      const tone = label === "at median" ? c("--ink-3") : pct > 0 ? c("--v-up") : c("--v-down");

      html += `<div class="mcell" style="--dc:${c(DRIVER_COLOR[key])}">
        <span class="bullet">
          <span class="mid" style="left:${mid.toFixed(1)}%"></span>
          <i style="left:${lo.toFixed(1)}%;width:${Math.max(1.5, width).toFixed(1)}%"></i>
        </span>
        <span class="mv num">${fmt(raw)}<em>${UNIT[key]}</em>
          <span class="off" style="color:${tone}">${label}</span></span>
      </div>`;
    }
  }
  box.innerHTML = html;
}

/**
 * A deviation chart in readiness points, centred on the score a host with every
 * driver at the 11-host average would get. Drivers that cost a host points
 * stack left of the centre line, drivers that earn it points stack right, and
 * the net is printed at the end. Reading one colour down the rows shows exactly
 * which driver separates two hosts.
 */
function drawDecomp() {
  const { stats } = ctx;
  const cities = setCities();
  const neutral = stats.neutralReadiness;

  root.querySelector("#cp-decompcap").innerHTML =
    `Readiness points each driver adds or costs, against the <b>${neutral.toFixed(1)}</b> a host ` +
    `sitting at the 11-host average on every driver would score.`;

  const per = cities.map(city => {
    const k = stats.byCity[city];
    const pts = {};
    let down = 0, up = 0;
    for (const d of stats.contributions(k)) {
      const v = stats.points(d.value);
      pts[d.key] = v;
      if (v < 0) down += v; else up += v;
    }
    return { city, k, pts, down, up };
  });

  // symmetric scale, so a bar's length is comparable on both sides
  const reach = Math.max(8, ...per.map(r => Math.max(-r.down, r.up))) * 1.12;

  const W = 560, rowH = 54, padT = 30, padL = 112, padR = 58;
  const H = padT + cities.length * rowH + 22;
  const mid = padL + (W - padL - padR) / 2;
  const X = pts => mid + (pts / reach) * ((W - padL - padR) / 2);

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Readiness points contributed by each driver, for the compared hosts">`;

  const step = reach > 45 ? 20 : reach > 22 ? 10 : 5;
  for (let v = -Math.floor(reach / step) * step; v <= reach; v += step) {
    if (Math.abs(v) > reach) continue;
    const x = X(v);
    s += `<line x1="${x.toFixed(1)}" y1="${padT - 12}" x2="${x.toFixed(1)}" y2="${H - 20}"
      stroke="${v === 0 ? c("--ink-3") : c("--line")}" stroke-width="1"
      ${v === 0 ? 'stroke-dasharray="3 3"' : ""}/>`;
    s += `<text class="glabel" x="${x.toFixed(1)}" y="${padT - 17}" text-anchor="middle">${v > 0 ? "+" + v : v}</text>`;
  }
  s += `<text class="glabel" x="${mid.toFixed(1)}" y="${H - 6}" text-anchor="middle"
    style="fill:${c("--ink-3")}">host average</text>`;

  per.forEach((r, i) => {
    const y = padT + i * rowH;
    s += `<text class="cname" x="0" y="${(y + 18).toFixed(1)}"
      style="fill:${slotColour(i)}">${esc(r.city.length > 15 ? r.city.slice(0, 14) + "…" : r.city)}</text>`;

    let left = 0, right = 0;
    for (const key of DRIVERS) {
      const v = r.pts[key] || 0;
      if (Math.abs(v) < 0.05) continue;
      const from = v < 0 ? left + v : right;
      const to = v < 0 ? left : right + v;
      if (v < 0) left += v; else right += v;
      s += `<rect x="${X(from).toFixed(1)}" y="${(y + 4).toFixed(1)}"
        width="${Math.max(1.5, X(to) - X(from)).toFixed(1)}" height="16" rx="2"
        fill="${c(DRIVER_COLOR[key])}" opacity="0.9">
        <title>${PLAIN[key]}: ${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} points</title></rect>`;
    }

    // Houston's net rounds to zero; a signed "−0 pts" reads as a typo
    const net = r.up + r.down;
    const netTxt = Math.abs(net) < 0.5 ? "0 pts"
      : `${net > 0 ? "+" : "−"}${Math.abs(net).toFixed(0)} pts`;
    s += `<text class="cscore" x="${(W - padR + 10).toFixed(1)}" y="${(y + 18).toFixed(1)}"
      style="fill:${slotColour(i)}">${r.k.readiness_score.toFixed(1)}</text>`;
    s += `<text class="glabel" x="${(W - padR + 10).toFixed(1)}" y="${(y + 30).toFixed(1)}">${netTxt}</text>`;
  });

  s += `</svg>`;
  root.querySelector("#cp-decomp").innerHTML = s;

  root.querySelector("#cp-dlegend").innerHTML = DRIVERS.map(k =>
    `<span><i style="background:${c(DRIVER_COLOR[k])}"></i>${PLAIN[k]}</span>`).join("");
}

/** Readiness against summer volume: the product's core claim, in one picture. */
function drawScatter() {
  const { stats } = ctx;
  const cities = setCities();
  const pts = stats.cities.map(city => {
    const k = stats.byCity[city];
    return { city, x: k.ops_scale.absolute.visits || 0, y: k.readiness_score };
  });

  const W = 420, H = 300, pad = { l: 52, r: 18, t: 18, b: 46 };
  const mx = niceMax(Math.max(...pts.map(p => p.x)));
  const X = v => pad.l + (v / mx) * (W - pad.l - pad.r);
  const Y = v => pad.t + (1 - v / 100) * (H - pad.t - pad.b);

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Readiness against summer visit volume for all eleven hosts">`;
  for (let g = 0; g <= 4; g++) {
    const y = Y(g * 25);
    s += `<line class="gline" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"/>`;
    s += `<text class="glabel" x="${pad.l - 9}" y="${(y + 4).toFixed(1)}" text-anchor="end">${g * 25}</text>`;
  }
  s += `<line class="axis" x1="${pad.l}" y1="${Y(0).toFixed(1)}" x2="${W - pad.r}" y2="${Y(0).toFixed(1)}"/>`;
  for (const f of [0, 0.5, 1]) {
    s += `<text class="glabel" x="${X(mx * f).toFixed(1)}" y="${H - 26}" text-anchor="middle">${fmt(mx * f)}</text>`;
  }
  s += `<text class="glabel" x="${(W / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">summer visits</text>`;
  s += `<text class="glabel" transform="rotate(-90 13 ${((pad.t + Y(0)) / 2).toFixed(1)})"
    x="13" y="${((pad.t + Y(0)) / 2).toFixed(1)}" text-anchor="middle">readiness</text>`;

  // unselected first, so the chosen hosts and their labels sit on top
  for (const p of [...pts].sort((a, b) => cities.indexOf(a.city) - cities.indexOf(b.city))) {
    const slot = cities.indexOf(p.city);
    const on = slot >= 0;
    s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${on ? 7 : 4.5}"
      fill="${on ? slotColour(slot) : c("--ink-3")}" opacity="${on ? 1 : 0.38}"
      stroke="${c("--surface")}" stroke-width="${on ? 2 : 0}">
      <title>${esc(p.city)} · readiness ${p.y.toFixed(1)} · ${fmt(p.x)} visits</title></circle>`;
    if (!on) continue;

    // keep labels off the axes and inside the frame
    const right = X(p.x) > W - pad.r - 100;
    const low = Y(p.y) > Y(0) - 16;
    const lx = right ? X(p.x) - 11 : X(p.x) + 11;
    const ly = low ? Y(p.y) - 13 : Y(p.y) + 4;
    const name = p.city.length > 13 ? p.city.slice(0, 12) + "…" : p.city;
    s += `<text class="cname" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}"
      text-anchor="${right ? "end" : "start"}" style="fill:${slotColour(slot)}">${esc(name)}</text>`;
  }
  s += `</svg>`;
  root.querySelector("#cp-scatter").innerHTML = s;
}

/* --------------------------------------------------------- B. the chart */

function drawSwitch() {
  root.querySelector("#cp-mswitch").innerHTML = MORDER.map(mk => {
    const m = METRICS[mk];
    return `<button data-m="${mk}" class="${metric === mk ? "on" : ""}"
      aria-pressed="${metric === mk}" style="--m:${c(METRIC_COLOR[mk])}">
      ${icon(m.icon, 15)}<span>${m.label}</span></button>`;
  }).join("");
  root.querySelectorAll("#cp-mswitch button").forEach(b => {
    b.onclick = () => { metric = b.dataset.m; drawSwitch(); drawChart(); };
  });
}

function drawChart() {
  const { stats, series } = ctx;
  const cities = setCities();
  const months = series.months;
  const band = stats.band[metric];
  const m = METRICS[metric];

  const W = 1000, H = 320, pad = { l: 76, r: 26, t: 20, b: 40 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const all = cities.flatMap(city => series.cities[city][metric] || []);
  const mx = niceMax(Math.max(...all, ...band.hi.filter(isFinite), 0));
  const X = i => pad.l + (i / (months.length - 1)) * iw;
  const Y = v => pad.t + ih - (v / mx) * ih;

  let s = "";
  for (let i = 0; i < months.length; i++) {
    if (!isSummer(months[i])) continue;
    let j = i;
    while (j + 1 < months.length && isSummer(months[j + 1])) j++;
    const half = iw / (months.length - 1) / 2;
    const x0 = Math.max(pad.l, X(i) - half), x1 = Math.min(W - pad.r, X(j) + half);
    s += `<rect class="win" x="${x0.toFixed(1)}" y="${pad.t}" width="${(x1 - x0).toFixed(1)}" height="${ih}"/>`;
    i = j;
  }
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + ih - (g / 4) * ih;
    s += `<line class="gline" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"/>`;
    s += `<text class="glabel" x="${pad.l - 12}" y="${(y + 4).toFixed(1)}" text-anchor="end">${fmt(mx * g / 4)}</text>`;
  }
  s += `<line class="axis" x1="${pad.l}" y1="${pad.t + ih}" x2="${W - pad.r}" y2="${pad.t + ih}"/>`;
  months.forEach((mo, i) => {
    if (mo.endsWith("-01")) {
      s += `<text class="glabel" x="${X(i).toFixed(1)}" y="${H - 14}" text-anchor="middle">${mo.slice(0, 4)}</text>`;
    }
  });

  s += `<polyline class="median" points="${band.med.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>`;
  cities.forEach((city, i) => {
    const vals = series.cities[city][metric] || [];
    s += `<polyline class="serie" stroke="${slotColour(i)}"
      points="${vals.map((v, j) => `${X(j).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>`;
  });

  s += `<line id="cp-cross" class="axis" x1="0" y1="${pad.t}" x2="0" y2="${pad.t + ih}" opacity="0"/>`;

  const svg = root.querySelector("#cp-chart");
  svg.innerHTML = s;

  root.querySelector("#cp-legend").innerHTML =
    cities.map((city, i) =>
      `<span><i style="background:${slotColour(i)}"></i>${esc(city)}</span>`).join("") +
    `<span><i class="dash"></i>11-host median</span>
     <span><i class="box" style="background:${c("--c-cooling")};opacity:.4"></i>June–July scoring window</span>`;

  const tip = root.querySelector("#cp-tip");
  const box = svg.parentElement;
  const cross = svg.querySelector("#cp-cross");

  svg.onmousemove = ev => {
    const b = svg.getBoundingClientRect();
    const px = ((ev.clientX - b.left) / b.width) * W;
    let i = Math.round(((px - pad.l) / (iw || 1)) * (months.length - 1));
    i = Math.max(0, Math.min(months.length - 1, i));

    cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("opacity", "0.5");
    tip.innerHTML = `<b>${pretty(months[i])}${isSummer(months[i]) ? " · scoring window" : ""}</b>` +
      cities.map((city, n) => `<div class="r">
        <span style="color:${slotColour(n)}">${esc(city)}</span>
        <span>${fmt((series.cities[city][metric] || [])[i])}</span></div>`).join("") +
      `<div class="r"><span>Host median</span><span>${fmt(band.med[i])}</span></div>`;
    tip.style.left = `${(X(i) / W) * box.clientWidth}px`;
    tip.style.top = `${(Y(mx * 0.9) / H) * box.clientHeight}px`;
    tip.classList.add("on");
  };
  svg.onmouseleave = () => { tip.classList.remove("on"); cross.setAttribute("opacity", "0"); };
}

/* ------------------------------------------------------- C. the playbook */

function drawPlaybook() {
  const k = anchor();
  const box = root.querySelector("#cp-plays");
  if (!k) { box.innerHTML = `<div class="empty">Pick a host above.</div>`; return; }

  const plays = k.recommended_plays || [], gen = k.general_options || [];
  root.querySelector("#cp-pbtitle").textContent = `Playbook · ${k.host_city}`;
  root.querySelector("#cp-pbcap").textContent =
    `${plays.length} pressing · modelled on ${k.host_city}'s own totals`;

  box.innerHTML =
    (plays.length
      ? `<div class="plays2">${plays.map(p => playCard(p, k)).join("")}</div>`
      : `<div class="empty">No pressing plays — no driver here sits above the 11-host mean.</div>`) +
    (gen.length
      ? `<details class="pbdetails">
           <summary>${gen.length} general option${gen.length === 1 ? "" : "s"} — available, not pressing for ${esc(k.host_city)}</summary>
           <div class="plays2">${gen.map(p => playCard(p, k)).join("")}</div>
         </details>`
      : "");

  root.querySelector("#cp-exits").innerHTML = `
    <a class="btn" href="data/city_cards/${esc(slug(k.host_city))}.md" download>
      ${icon("download", 15)} ${esc(k.host_city)} one-pager</a>
    <span class="note" style="align-self:center">Closest peers:
      ${(k.peer_cities || []).map(p =>
        `<button class="lnk" data-peer="${esc(p)}">${esc(p)}</button>`).join(" · ")}</span>`;

  root.querySelectorAll("#cp-playbook [data-peer]").forEach(b => {
    b.onclick = () => togglePartner(b.dataset.peer);
  });
}

/**
 * A play card shows what it would move and why it is indicated: the before/after
 * bars are the effect, the target strip is the evidence — how elevated this host
 * actually is on each driver the play acts on.
 */
function playCard(p, k) {
  const e = p.expected_effects || {};
  const abs = k.ops_scale.absolute;

  const bars = EFFECT_METRIC.map(([pctKey, absKey, mk]) => {
    const pct = e[pctKey];
    if (!pct) return "";
    const now = abs[absKey] || 0;
    const after = now * (1 + pct / 100);
    const keep = Math.max(0, Math.min(100, (after / (now || 1)) * 100));
    const col = c(METRIC_COLOR[mk]);
    const m = METRICS[mk];
    return `<div class="pbar">
      <div class="ph">
        <span class="pn">${icon(m.icon, 14)} ${m.label}</span>
        <span class="pd num" style="color:${col}">${pct > 0 ? "+" : "−"}${Math.abs(pct)}%</span>
      </div>
      <div class="ptrack"><span class="pfill" style="width:${keep.toFixed(1)}%;background:${col}"></span></div>
      <div class="pf num">
        <span>${fmt(now)} → <b>${fmt(after)}</b> ${esc(m.unit)}</span>
        <span class="psaved">${fmt(Math.abs(now - after))} ${pct < 0 ? "avoided" : "added"}</span>
      </div>
    </div>`;
  }).join("");

  const targets = (p.targets || []).map(t => {
    const d = k.drivers.find(x => x.key === t);
    if (!d) return "";
    const label = pctLabel(ctx.stats.driverPct(t, d.raw));
    return `<span class="ptag" style="--dc:${c(DRIVER_COLOR[t])}">
      ${icon(DRIVER_ICON[t], 13)} ${PLAIN[t]} <b>${label}</b></span>`;
  }).join("");

  const steal = (p.steal_from_peers || []).length
    ? `<span>Also pressing for ${p.steal_from_peers.map(s =>
        `<button class="lnk" data-peer="${esc(s)}">${esc(s)}</button>`).join(", ")}</span>`
    : "";

  return `<article class="play">
    <h3>${esc(p.title)}</h3>
    <div class="pbars">${bars || `<span class="muted">No quantified effect</span>`}</div>
    ${targets ? `<div class="ptargets">
      <span class="eyebrow">Targets · vs&nbsp;median</span>${targets}</div>` : ""}
    <p class="why">${esc(p.rationale)}</p>
    <div class="foot">
      <span>Owner: ${esc(p.owner)}</span>
      <span>Effort: ${esc(p.effort)}</span>
      ${steal}
    </div>
  </article>`;
}

/** Play x host: which plays are pressing where — the steal-this-play case. */
function drawPlayMatrix() {
  const { stats } = ctx;
  const cards = [...ctx.contract.scorecards].sort((a, b) => a.rank - b.rank);

  // one row per distinct play, ordered by how widely it is pressing
  const rows = new Map();
  for (const k of cards) {
    for (const p of k.recommended_plays || []) {
      const r = rows.get(p.id) || { title: p.title, owner: p.owner, press: new Set(), opt: new Set() };
      r.press.add(k.host_city);
      rows.set(p.id, r);
    }
    for (const p of k.general_options || []) {
      const r = rows.get(p.id) || { title: p.title, owner: p.owner, press: new Set(), opt: new Set() };
      r.opt.add(k.host_city);
      rows.set(p.id, r);
    }
  }
  const list = [...rows.values()].sort((a, b) => b.press.size - a.press.size);

  const box = root.querySelector("#cp-pmatrix");
  box.style.gridTemplateColumns = `minmax(190px, 1.5fr) repeat(${cards.length}, minmax(0, 1fr))`;

  let html = `<span class="pmh" style="text-align:left">Play</span>` +
    cards.map(k => `<span class="pmh ${k.host_city === ctx.state.city ? "on" : ""}"
      title="${esc(k.host_city)} · readiness ${k.readiness_score.toFixed(1)}">#${k.rank}</span>`).join("");

  for (const r of list) {
    html += `<span class="pmt">${esc(r.title)}
      <small>pressing for ${r.press.size} of ${cards.length}</small></span>`;
    for (const k of cards) {
      const city = k.host_city;
      const state = r.press.has(city) ? "press" : r.opt.has(city) ? "opt" : "none";
      const word = state === "press" ? "pressing" : state === "opt" ? "available, not pressing" : "not indicated";
      html += `<button class="pmcell ${city === ctx.state.city ? "col" : ""}" data-anchor="${esc(city)}"
        title="${esc(city)} — ${word}" aria-label="${esc(city)}: ${word}"><b class="${state}"></b></button>`;
    }
  }
  box.innerHTML = html;

  root.querySelectorAll("#cp-pmatrix [data-anchor]").forEach(b => {
    b.onclick = () => setAnchor(b.dataset.anchor);
  });
}
