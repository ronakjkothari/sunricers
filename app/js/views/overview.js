/* Overview — the city dossier.

   Three bands, in reading order:
     A  verdict    a full-bleed banner: who this city is, how it ranks, and why
     B  evidence   footprint tiles, composition, the readiness decomposition,
                   and the year
     C  action     the plays that follow, each showing what it would move

   Every block belongs to exactly one band. Anything that was neither a
   verdict, evidence for it, nor an action from it is not on this page. */

import { fmt, esc, pretty, isSummer, niceMax, ordinal, slug } from "../lib/format.js";
import { icon, DRIVER_ICON } from "../lib/icons.js";
import { c, METRIC_COLOR, DRIVER_COLOR, LAYER_COLOR } from "../lib/palette.js";
import { METRIC_ABS, verdict, rankLabel, pctLabel, polarRank } from "../lib/stats.js";

const METRICS = {
  v: { label: "Visits", unit: "visits", icon: "visits", input: true },
  e: { label: "Energy", unit: "kWh", icon: "energy" },
  w: { label: "Water", unit: "L", icon: "water" },
  co2: { label: "CO₂e", unit: "kg CO₂e", icon: "carbon" },
};
const ORDER = ["v", "e", "w", "co2"];

/** Human-scale equivalences. The only way billions become imaginable. */
const EQUIV = {
  e: (v, n) => `≈ ${fmt(v / n / 900)} homes powered for a month`,
  w: (v, n) => `≈ ${fmt(v / n / 9000)} people's monthly water use`,
  co2: (v, n) => `≈ ${fmt(v / n / 4600)} cars driven for a year`,
  v: (v, n) => `≈ ${fmt(v / n)} store visits a month`,
};

const PLAIN_DRIVER = {
  energy_kwh: "Energy use",
  kg_co2e: "Food carbon",
  water_liters: "Water use",
  cdd: "Cooling demand",
  uhi: "Urban heat",
};

/** Play effect key -> the absolute it moves, and the metric colour to use. */
const EFFECT_METRIC = [
  ["energy_pct", "energy_kwh", "e"],
  ["water_pct", "water_liters", "w"],
  ["food_co2e_pct", "kg_co2e", "co2"],
];

/* Focusing a driver narrows the whole page to it. Two drivers — cooling demand
   and urban heat — are climate amplifiers with no footprint tile and no visit
   layer of their own, so those panels stay as they are rather than dimming to
   nothing; the decomposition and the plays still narrow. */
export const DRIVER_METRIC = { energy_kwh: "e", water_liters: "w", kg_co2e: "co2" };
export const DRIVER_LAYER = { energy_kwh: "Energy", water_liters: "Water", kg_co2e: "Food" };

const SPARK = { W: 240, H: 58, padT: 7, padB: 15 };

let root = null;
let ctx = null;
let lqip = {};
let observer = null;

/* ---------------------------------------------------------------- mount */

export function mount(el, context) {
  root = el;
  ctx = context;
  root.innerHTML = `
    <section class="card panel allhosts" id="ov-all" hidden>
      <header>
        <h2>All 11 hosts</h2>
        <span class="chip">June–July, summed</span>
        <span class="sp"></span>
      </header>
      <div class="body">
        <p class="note" style="max-width:80ch">The eleven hosts' summer footprint added together. Readiness is relative,
          so it only exists per host: pick one below for its rank, drivers and plays. The map and the intervention lab
          work on all eleven at once.</p>
        <div class="allkpis" id="ov-all-kpis"></div>
        <div class="eyebrow" style="margin-bottom:8px">Pick a host</div>
        <div class="citygrid" id="ov-all-grid"></div>
      </div>
    </section>
    <div class="stickybar bleed" id="ov-sticky" hidden></div>

    <header class="banner bleed" id="ov-banner"></header>
    <div id="ov-sentinel" class="bleed" style="height:1px"></div>

    <div class="secthead">
      <div class="shtxt">
        <h2>Summer footprint</h2>
        <p id="ov-kpicap"></p>
      </div>
      <div class="focusbar" id="ov-focus" hidden></div>
    </div>
    <div class="kpirow" id="ov-kpis"></div>
    <section class="card mix" id="ov-mix"></section>

    <section class="card panel" id="ov-why">
      <header>
        <h2>Why it ranks here</h2>
        <span class="sp"></span>
        <button class="info" id="ov-methods" aria-label="How readiness is scored">${icon("info", 14)}</button>
      </header>
      <div class="decomp" id="ov-decomp"></div>
      <div class="pop" id="ov-pop" hidden></div>
    </section>

    <section class="card panel">
      <header>
        <h2>Footprint through the year</h2>
        <span class="sp"></span>
        <div class="mswitch" id="ov-mswitch" role="group" aria-label="Chart metric"></div>
      </header>
      <div class="chartwrap">
        <svg id="ov-chart" viewBox="0 0 1000 320" role="img"
             aria-label="Monthly footprint against the 11-host median"></svg>
        <div class="tip" id="ov-tip"></div>
      </div>
      <div class="chartlegend" id="ov-legend"></div>
    </section>

    <section class="card panel">
      <header>
        <h2>What to do about it</h2>
        <span class="sp"></span>
        <span class="eyebrow" id="ov-playcap"></span>
      </header>
      <div class="plays" id="ov-plays"></div>
      <div class="exits" id="ov-exits"></div>
    </section>`;

  fetch("assets/img/lqip.json")
    .then(r => (r.ok ? r.json() : {}))
    .then(d => { lqip = d; drawBanner(); drawSticky(); })
    .catch(() => { /* blur-up is a nicety, not a requirement */ });

  root.querySelector("#ov-methods").onclick = toggleMethods;
  document.addEventListener("click", onDocClick);
  armSticky();
}

export function update(context) {
  ctx = context;
  const all = ctx.isAll();
  root.classList.toggle("allmode", all);
  root.querySelector("#ov-all").hidden = !all;
  if (all) { drawAllHosts(); return; }
  drawBanner();
  drawSticky();
  drawFocus();
  drawKpis();
  drawMix();
  drawDecomp();
  drawSwitch();
  drawSeries();
  drawPlays();
}

/**
 * Focus one readiness driver, or clear it. Every panel narrows to it, so the
 * page reads as one answer rather than five independent ones. Clicking the
 * focused driver again clears back to all drivers.
 */
function setDriver(key) {
  const next = ctx.state.driver === key ? null : key;
  ctx.state.driver = next;
  // a focused driver that maps to a footprint metric also steers the chart
  const mk = next && DRIVER_METRIC[next];
  if (mk) ctx.state.metric = mk;

  drawFocus();
  drawKpis();
  drawMix();
  drawDecomp();
  drawSwitch();
  drawSeries();
  drawPlays();
}

function drawFocus() {
  const bar = root.querySelector("#ov-focus");
  const key = ctx.state.driver;
  if (!key) { bar.hidden = true; bar.innerHTML = ""; return; }

  bar.hidden = false;
  bar.innerHTML = `
    <span class="fl" style="--dc:${c(DRIVER_COLOR[key])}">
      ${icon(DRIVER_ICON[key], 15)} Focused on <b>${PLAIN_DRIVER[key]}</b>
    </span>
    <button class="fclear" id="ov-clearfocus">${icon("close", 13)} Show all drivers</button>`;
  root.querySelector("#ov-clearfocus").onclick = () => setDriver(key);
}

function onDocClick(ev) {
  const pop = root.querySelector("#ov-pop");
  if (pop && !pop.hidden && !pop.contains(ev.target) && !ev.target.closest("#ov-methods")) {
    pop.hidden = true;
  }
  const menu = root.querySelector("#ov-citymenu");
  if (menu && !menu.hidden && !menu.contains(ev.target) && !ev.target.closest(".citypick")) {
    menu.hidden = true;
  }
}

/* ------------------------------------------------------------- helpers */

const card = () => ctx.stats.byCity[ctx.state.city];
const photo = (city, size) => `assets/img/${imgSlug(city)}-${size}.webp`;

const IMG_SLUG = {
  "New York/New Jersey": "new-york",
  "San Francisco Bay Area": "san-francisco",
  "Kansas City": "kansas-city",
  "Los Angeles": "los-angeles",
};
const imgSlug = city => IMG_SLUG[city] || city.toLowerCase().replace(/[^a-z]+/g, "-");

const scoreColour = s => (s < 33 ? c("--c-energy") : s < 66 ? c("--c-cooling") : c("--c-water"));

/* ------------------------------------------------------ A. the banner */

function drawBanner() {
  const k = card();
  if (!k) return;
  const { stats } = ctx;

  root.querySelector("#ov-banner").innerHTML = `
    <div class="bmedia">
      <img class="bphoto" src="${photo(k.host_city, 1200)}" alt=""
           width="1200" height="800" onload="this.classList.add('in')"
           style="background-image:url('${lqip[k.host_city] || ""}')">
      <div class="bscrim"></div>
    </div>

    <div class="binner">
      <div class="btop">
        <span class="brank">${icon("rank", 14)} #${k.rank} of ${stats.n} · ${rankLabel(k, stats.n)}</span>
        <div class="pickwrap">
          <button class="citypick" id="ov-citypick" aria-haspopup="true" aria-expanded="false">
            <span>Switch host city</span>${icon("chevDown", 16)}
          </button>
          <div class="citymenu" id="ov-citymenu" hidden></div>
        </div>
      </div>

      <div class="bmain">
        <div class="bwho">
          <h1>${esc(k.host_city)}</h1>
          <p class="bsay">${verdict(k, stats.n)}</p>
        </div>
        ${gauge(k.readiness_score, k.readiness_band)}
      </div>
    </div>`;

  root.querySelector("#ov-citypick").onclick = ev => {
    ev.stopPropagation();
    const menu = root.querySelector("#ov-citymenu");
    const opening = menu.hidden;
    if (opening) drawCityMenu();
    menu.hidden = !opening;
    root.querySelector("#ov-citypick").setAttribute("aria-expanded", String(opening));
  };
}

/** The eleven hosts, revealed only on demand — a grid, so nothing scrolls sideways. */
function drawCityMenu() {
  const { stats, state } = ctx;
  const menu = root.querySelector("#ov-citymenu");
  menu.innerHTML = cityOptions(true);
  menu.querySelectorAll(".cityopt").forEach(b => {
    b.onclick = () => { menu.hidden = true; ctx.setCity(b.dataset.city); };
  });
}

/** the eleven hosts by rank, optionally with "All 11 hosts" on top */
function cityOptions(withAll) {
  const { stats, state } = ctx;
  const all = withAll
    ? `<button class="cityopt all ${state.city === ctx.ALL ? "on" : ""}" data-city="${ctx.ALL}">
        <span class="con"><span class="cn">All 11 hosts</span></span></button>`
    : "";
  return all + [...stats.cities]
    .sort((a, b) => stats.byCity[a].rank - stats.byCity[b].rank)
    .map(city => {
      const k = stats.byCity[city];
      return `<button class="cityopt ${city === state.city ? "on" : ""}" data-city="${esc(city)}">
        <img src="${photo(city, 320)}" alt="" loading="lazy" width="320" height="214">
        <span class="con">
          <span class="cn">${esc(city)}</span>
          <span class="cr">#${k.rank} · readiness ${k.readiness_score.toFixed(1)}</span>
        </span>
      </button>`;
    }).join("");
}

/** "All 11 hosts": the summed footprint and a grid to pick one host. */
function drawAllHosts() {
  const abs = ctx.absolutes(), n = ctx.stats.summerIdx.length;
  root.querySelector("#ov-all-kpis").innerHTML = ORDER.map(mk => {
    const m = METRICS[mk], v = abs[METRIC_ABS[mk]] || 0;
    return `<div class="akpi">
      <span class="ak">${icon(m.icon, 14)} ${m.label}</span>
      <span class="av num" style="color:${c(METRIC_COLOR[mk])}">${fmt(v)}</span>
      <span class="au">${esc(m.unit)} over June–July, all hosts</span>
      <span class="ae">${EQUIV[mk](v, n)}</span>
    </div>`;
  }).join("");
  const grid = root.querySelector("#ov-all-grid");
  grid.innerHTML = cityOptions(false);
  grid.querySelectorAll(".cityopt").forEach(b => { b.onclick = () => ctx.setCity(b.dataset.city); });
}

/** Readiness arc. The band is drawn faintly and only named on hover. */
function gauge(score, band) {
  const cx = 100, cy = 106, r = 80;
  const pt = v => {
    const a = Math.PI - (Math.max(0, Math.min(100, v)) / 100) * Math.PI;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arc = (v1, v2) => {
    const [x1, y1] = pt(v1), [x2, y2] = pt(v2);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const col = scoreColour(score);

  // Hovering the score reveals the range it could plausibly sit in — more use
  // than a native tooltip and a question-mark cursor on a number you can't click.
  return `<div class="gauge" tabindex="0"
      aria-label="Readiness ${score.toFixed(1)} of 100, likely between ${band[0].toFixed(0)} and ${band[1].toFixed(0)}">
    <svg viewBox="0 0 200 120" aria-hidden="true">
      <path d="${arc(0, 100)}" fill="none" stroke="rgba(255,255,255,.24)" stroke-width="13" stroke-linecap="round"/>
      <path d="${arc(band[0], band[1])}" fill="none" stroke="${col}" stroke-width="13"
            stroke-linecap="round" opacity="0.34"/>
      <path d="${arc(0, score)}" fill="none" stroke="${col}" stroke-width="13" stroke-linecap="round"/>
    </svg>
    <div class="gv num">${score.toFixed(1)}</div>
    <div class="gl">Readiness</div>
    <div class="gb">likely ${band[0].toFixed(0)}–${band[1].toFixed(0)}</div>
  </div>`;
}

/* --------------------------------------- A. the sticky condensed header */

function armSticky() {
  const sentinel = root.querySelector("#ov-sentinel");
  const bar = root.querySelector("#ov-sticky");
  if (!sentinel || !bar || typeof IntersectionObserver !== "function") return;
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(([e]) => { bar.hidden = e.isIntersecting; });
  observer.observe(sentinel);
}

function drawSticky() {
  const k = card();
  if (!k) return;
  root.querySelector("#ov-sticky").innerHTML = `
    <img src="${photo(k.host_city, 320)}" alt="" width="320" height="214">
    <b>${esc(k.host_city)}</b>
    <span class="chip">#${k.rank} of ${ctx.stats.n}</span>
    <span class="sp"></span>
    <span class="sready">
      <em class="num" style="color:${scoreColour(k.readiness_score)}">${k.readiness_score.toFixed(1)}</em>
      readiness
    </span>`;
}

/* ---------------------------------------------------- B. the KPI tiles */

function drawKpis() {
  const k = card();
  const { stats, state } = ctx;
  const abs = k.ops_scale.absolute;
  const n = stats.summerIdx.length;

  // The absolutes are what a city must provision; the rate is what readiness
  // ranks on. Stating that bridge here is what stops "8th largest" beside
  // "#10 of 11" reading as a contradiction. June–July is named once, here.
  const sizeRank = stats.rankOf.v[k.host_city];
  root.querySelector("#ov-kpicap").textContent =
    `June–July totals. ${k.host_city} is the ${polarRank(sizeRank, stats.n, "largest", "smallest")} ` +
    `of the ${stats.n} hosts by volume; each chip ranks the rate per trading shop-month, ` +
    `which is what readiness scores.`;

  root.querySelector("#ov-kpis").innerHTML = ORDER.map(mk => {
    const m = METRICS[mk];
    const v = abs[METRIC_ABS[mk]] || 0;
    const col = c(METRIC_COLOR[mk]);
    const focusMk = state.driver ? DRIVER_METRIC[state.driver] : null;
    const dim = focusMk && focusMk !== mk;
    const rate = stats.rateRankOf[mk] && stats.rateRankOf[mk][k.host_city];
    const tone = rate <= Math.ceil(stats.n / 3) ? "up" : "down";
    const chip = rate
      ? `<span class="chip ${tone}">${polarRank(rate, stats.n, "highest rate", "lowest rate")} of ${stats.n}</span>`
      : `<span class="chip down">${polarRank(sizeRank, stats.n, "largest", "smallest")} of ${stats.n}</span>`;

    return `<button class="kpi ${state.metric === mk ? "on" : ""} ${m.input ? "input" : ""} ${dim ? "dim" : ""}"
        data-m="${mk}" style="--m:${col}" aria-pressed="${state.metric === mk}">
      <span class="top">
        <span class="ic">${icon(m.icon, 18)}</span>
        <span class="lbl">${m.label}</span>
      </span>
      <span class="val num">${fmt(v)}<span class="u">${m.unit}</span></span>
      <span class="peer">${chip}</span>
      ${spark(mk, col)}
      <span class="eq">${EQUIV[mk](v, n)}</span>
    </button>`;
  }).join("");

  root.querySelectorAll("#ov-kpis .kpi").forEach(b => {
    b.onclick = () => setMetric(b.dataset.m);
    armSpark(b);
  });
}

/**
 * Trend sparkline with the 11-host median drawn behind it, so the tile shows
 * not only this city's shape but its shape relative to everyone else.
 */
function spark(mk, col) {
  const { series, stats, state } = ctx;
  const vals = series.cities[state.city][mk] || [];
  const med = stats.band[mk].med;
  if (!vals.length) return `<span class="spark"></span>`;

  const { W, H, padT, padB } = SPARK;
  const all = vals.concat(med).filter(isFinite);
  const mn = Math.min(...all), rng = (Math.max(...all) - mn) || 1;
  const X = i => (i / (vals.length - 1)) * W;
  const Y = v => padT + (1 - (v - mn) / rng) * (H - padT - padB);
  const line = a => a.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");

  const ticks = series.months.map((m, i) => (m.endsWith("-01")
    ? `<text class="stick" x="${X(i).toFixed(1)}" y="${H - 3}" text-anchor="middle">${m.slice(0, 4)}</text>`
    : "")).join("");

  return `<span class="spark">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="0,${H - padB} ${line(vals)} ${W},${H - padB}" fill="${col}" opacity="0.13"/>
      <polyline class="smed" points="${line(med)}"/>
      <polyline points="${line(vals)}" fill="none" stroke="${col}" stroke-width="1.9"
        vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      ${ticks}
      <line class="scross" x1="0" y1="${padT}" x2="0" y2="${H - padB}" opacity="0"/>
      <circle class="sdot" r="3.2" fill="${col}" opacity="0"/>
    </svg>
    <span class="stip"></span>
  </span>`;
}

function armSpark(tile) {
  const mk = tile.dataset.m;
  const svg = tile.querySelector(".spark svg");
  const tip = tile.querySelector(".stip");
  if (!svg || !tip) return;

  const { series, stats, state } = ctx;
  const vals = series.cities[state.city][mk] || [];
  const med = stats.band[mk].med;
  const cross = svg.querySelector(".scross"), dot = svg.querySelector(".sdot");
  const { W, H, padT, padB } = SPARK;
  const all = vals.concat(med).filter(isFinite);
  const mn = Math.min(...all), rng = (Math.max(...all) - mn) || 1;

  svg.addEventListener("mousemove", ev => {
    const b = svg.getBoundingClientRect();
    let i = Math.round(((ev.clientX - b.left) / b.width) * (vals.length - 1));
    i = Math.max(0, Math.min(vals.length - 1, i));
    const x = (i / (vals.length - 1)) * W;
    const y = padT + (1 - (vals[i] - mn) / rng) * (H - padT - padB);

    cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("opacity", "0.55");
    dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("opacity", "1");
    tip.innerHTML = `<b>${pretty(series.months[i])}</b>${fmt(vals[i])}
      <span class="sm">median ${fmt(med[i])}</span>`;
    tip.style.left = `${(i / (vals.length - 1)) * 100}%`;
    tip.classList.add("on");
  });
  svg.addEventListener("mouseleave", () => {
    tip.classList.remove("on");
    cross.setAttribute("opacity", "0");
    dot.setAttribute("opacity", "0");
  });
}

function setMetric(mk) {
  ctx.state.metric = mk;
  // choosing a different metric by hand contradicts the focused driver, so
  // rather than leaving the focus chip lying about it, clear it
  if (ctx.state.driver && DRIVER_METRIC[ctx.state.driver] !== mk) {
    ctx.state.driver = null;
    drawFocus();
    drawMix();
    drawDecomp();
    drawPlays();
  }
  drawKpis();
  drawSwitch();
  drawSeries();
}

/* ------------------------------------------------ B. composition strip */

function drawMix() {
  const k = card();
  const mix = Object.entries(k.ops_scale.visit_mix).filter(([, v]) => v >= 0.005)
    .sort((a, b) => b[1] - a[1]);
  const focusLayer = ctx.state.driver ? DRIVER_LAYER[ctx.state.driver] : null;
  const faded = key => (focusLayer && key !== focusLayer ? " dim" : "");

  root.querySelector("#ov-mix").innerHTML = `
    <div class="mh">
      <h3>What that footprint is made of</h3>
      <span>share of store visits</span>
    </div>
    <div class="mixbar">
      ${mix.map(([key, v]) => `<span class="${faded(key).trim()}"
          style="width:${(v * 100).toFixed(2)}%;background:${c(LAYER_COLOR[key] || "--c-other")}"
          title="${esc(key)} ${(v * 100).toFixed(1)}%"></span>`).join("")}
    </div>
    <div class="mixkey">
      ${mix.map(([key, v]) => `<span class="${faded(key).trim()}"><i style="background:${c(LAYER_COLOR[key] || "--c-other")}"></i>
        ${esc(key.replace("_EFW", ""))} <b>${(v * 100).toFixed(v * 100 < 1 ? 1 : 0)}%</b></span>`).join("")}
    </div>`;
}

/* ----------------------------------------------------- B. why it ranks */

function drawDecomp() {
  const k = card();
  const { stats, state } = ctx;
  const contrib = stats.contributions(k).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const neutral = stats.neutralReadiness;

  const rows = contrib.map(d => {
    const s = stats.driverStats[d.key];
    const col = c(DRIVER_COLOR[d.key]);
    const pct = stats.driverPct(d.key, d.raw);
    const label = pctLabel(pct);
    const tone = label === "at median" ? c("--ink-3") : pct > 0 ? c("--v-up") : c("--v-down");
    const span = (s.max - s.min) || 1;
    const posOf = v => ((v - s.min) / span) * 100;
    const mid = posOf(s.median), me = posOf(d.raw);
    const lo = Math.min(mid, me), w = Math.abs(me - mid);
    const pts = stats.points(d.value);
    const on = state.driver === d.key;

    return `<div class="drow ${on ? "on" : ""} ${state.driver && !on ? "dim" : ""}"
        data-key="${d.key}" style="--dc:${col}">
      <button class="dmain" data-focus="${d.key}" aria-pressed="${on}">
        <span class="di">${icon(DRIVER_ICON[d.key], 17)}</span>
        <span class="dn">${PLAIN_DRIVER[d.key] || esc(d.label)}</span>
        <span class="bullet">
          <span class="mid" style="left:${mid.toFixed(1)}%"></span>
          <i style="left:${lo.toFixed(1)}%;width:${Math.max(1.5, w).toFixed(1)}%"></i>
        </span>
        <span class="dv" style="color:${tone}">${label}</span>
        <span class="dpts num" style="color:${pts < 0 ? c("--v-up") : c("--v-down")}">${pts > 0 ? "+" : "−"}${Math.abs(pts).toFixed(1)}</span>
      </button>
      <button class="dgo" data-compare="${d.key}"
        aria-label="Compare every host elevated on ${PLAIN_DRIVER[d.key]}"
        title="See every host elevated on this">${icon("chev", 15)}</button>
    </div>`;
  }).join("");

  root.querySelector("#ov-decomp").innerHTML = `
    <div class="wf">
      <p class="cap">A host sitting at the 11-host average on every driver would score
        <b>${neutral.toFixed(1)}</b>. These are the readiness points each driver moves
        ${esc(k.host_city)} from there.</p>
      ${waterfall(contrib, k, neutral)}
    </div>
    <div class="rows">
      <div class="dhead">
        <span></span><span>Driver</span><span></span>
        <span>vs median</span><span>points</span><span></span>
      </div>
      ${rows}
      <p class="cap foot">The tick is the 11-host median. Click a driver to highlight it;
        the arrow opens every host elevated on it.</p>
    </div>`;

  root.querySelectorAll("#ov-decomp [data-focus]").forEach(b => {
    b.onclick = () => setDriver(b.dataset.focus);
  });
  root.querySelectorAll("#ov-decomp [data-compare]").forEach(b => {
    b.onclick = ev => { ev.stopPropagation(); ctx.goCompare(b.dataset.compare); };
  });
}

/**
 * Waterfall in readiness points: start at the neutral score, step through each
 * driver's weighted contribution, land on this host's readiness. Because
 * readiness is a linear rescale of the stress index those steps land exactly —
 * test_shell.js asserts it — which is what makes this panel answer "why 12.4".
 */
function waterfall(contrib, k, neutral) {
  const W = 400, H = 244, padT = 26, padB = 48, padL = 58, cols = contrib.length + 1;
  const slot = (W - padL) / cols, bw = Math.min(34, slot * 0.56);
  const { stats, state } = ctx;

  const running = [];
  let acc = neutral;
  for (const d of contrib) {
    const p = stats.points(d.value);
    running.push([acc, acc + p]);
    acc += p;
  }

  // The domain follows the steps, not zero. Houston's drivers move it by only
  // a few points each; anchoring at zero flattened every step onto the baseline
  // and collided their labels.
  const all = [neutral, k.readiness_score, ...running.flat()];
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = Math.max((hi - lo) * 0.22, 4);
  const y0 = lo - pad, y1 = hi + pad;
  const Y = v => padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB);
  const floor = Y(y0);   // the total column rests on the plot floor, not on 0

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Readiness points contributed by each driver">`;

  s += `<line x1="${padL - 6}" y1="${Y(neutral).toFixed(1)}" x2="${W}" y2="${Y(neutral).toFixed(1)}"
    stroke="${c("--line-2")}" stroke-width="1" stroke-dasharray="3 3"/>`;
  // Houston's net is ~0, so its score label lands on the baseline. Keeping this
  // caption in a reserved margin is what stops the two colliding.
  s += `<text class="wfoot" x="0" y="${(Y(neutral) - 5).toFixed(1)}">host</text>`;
  s += `<text class="wfoot" x="0" y="${(Y(neutral) + 8).toFixed(1)}">avg ${neutral.toFixed(0)}</text>`;

  contrib.forEach((d, i) => {
    const [a, b] = running[i];
    const top = Y(Math.max(a, b)), bot = Y(Math.min(a, b));
    const x = padL + i * slot + (slot - bw) / 2;
    const col = c(DRIVER_COLOR[d.key]);
    const dim = state.driver && state.driver !== d.key;
    const p = stats.points(d.value);

    s += `<g class="wfcol" data-key="${d.key}" opacity="${dim ? 0.25 : 1}">
      <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw}"
        height="${Math.max(3, bot - top).toFixed(1)}" rx="4" fill="${col}"
        opacity="${d.elevated ? 0.95 : 0.5}"/>
      <text class="wlab" x="${(x + bw / 2).toFixed(1)}"
        y="${(p >= 0 ? top - 8 : bot + 15).toFixed(1)}" text-anchor="middle"
        style="fill:${col}">${p > 0 ? "+" : "−"}${Math.abs(p).toFixed(1)}</text>
      <g transform="translate(${(x + bw / 2 - 8).toFixed(1)} ${H - 36})"
         style="color:${col}">${icon(DRIVER_ICON[d.key], 16)}</g>
    </g>`;

    if (i < contrib.length - 1) {
      const nx = padL + (i + 1) * slot + (slot - bw) / 2;
      s += `<line x1="${(x + bw).toFixed(1)}" y1="${Y(b).toFixed(1)}" x2="${nx.toFixed(1)}"
        y2="${Y(b).toFixed(1)}" stroke="${c("--line-2")}" stroke-width="1" stroke-dasharray="2 2"/>`;
    }
  });

  const tx = padL + (cols - 1) * slot + (slot - bw) / 2;
  const score = k.readiness_score;
  const tTop = Y(score);
  s += `<rect x="${tx.toFixed(1)}" y="${tTop.toFixed(1)}" width="${bw}"
    height="${Math.max(3, floor - tTop).toFixed(1)}" rx="4" fill="${c("--ink")}"/>`;
  s += `<text class="wlab" x="${(tx + bw / 2).toFixed(1)}" y="${(tTop - 8).toFixed(1)}"
    text-anchor="middle" style="fill:${c("--ink")};font-weight:700">${score.toFixed(1)}</text>`;
  s += `<text class="wfoot" x="${(tx + bw / 2).toFixed(1)}" y="${H - 24}"
    text-anchor="middle">score</text>`;
  s += `</svg>`;
  return s;
}

/* ------------------------------------------------------- B. the chart */

function drawSwitch() {
  const { state } = ctx;
  root.querySelector("#ov-mswitch").innerHTML = ORDER.map(mk => {
    const m = METRICS[mk];
    return `<button data-m="${mk}" class="${state.metric === mk ? "on" : ""}"
      aria-pressed="${state.metric === mk}" style="--m:${c(METRIC_COLOR[mk])}">
      ${icon(m.icon, 15)}<span>${m.label}</span></button>`;
  }).join("");
  root.querySelectorAll("#ov-mswitch button").forEach(b => {
    b.onclick = () => setMetric(b.dataset.m);
  });
}

function drawSeries() {
  const k = card();
  const { stats, series, state } = ctx;
  const mk = state.metric, m = METRICS[mk];
  const months = series.months;
  const vals = series.cities[k.host_city][mk] || [];
  const bandData = stats.band[mk];
  const col = c(METRIC_COLOR[mk]);

  const W = 1000, H = 320, pad = { l: 76, r: 26, t: 20, b: 40 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const mx = niceMax(Math.max(...vals, ...bandData.hi.filter(isFinite), 0));
  const X = i => pad.l + (months.length < 2 ? 0 : (i / (months.length - 1)) * iw);
  const Y = v => pad.t + ih - (v / mx) * ih;

  let s = "";

  for (let i = 0; i < months.length; i++) {
    if (!isSummer(months[i])) continue;
    let j = i;
    while (j + 1 < months.length && isSummer(months[j + 1])) j++;
    const half = months.length > 1 ? iw / (months.length - 1) / 2 : 4;
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

  const up = bandData.hi.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const dn = bandData.lo.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).reverse();
  s += `<polygon class="iqr" points="${up.concat(dn).join(" ")}"/>`;
  s += `<polyline class="median" points="${bandData.med.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>`;
  s += `<polyline class="serie" stroke="${col}" points="${vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>`;

  s += `<line id="ov-cross" class="axis" x1="0" y1="${pad.t}" x2="0" y2="${pad.t + ih}" opacity="0"/>`;
  s += `<circle id="ov-dot" r="4.5" fill="${col}" stroke="${c("--surface")}" stroke-width="2.5" opacity="0"/>`;

  const svg = root.querySelector("#ov-chart");
  svg.innerHTML = s;

  root.querySelector("#ov-legend").innerHTML = `
    <span><i style="background:${col}"></i>${esc(k.host_city)} · ${esc(m.unit)}</span>
    <span><i class="dash"></i>11-host median</span>
    <span><i class="box" style="background:${c("--ink-3")};opacity:.32"></i>middle half of hosts</span>
    <span><i class="box" style="background:${c("--c-cooling")};opacity:.4"></i>June–July scoring window</span>`;

  const tip = root.querySelector("#ov-tip");
  const box = svg.parentElement;
  const cross = svg.querySelector("#ov-cross"), dot = svg.querySelector("#ov-dot");
  const cols = stats.cities.map(city => series.cities[city][mk] || []);

  svg.onmousemove = ev => {
    const b = svg.getBoundingClientRect();
    const px = ((ev.clientX - b.left) / b.width) * W;
    let i = Math.round(((px - pad.l) / (iw || 1)) * (months.length - 1));
    i = Math.max(0, Math.min(months.length - 1, i));

    const here = vals[i];
    const rank = cols.map(a => a[i]).filter(isFinite).sort((a, z) => z - a).indexOf(here) + 1;

    cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("opacity", "0.5");
    dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(here)); dot.setAttribute("opacity", "1");

    tip.innerHTML = `<b>${pretty(months[i])}${isSummer(months[i]) ? " · scoring window" : ""}</b>
      <div class="r"><span>${esc(k.host_city)}</span><span>${fmt(here)}</span></div>
      <div class="r"><span>Host median</span><span>${fmt(bandData.med[i])}</span></div>
      <div class="r"><span>Rank</span><span>${rank ? ordinal(rank) + " of " + stats.n : "—"}</span></div>`;
    tip.style.left = `${(X(i) / W) * box.clientWidth}px`;
    tip.style.top = `${(Y(here) / H) * box.clientHeight - 12}px`;
    tip.classList.add("on");
  };
  svg.onmouseleave = () => {
    tip.classList.remove("on");
    cross.setAttribute("opacity", "0");
    dot.setAttribute("opacity", "0");
  };
}

/* ------------------------------------------------------- C. the plays */

function drawPlays() {
  const k = card();
  const focus = ctx.state.driver;
  const all = k.recommended_plays || [];
  // D tags every play with the drivers it targets, so a focused driver narrows
  // the recommendations to the ones that actually act on it
  const plays = (focus ? all.filter(p => (p.targets || []).includes(focus)) : all).slice(0, 2);
  const box = root.querySelector("#ov-plays");

  root.querySelector("#ov-playcap").textContent = plays.length
    ? (focus ? `targeting ${PLAIN_DRIVER[focus].toLowerCase()}` : `modelled on ${k.host_city}'s own totals`)
    : "";

  box.innerHTML = plays.length
    ? plays.map(p => playCard(p, k)).join("")
    : `<div class="empty" style="grid-column:1/-1">${focus
        ? `No recommended play for ${esc(k.host_city)} targets <b>${PLAIN_DRIVER[focus].toLowerCase()}</b>.
           ${all.length ? "Clear the focus to see the plays that are indicated." : ""}`
        : `No pressing plays for ${esc(k.host_city)} — no driver here sits above the 11-host mean.
           The full catalogue is on Compare.`}</div>`;

  box.querySelectorAll("[data-peer]").forEach(b => {
    b.onclick = () => ctx.setCity(b.dataset.peer);
  });

  root.querySelector("#ov-exits").innerHTML = `
    <button class="btn primary" id="ov-go-compare">${icon("book", 15)} Open the full playbook</button>
    <button class="btn" id="ov-go-map">${icon("map", 15)} See ${esc(k.host_city)} on the map</button>
    <a class="btn" href="data/city_cards/${esc(slug(k.host_city))}.md" download>
      ${icon("download", 15)} One-pager</a>`;
  root.querySelector("#ov-go-compare").onclick = () => ctx.goCompare(null);
  root.querySelector("#ov-go-map").onclick = () => ctx.setTab("spatial");
}

/**
 * A play card shows the move, not just the delta: for each resource it touches,
 * a bar of the city's current summer total with the avoided share carved out of
 * it, so the size of the intervention is visible rather than inferred.
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

  const steal = (p.steal_from_peers || []).length
    ? `<span>Also indicated for
        ${p.steal_from_peers.map(s => `<button class="lnk" data-peer="${esc(s)}">${esc(s)}</button>`).join(", ")}</span>`
    : "";

  return `<article class="play">
    <h3>${esc(p.title)}</h3>
    <div class="pbars">${bars || `<span class="muted">No quantified effect</span>`}</div>
    <p class="why">${esc(p.rationale)}</p>
    <div class="foot"><span>Owner: ${esc(p.owner)}</span>${steal}</div>
  </article>`;
}

/* ------------------------------------------------------ methods popover */

function toggleMethods(ev) {
  ev.stopPropagation();
  const pop = root.querySelector("#ov-pop");
  if (!pop.hidden) { pop.hidden = true; return; }

  const f = ctx.contract.meta.formula;
  const w = ctx.stats.weights;
  pop.innerHTML = `
    <h4>How readiness is scored</h4>
    <p>Each host's June–July rates become z-scores across the eleven hosts, weighted,
       and summed into a stress index. That index is inverted and rescaled so the
       least-pressured host scores 100 and the most-pressured 0 — a linear map, which
       is why each driver's push can be shown directly in readiness points.</p>
    <dl>
      ${Object.entries(w).map(([k2, v]) =>
        `<dt>${PLAIN_DRIVER[k2] || k2}</dt><dd>${(v * 100).toFixed(0)}% of the score</dd>`).join("")}
      <dt>Window</dt><dd>${esc(f.window || "June–July")}</dd>
      <dt>Uncertainty</dt><dd>±${((f.uncertainty_pct || 0.15) * 100).toFixed(0)} points</dd>
    </dl>
    <p style="margin-top:12px;font-size:12.5px;color:var(--ink-3)">
      Readiness uses per-shop-month rates, so a large city is not ranked as pressured
      simply for being large. The tiles above are citywide absolutes — the load a city
      actually has to provision.</p>`;

  const btn = root.querySelector("#ov-methods");
  const host = root.querySelector("#ov-why");
  const br = btn.getBoundingClientRect(), hr = host.getBoundingClientRect();
  pop.hidden = false;
  pop.style.top = `${br.bottom - hr.top + 10}px`;
  pop.style.right = `${hr.right - br.right}px`;
}
