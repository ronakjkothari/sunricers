/* Compare hosts — Plan D's surface.

   Ported onto the new card language so it sits beside the rebuilt Overview
   without looking broken. The full redesign (photo tiles, cost/impact play
   ranking) comes after the Overview is signed off. */

import { fmt, full, esc, slug } from "../lib/format.js";
import { icon, DRIVER_ICON } from "../lib/icons.js";
import { c, DRIVER_COLOR } from "../lib/palette.js";
import { pctLabel } from "../lib/stats.js";

const PLAIN = {
  energy_kwh: "Energy use", kg_co2e: "Food carbon", water_liters: "Water use",
  cdd: "Cooling demand", uhi: "Urban heat",
};
const DRIVERS = ["energy_kwh", "kg_co2e", "water_liters", "cdd", "uhi"];

let root = null, ctx = null;

export function mount(el, context) {
  root = el;
  ctx = context;
  root.innerHTML = `
    <section class="card panel" style="margin-top:0">
      <header>
        <h2>Readiness across the 11 hosts</h2>
        <span class="chip">0–100 · higher means less summer pressure</span>
        <span class="sp"></span>
      </header>
      <div class="body" style="padding-bottom:12px">
        <div class="filterrow" id="cm-filter"></div>
        <div class="strip" id="cm-strip"></div>
        <p class="note" id="cm-note"></p>
      </div>
    </section>

    <section class="card panel">
      <header><h2 id="cm-title">Select a host</h2></header>
      <div class="cmpgrid">
        <div id="cm-left"></div>
        <div id="cm-right"></div>
      </div>
    </section>`;
  drawFilter();
}

export function update(context) {
  ctx = context;
  drawFilter();
  drawStrip();
  drawDetail();
}

function drawFilter() {
  const box = root.querySelector("#cm-filter");
  const f = ctx.state.filter;
  box.innerHTML = `<span class="eyebrow" style="margin-right:4px">Elevated on</span>
    <button class="fchip ${!f ? "on" : ""}" data-f="">All hosts</button>` +
    DRIVERS.map(k => `<button class="fchip ${f === k ? "on" : ""}" data-f="${k}">
      ${icon(DRIVER_ICON[k], 13)} ${PLAIN[k]}</button>`).join("");
  box.querySelectorAll(".fchip").forEach(b => {
    b.onclick = () => { ctx.state.filter = b.dataset.f || null; drawFilter(); drawStrip(); };
  });
}

function visible() {
  const cards = [...ctx.contract.scorecards].sort((a, b) => a.rank - b.rank);
  if (!ctx.state.filter) return cards;
  return cards.filter(k => k.drivers.some(d => d.key === ctx.state.filter && d.elevated));
}

function drawStrip() {
  const cards = visible(), n = ctx.stats.n;
  const col = s => (s < 33 ? c("--c-energy") : s < 66 ? c("--c-cooling") : c("--c-water"));

  root.querySelector("#cm-strip").innerHTML = cards.length
    ? cards.map(k => `
      <button class="hcard ${k.host_city === ctx.state.city ? "sel" : ""}" data-city="${esc(k.host_city)}">
        <span class="hr">#${k.rank}</span>
        <span class="hn">${esc(k.host_city)}</span>
        <span class="hs num" style="color:${col(k.readiness_score)}">${k.readiness_score.toFixed(1)}</span>
        <span class="hbar">
          <em style="left:${k.readiness_band[0]}%;width:${Math.max(0, k.readiness_band[1] - k.readiness_band[0])}%"></em>
          <i style="width:${Math.max(2, k.readiness_score)}%;background:${col(k.readiness_score)}"></i>
        </span>
      </button>`).join("")
    : `<div class="empty" style="grid-column:1/-1">No host is elevated on that driver.</div>`;

  root.querySelectorAll("#cm-strip .hcard").forEach(b => {
    b.onclick = () => ctx.setCity(b.dataset.city);
  });

  root.querySelector("#cm-note").innerHTML = ctx.state.filter
    ? `Showing ${cards.length} of ${n} hosts elevated on <b>${PLAIN[ctx.state.filter]}</b>. The pale bar is the ±15 uncertainty band.`
    : `The pale bar is the ±15 uncertainty band. Pick a host to open its detail.`;
}

function drawDetail() {
  const k = ctx.stats.byCity[ctx.state.city];
  const left = root.querySelector("#cm-left"), right = root.querySelector("#cm-right");
  if (!k) {
    root.querySelector("#cm-title").textContent = "Select a host";
    left.innerHTML = `<div class="empty">Pick a host above.</div>`;
    right.innerHTML = "";
    return;
  }
  root.querySelector("#cm-title").textContent =
    `${k.host_city} · rank #${k.rank}, readiness ${k.readiness_score.toFixed(1)}`;

  const contrib = ctx.stats.contributions(k).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const r = k.raw_indicators;

  left.innerHTML = `
    <p class="note">Weighted contribution to this host's stress index.</p>
    <div class="clist">
      ${contrib.map(d => {
        const pct = ctx.stats.driverPct(d.key, d.raw);
        const label = pctLabel(pct);
        const tone = label === "at median" ? c("--ink-3") : pct > 0 ? c("--v-up") : c("--v-down");
        return `<div class="crow" style="--dc:${c(DRIVER_COLOR[d.key])}">
          <span class="di">${icon(DRIVER_ICON[d.key], 15)}</span>
          <span class="dn">${PLAIN[d.key]}</span>
          <span class="dv" style="color:${tone}">${label}</span>
          <span class="dw">${(d.weight * 100).toFixed(0)}%</span>
        </div>`;
      }).join("")}
    </div>
    <dl class="facts">
      <dt>Energy per shop-month</dt><dd>${fmt(r.energy_kwh)} kWh</dd>
      <dt>Water per shop-month</dt><dd>${fmt(r.water_liters)} L</dd>
      <dt>CO₂e per shop-month</dt><dd>${fmt(r.kg_co2e)} kg</dd>
      <dt>Summer cooling degree days</dt><dd>${fmt(r.cdd)}</dd>
      <dt>Urban heat index</dt><dd>${(r.uhi || 0).toFixed(1)}</dd>
      <dt>Shops in the panel</dt><dd>${full(r.shops || 0)}</dd>
    </dl>
    <p class="note" style="margin-top:12px">Closest peers:
      ${k.peer_cities.map(p => `<button class="lnk" data-peer="${esc(p)}">${esc(p)}</button>`).join(" · ")}</p>
    <a class="btn sm" style="margin-top:10px" href="data/city_cards/${esc(slug(k.host_city))}.md" download>
      ${icon("download", 14)} One-pager</a>`;

  const plays = k.recommended_plays || [], gen = k.general_options || [];
  right.innerHTML =
    `<p class="note">Plays matched to ${esc(k.host_city)}'s elevated drivers. Effects apply the play's
       percentage to this city's summer totals.</p>` +
    (plays.length ? plays.map(play).join("")
      : `<div class="empty">No pressing plays — no driver here sits above the 11-host mean.</div>`) +
    (gen.length
      ? `<details style="margin-top:8px"><summary>${gen.length} general option${gen.length === 1 ? "" : "s"} (not pressing here)</summary>
          <div style="margin-top:10px">${gen.map(play).join("")}</div></details>`
      : "");

  root.querySelectorAll("[data-peer]").forEach(b => {
    b.onclick = () => ctx.setCity(b.dataset.peer);
  });
}

function play(p) {
  const e = p.expected_effects || {}, d = p.illustrative_absolute_delta || {};
  const eff = [
    ["Energy", e.energy_pct, d.energy_kwh, "kWh", "--c-energy"],
    ["Water", e.water_pct, d.water_liters, "L", "--c-water"],
    ["CO₂e", e.food_co2e_pct, d.kg_co2e, "kg", "--c-carbon"],
  ].filter(([, pct]) => pct).map(([l, pct, a, u, cv]) =>
    `<span class="e" style="color:${c(cv)}">${l} <b>${pct > 0 ? "+" : ""}${pct}%</b>
      <span style="color:var(--ink-3)">≈ ${fmt(Math.abs(a))} ${u} ${pct < 0 ? "saved" : "added"}</span></span>`).join("");
  const steal = (p.steal_from_peers || []).length
    ? `<span>Also indicated for ${p.steal_from_peers.map(s =>
        `<button class="lnk" data-peer="${esc(s)}">${esc(s)}</button>`).join(", ")}</span>` : "";
  return `<article class="play">
    <h3>${esc(p.title)}</h3>
    <div class="eff">${eff || `<span class="e">No quantified effect</span>`}</div>
    <p class="why">${esc(p.rationale)}</p>
    <div class="foot"><span>Owner: ${esc(p.owner)}</span><span>Effort: ${esc(p.effort)}</span>${steal}</div>
  </article>`;
}
