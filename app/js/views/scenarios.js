/* Scenarios — the intervention lab, on one screen.

   Left: the levers ranked for the selected city, one row each (tick, name,
   the cut on energy / water / CO₂e, cost tier). Right: the answer — a plain
   sentence and one bar per resource (percent cut, black whisker = low–high
   range). Clicking a lever's name opens its detail (what a person does, the
   evidence, the dials, the source) under the answer, one at a time. Who does
   what, the match card and the number table fold under "Details". The
   organiser's own lever is typed into a pop-over, not an inline form.

   All arithmetic lives in ../lib/levers.js; this file only draws. Without
   data/levers.json the tab falls back to the plain surge table. */

import { fmt, full, esc, niceMax } from "../lib/format.js";
import { icon } from "../lib/icons.js";
import { c, METRIC_COLOR } from "../lib/palette.js";
import { METRIC_ABS } from "../lib/stats.js";
import {
  RES, RES_COLOR, RES_LABEL, RES_UNIT, COST_TIERS, FOOD_WASTE_CO2, CSEGS, EQUIV,
  leverById, costTier, segLabel, segWord, segmentPiles, combinedCuts, totalCut, aloneCut,
  rankLevers, buildCustomLever, customId,
} from "../lib/levers.js";

const ROWS = [["v", "Visits", "visits"], ["e", "Energy", "kWh"], ["w", "Water", "L"], ["co2", "CO₂e", "kg CO₂e"]];
const WHEN = { before: "before the tournament", during: "during the tournament", "match day": "match day" };

let root = null, ctx = null;
let detailId = null;    // the lever whose detail is open on the right
let CF_TRIED = false;   // errors are listed only after the first Save press, so the form does not jump while typing

const byId = id => leverById(ctx.lev, id);
const onLevers = () => [...ctx.state.levers].map(byId).filter(Boolean);
const piles = () => segmentPiles(ctx.lev, ctx.cardsOf());
const rank = () => rankLevers(ctx.lev, ctx.cardsOf(), ctx.cardOf(), ctx.matchesHere());

/* ---------------------------------------------------------------- mount */

export function mount(el, context) {
  root = el;
  ctx = context;
  root.innerHTML = `
    <section class="card panel" style="margin-top:0">
      <header class="labhead">
        <h2>Intervention lab</h2>
        <span class="chip" id="sc-city"></span>
        <span class="sp"></span>
        <label class="hsurge" title="Scale tournament-window visitors against the summer baseline. The percent each lever saves stays the same; the kWh and litres move.">
          <span>Visitor surge</span>
          <input type="range" id="sc-surge" min="1" max="2" step="0.05" value="1" aria-label="Visitor surge multiplier">
          <b class="num" id="sc-val">1.00×</b>
        </label>
        <button class="btn sm" id="sc-addlever">+ Your own lever</button>
        <button class="btn sm" id="sc-showonmap">${icon("map", 14)} Show on the map</button>
        <button class="btn sm ghost" id="sc-clear">Clear</button>
      </header>
      <div class="body lab2">
        <div class="labpick">
          <p class="lead2" id="sc-lead"></p>
          <div id="sc-list"></div>
        </div>
        <div class="labans">
          <div class="impact" id="sc-impact"></div>
          <div id="sc-detail" hidden></div>
          <details class="numbers" id="sc-more"><summary>Details · who does what, the match card, the numbers</summary>
            <div id="sc-bylever"></div>
            <div id="sc-offmap"></div>
            <table class="stbl" id="sc-tbl"></table>
            <p class="note" id="sc-note"></p>
          </details>
        </div>
      </div>
    </section>
    <div class="modal" id="sc-modal" hidden><div class="modalbox" id="sc-customform"></div></div>`;

  const sl = root.querySelector("#sc-surge");
  sl.oninput = () => { ctx.state.surge = +sl.value; drawAnswer(); };
  root.querySelector("#sc-showonmap").onclick = () => ctx.showOnMap();
  root.querySelector("#sc-clear").onclick = () => { ctx.state.levers.clear(); changed(); };
  root.querySelector("#sc-addlever").onclick = () => openCustomForm(null);
  root.querySelector("#sc-modal").onclick = ev => { if (ev.target.id === "sc-modal") closeCustomForm(); };
}

export function update(context) {
  ctx = context;
  root.querySelector("#sc-surge").value = ctx.state.surge;
  root.querySelector("#sc-city").textContent = ctx.cityName();
  if (detailId && !byId(detailId)) detailId = null;
  drawList();
  drawAnswer();
  drawDetail();
}

/** a lever was switched on or off: redraw, tell the shell (link + map) */
function changed() {
  drawList();
  drawAnswer();
  drawDetail();
  ctx.leversChanged();
}

/* ------------------------------------------------------- the ranked list */

function drawList() {
  const lead = root.querySelector("#sc-lead"), box = root.querySelector("#sc-list");
  if (!ctx.lev) {
    lead.textContent = "";
    box.innerHTML = `<p class="note">No <code>data/levers.json</code>. Run <code>python3 scripts/build_levers.py</code>.</p>`;
    return;
  }
  const { card, rows, worst, top, z, heat, ms, zWord } = rank();
  const rl = r => RES_LABEL[r], low = r => (rl(r) === "CO₂e" ? "CO₂e" : rl(r).toLowerCase());
  const name = esc(ctx.cityName());
  const heatNote = heat.length
    ? ` Heat is a driver too, so energy cuts that touch cooling matter more than the number shows.` : "";
  lead.innerHTML = !card
    ? `Ranked by the biggest single cut across all 11 hosts. Pick a city to rank against its own problem.`
    : !worst
    ? `${name} is ${zWord(z[top])} on energy, water and CO₂e, so nothing stands out; ranked by the biggest single cut.${heatNote}`
    : `${name}'s worst of the three is <b>${rl(worst)}</b> (${zWord(z[worst])}), so levers are ranked by their ${low(worst)} cut.${heatNote}`;

  const live = rows.filter(x => x.best > 1e-6), dead = rows.filter(x => !(x.best > 1e-6));
  const tr = ({ l, cut }) => {
    const on = ctx.state.levers.has(l.id), ct = costTier(l), tag = ct ? ct.t.split(" · ")[0] : "?";
    const pct = r => (cut[r] > 1e-6
      ? `<td class="num ${r === worst ? "hot" : ""}">${cut[r] < 0.0005 ? "<0.1%" : "−" + (cut[r] * 100).toFixed(1) + "%"}</td>`
      : `<td class="num nil ${r === worst ? "hot" : ""}">—</td>`);
    return `<tr class="${on ? "on" : ""} ${l.id === detailId ? "sel" : ""}">
      <td class="tick"><input type="checkbox" data-id="${esc(l.id)}" ${on ? "checked" : ""} aria-label="switch on ${esc(l.title)}"></td>
      <td class="n"><button class="lname" data-open="${esc(l.id)}">${esc(l.title)}</button>
        <span class="when">${esc(WHEN[l.bucket] || l.bucket)}${l.custom ? " · your estimate" : ""}${l.offmap ? " · match card" : ""}</span></td>
      ${RES.map(([r]) => pct(r)).join("")}
      <td class="cost" title="${esc(ct ? ct.t : "")}">${esc(tag)}</td></tr>`;
  };
  const head = `<thead><tr><th></th><th class="n">Lever</th>${RES.map(([r, lab]) =>
    `<th class="num ${r === worst ? "hot" : ""}">${lab}</th>`).join("")}<th>Cost</th></tr></thead>`;
  box.innerHTML = `<div class="tblwrap"><table class="rank">${head}<tbody>${live.map(tr).join("")}</tbody></table></div>` +
    (dead.length ? `<details class="deadlevers" ${dead.some(x => x.l.id === detailId || ctx.state.levers.has(x.l.id)) ? "open" : ""}>
        <summary>${dead.length} more lever${dead.length > 1 ? "s" : ""} with no measurable effect in ${name}${ms.length || !dead.some(x => x.l.offmap) ? "" : " (no fixtures here)"}</summary>
        <div class="tblwrap"><table class="rank"><tbody>${dead.map(tr).join("")}</tbody></table></div></details>` : "") +
    `<p class="note" style="margin-top:10px">Each cut is that lever alone, middle value, as a share of ${name}'s June–July total for that resource.
      Click a lever for what a person does, the evidence and the range. Cost is the tier on its card.</p>`;

  box.querySelectorAll("input[type=checkbox]").forEach(cb => cb.onchange = () => {
    if (cb.checked) ctx.state.levers.add(cb.dataset.id); else ctx.state.levers.delete(cb.dataset.id);
    changed();
  });
  box.querySelectorAll("[data-open]").forEach(b => b.onclick = () => {
    detailId = detailId === b.dataset.open ? null : b.dataset.open;
    box.querySelectorAll("tr").forEach(r => r.classList.toggle("sel", !!r.querySelector(`[data-open="${detailId}"]`)));
    drawDetail();
  });
}

/* ------------------------------------------------------------ the answer */

function drawAnswer() {
  const k = ctx.state.surge;
  root.querySelector("#sc-val").textContent = k.toFixed(2) + "×";
  const tbl = root.querySelector("#sc-tbl"), note = root.querySelector("#sc-note"), impact = root.querySelector("#sc-impact");

  if (!ctx.lev) {   // levers file missing: fall back to the plain surge table
    const a = ctx.absolutes();
    impact.innerHTML = `<div class="empty">Run <code>python3 scripts/build_levers.py</code> to enable the levers.</div>`;
    tbl.innerHTML = `<tr><th>Resource</th><th>Baseline summer</th><th>At ${k.toFixed(2)}×</th><th>Change</th></tr>` +
      ROWS.map(([mk, label, unit]) => {
        const base = a[METRIC_ABS[mk]] || 0, out = base * k;
        return `<tr><td><span class="dotc" style="background:${c(METRIC_COLOR[mk])}"></span>${label}</td>
          <td class="num">${fmt(base)}</td><td class="num">${fmt(out)}</td>
          <td class="num" style="color:${k > 1 ? c("--v-up") : "var(--ink-3)"}">${k > 1 ? "+" : ""}${fmt(out - base)} ${esc(unit)}</td></tr>`;
      }).join("");
    note.textContent = "Linear scaling only.";
    root.querySelector("#sc-more").open = true;
    return;
  }

  const { seg, tot } = piles();
  const keep = combinedCuts(ctx.lev, ctx.state.levers);
  const on = onLevers().filter(l => !l.offmap), onOff = onLevers().filter(l => l.offmap);
  const cut = totalCut(seg, tot, keep);   // fractions: the surge cancels out
  const axisMax = Math.max(0.05, niceMax(Math.max(...RES.map(([r]) => cut[r][2]))));

  // the sentence and the bars
  if (!on.length) {
    impact.innerHTML = `<div class="empty">${onOff.length
      ? "Only match-day levers are on — their numbers are under Details, on the match card."
      : "Tick a lever on the left. The bars here show how much it cuts, and the range."}</div>`;
  } else {
    const moved = RES.filter(([r]) => cut[r][1] > 1e-6);
    const still = RES.filter(([r]) => !(cut[r][1] > 1e-6)).map(([r, l]) => (r === "co2" ? l : l.toLowerCase()));
    const parts = moved.map(([r, label, unit]) =>
      `<b>${r === "co2" ? label : label.toLowerCase()} down ${(cut[r][1] * 100).toFixed(1)}%</b>
       (${(cut[r][0] * 100).toFixed(1)} to ${(cut[r][2] * 100).toFixed(1)}), about ${fmt(cut[r][1] * tot[r] * k)} ${unit},
       or ${EQUIV[r](cut[r][1] * tot[r] * k)}`);
    const who = (on.length === 1 ? on[0].title : `${on.length} levers`) +
      (onOff.length ? ` (plus ${onOff.length} match-day lever${onOff.length > 1 ? "s" : ""}, on the match card under Details)` : "");
    const hl = moved.length
      ? `${esc(who)} in ${esc(ctx.cityName())} over the summer: ${parts.join("; ")}.${still.length ? ` No measured effect on ${still.join(" or ")}.` : ""}`
      : `${esc(who)} touch shop types that barely exist in ${esc(ctx.cityName())}'s data, so nothing moves here.`;
    const W = 100, ink = c("--ink");
    const bars = RES.map(([r, label, unit]) => {
      const [lo, mid, hi] = cut[r].map(v => v / axisMax * W), col = c(RES_COLOR[r]);
      const whisker = cut[r][2] > 1e-6 ? `
        <line x1="${lo.toFixed(2)}" x2="${hi.toFixed(2)}" y1="11" y2="11" stroke="${ink}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
        <line x1="${lo.toFixed(2)}" x2="${lo.toFixed(2)}" y1="7" y2="15" stroke="${ink}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
        <line x1="${hi.toFixed(2)}" x2="${hi.toFixed(2)}" y1="7" y2="15" stroke="${ink}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>` : "";
      return `<div class="cutrow">
        <div class="lab">${label}</div>
        <div class="cutbar"><svg viewBox="0 0 ${W} 22" preserveAspectRatio="none">
          <rect x="0" y="5" width="${W}" height="12" rx="2" fill="${c("--surface-3")}"/>
          <rect x="0" y="5" width="${Math.max(0, mid).toFixed(2)}" height="12" rx="2" fill="${col}">
            <title>${label}: −${(cut[r][1] * 100).toFixed(1)}% middle; range ${(cut[r][0] * 100).toFixed(1)}–${(cut[r][2] * 100).toFixed(1)}%</title></rect>
          ${whisker}
        </svg></div>
        <div class="val">${cut[r][1] > 1e-6
          ? `−${(cut[r][1] * 100).toFixed(1)}%<small>${fmt(cut[r][1] * tot[r] * k)} ${esc(unit)} · range ${(cut[r][0] * 100).toFixed(1)}–${(cut[r][2] * 100).toFixed(1)}%</small>`
          : `0%<small>no measured effect</small>`}</div>
      </div>`;
    }).join("");
    const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(f =>
      `<span>${f ? "−" + (f * axisMax * 100).toFixed(axisMax < 0.1 ? 1 : 0) + "%" : "0"}</span>`).join("");
    impact.innerHTML = `<div class="hl">${hl}</div>${bars}
      <div class="axis"><span></span><div class="ticks">${ticks}</div><span></span></div>
      <p class="note">Share of ${esc(ctx.cityName())}'s June–July total. The black whisker is the low–high range: 8 in 10 chance the truth is inside.</p>`;
  }

  // under Details: who does what, the match card, the numbers
  const alone = on.map(l => { const out = aloneCut(l, seg, tot); return { l, out, max: Math.max(0, ...Object.values(out)) }; })
    .sort((a, b) => b.max - a.max);
  root.querySelector("#sc-bylever").innerHTML = alone.length ? `<div class="bylever"><h5>Who does what (each lever on its own, middle value)</h5>${
    alone.map(({ l, out }) => `<div class="lvrow">
      <div class="n">${esc(l.title)}<br><small>${Object.keys(l.cuts).map(sg => ctx.lev.segments[sg].label).join(", ")}</small></div>
      <div class="bars">${RES.filter(([r]) => out[r]).map(([r, label]) =>
        `<div class="b"><span>${label}</span><i style="--w:${Math.min(100, out[r] / axisMax * 100).toFixed(1)}%;--c:${c(RES_COLOR[r])}"></i><span>−${(out[r] * 100).toFixed(1)}%</span></div>`).join("")
        || `<div class="b"><span></span><span style="grid-column:2/4">nothing measurable here</span></div>`}</div>
    </div>`).join("")}
    <p class="note">Levers on the same shop type compound, so the bars above can be a little less than the sum of these rows.</p></div>` : "";
  root.querySelector("#sc-offmap").innerHTML = offmapHtml();

  const rows = RES.map(([r, label, unit]) => {
    const base = tot[r] * k;
    const after = [0, 1, 2].map(i => {
      let s = 0;
      for (const sg in seg) s += seg[sg][r] * k * ((keep[sg] && keep[sg][r]) ? keep[sg][r][i] : 1);
      return s;
    });
    const d = after.map(v => v - base), pcts = d.map(v => (base ? v / base * 100 : 0));
    const col = d[1] < -1e-9 ? c("--c-water") : "var(--ink-3)";
    return `<tr><td>${label}</td><td class="num">${fmt(base)}</td><td class="num">${fmt(after[1])}</td>
      <td class="num" style="color:${col}">${d[1] <= 0 ? "" : "+"}${fmt(d[1])} ${esc(unit)}<br>
        <span class="lowhigh">${pcts[1].toFixed(1)}% (${pcts[0].toFixed(1)} to ${pcts[2].toFixed(1)})</span></td></tr>`;
  }).join("");
  const visits = ctx.absolutes().visits || 0;
  tbl.innerHTML =
    `<tr><th>Resource</th><th>Baseline summer${k > 1 ? ` × ${k.toFixed(2)}` : ""}</th><th>With levers (middle)</th><th>Δ middle (low to high)</th></tr>${rows}
     <tr><td>Visits</td><td class="num">${fmt(visits)}</td><td class="num">${fmt(visits * k)}</td>
       <td class="num" style="color:var(--ink-3)">${k > 1 ? "+" + fmt(visits * (k - 1)) : "—"}</td></tr>`;
  note.innerHTML = `Baseline is the June–July total for ${esc(ctx.cityName())} (store-visits × intensity factors, the same numbers
    as the Overview), split into shop types by visit mix. Each lever cuts only the shop types it touches; levers on the same type
    compound. Low and high are the 10th and 90th percentiles of each lever's simulation. The percent is what to trust; the absolute
    kWh and litres inherit the baseline's noise. On the map the touched shops get a dark ring; match-day levers appear on the match card.`;
}

function offmapHtml() {
  const on = onLevers().filter(l => l.offmap);
  if (!on.length) return "";
  const ms = ctx.matchesHere();
  const seats = ms.reduce((s, m) => s + (m.a || m.cap || 0), 0);
  if (!ms.length) {
    return `<div class="offbox"><div class="k">Match-day levers</div>
      <div class="u">No 2026 fixtures for ${esc(ctx.cityName())} in <code>data/matches.json</code>.</div></div>`;
  }
  return on.map(l => {
    const rows = Object.entries(l.offmap.per_fan).filter(([k]) => k !== "gal").map(([k, v]) =>
      `<tr><td>${RES_LABEL[k]}</td>
        <td>${fmt(v[1] * seats / ms.length)} <span class="lowhigh">(${fmt(v[0] * seats / ms.length)}–${fmt(v[2] * seats / ms.length)})</span></td>
        <td>${fmt(v[1] * seats)} <span class="lowhigh">(${fmt(v[0] * seats)}–${fmt(v[2] * seats)})</span> ${RES_UNIT[k]}</td></tr>`).join("");
    return `<div class="offbox"><div class="k">Match card · ${esc(l.title)}</div>
      <div class="v">${ms.length} fixture${ms.length > 1 ? "s" : ""} · ${full(seats)} seats</div>
      <table class="stbl"><tr><th></th><th>per match</th><th>all fixtures here</th></tr>${rows}</table>
      <div class="u">Attendance × a per-fan saving (${esc(l.offmap.unit_note)}). ${esc(l.evidence_plain)}</div></div>`;
  }).join("");
}

/* ------------------------------------------------------- one lever's detail */

function drawDetail() {
  const box = root.querySelector("#sc-detail"), l = detailId && byId(detailId);
  if (!l) { box.hidden = true; box.innerHTML = ""; return; }
  const LEV = ctx.lev, on = ctx.state.levers.has(l.id);
  const { seg, tot } = piles(), here = aloneCut(l, seg, tot);
  const hereTxt = l.offmap ? "" : (RES.filter(([r]) => here[r]).map(([r, label]) => `${label} −${(here[r] * 100).toFixed(1)}%`).join(" · ")
    || `touches shop types with almost no data in ${esc(ctx.cityName())}`);
  const rng = v => v[0] !== v[2];
  const eff = l.offmap
    ? Object.entries(l.offmap.per_fan).filter(([k]) => k !== "gal")
        .map(([k, v]) => `${RES_LABEL[k]} <b>${v[1]}</b> ${RES_UNIT[k]} per fan${rng(v) ? ` (${v[0]}–${v[2]})` : ""}`).join(" · ")
    : Object.entries(l.cuts).map(([sg, cuts]) => `${LEV.segments[sg].label}: ` + Object.entries(cuts).map(([k, v]) =>
        `${RES_LABEL[k]} <b>−${(v[1] * 100).toFixed(1)}%</b>${rng(v) ? ` <span class="lowhigh">(${(v[0] * 100).toFixed(1)}–${(v[2] * 100).toFixed(1)})</span>` : ""}`).join(", ")).join(" · ");
  const custom = l.custom ? customDetailHtml(l) : `
      <div class="dr"><b>Evidence</b> ${esc(l.evidence_plain)}</div>
      <div class="dr"><b>What an organiser can turn</b> ${l.dials.map(esc).join("; ")}.</div>
      ${l.cost ? `<div class="dr"><b>What it costs</b> ${esc(l.cost)}</div>` : ""}
      <div class="dr"><b>Best source</b> <a href="${esc(l.best_source.u)}" target="_blank" rel="noopener">${esc(l.best_source.t)}</a>
        · card <code>${esc(l.card)}</code> · ${esc(l.placeholder)}</div>`;
  box.hidden = false;
  box.innerHTML = `<div class="ldetail">
    <div class="dh">
      <label class="tch"><input type="checkbox" id="sc-dtick" ${on ? "checked" : ""}> <b>${esc(l.title)}</b></label>
      <span class="ev${l.custom ? " mine" : ""}">${esc(l.evidence)}</span>
      <span class="sp"></span>
      <button class="lnk" id="sc-dclose">${icon("close", 12)} close</button>
    </div>
    <p class="lp">${esc(l.plain)}</p>
    <div class="dr"><b>Per shop</b> ${eff || "no numbers"}</div>
    ${hereTxt ? `<div class="dr"><b>In ${esc(ctx.cityName())}</b> ${hereTxt}</div>` : ""}
    <div class="dr"><b>When</b> ${esc(WHEN[l.bucket] || l.bucket)} · <b>Owner</b> ${esc(l.owner || "you")} · <b>Cost</b> ${esc(costTier(l) ? costTier(l).t : "not set")}</div>
    ${custom}
  </div>`;
  box.querySelector("#sc-dclose").onclick = () => { detailId = null; drawList(); drawDetail(); };
  box.querySelector("#sc-dtick").onchange = ev => {
    if (ev.target.checked) ctx.state.levers.add(l.id); else ctx.state.levers.delete(l.id);
    changed();
  };
  if (l.custom) {
    box.querySelector("[data-edit]").onclick = () => openCustomForm(l.id);
    const del = box.querySelector("[data-del]");
    del.onclick = () => {
      if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Sure? Delete"; return; }   // two clicks, no blocking dialog
      deleteCustomLever(l.id);
    };
  }
}

function customDetailHtml(l) {
  const c0 = l.inputs || {}, rng = v => v[0] !== v[2];
  const typedRows = (obj, word) => RES.filter(([k]) => obj && obj[k]).map(([k, lab, unit]) => {
    const food = k === "co2" && obj.co2unit === "food", v = food ? obj.co2typed : obj[k];
    return `${food ? "Food waste" : lab} <b>${v[1]}</b>${rng(v) ? ` (${v[0]}–${v[2]})` : ""} ${food ? "kg" : unit} per ${word}${food ? ` (= ${obj[k][1]} kg CO₂e)` : ""}`;
  }).join(", ");
  const typed = c0.fans ? typedRows(c0.pf, "fan")
    : (c0.segs || []).map(seg => `${segLabel(seg)}: ${typedRows((c0.pv || {})[seg], segWord(seg)) || "nothing"}`).join(" · ");
  const usesFood = c0.fans ? (c0.pf && c0.pf.co2unit === "food") : Object.values(c0.pv || {}).some(o => o && o.co2unit === "food");
  return `<div class="dr"><b>You typed</b> ${typed}.</div>
    <div class="dr">The percent is your saving per ${c0.fans ? "fan" : "visit"}${c0.fans ? "" : " divided by what a visit uses today (<code>data/curated/intensity_factors.csv</code>)"}${usesFood ? `; food waste is counted at ${FOOD_WASTE_CO2} kg CO₂e per kg (FAO 2013)` : ""}. Saved in this browser only.</div>
    <div class="cbtns"><button type="button" class="btn sm" data-edit>Edit</button><button type="button" class="btn sm ghost" data-del>Delete</button></div>`;
}

/* ------------------------------------------------------- your own lever */

function deleteCustomLever(id) {
  ctx.lev.levers = ctx.lev.levers.filter(l => l.id !== id);
  ctx.state.levers.delete(id);
  if (detailId === id) detailId = null;
  ctx.saveCustomLevers(); closeCustomForm(); changed();
}

function closeCustomForm() {
  root.querySelector("#sc-modal").hidden = true;
  root.querySelector("#sc-customform").innerHTML = "";
}

function openCustomForm(id) {
  if (!ctx.lev) return;
  const l = id ? byId(id) : null, c0 = l && l.inputs ? l.inputs : null;
  const f = root.querySelector("#sc-customform");
  f.innerHTML = customFormHtml(c0); CF_TRIED = false;
  root.querySelector("#sc-modal").hidden = false;
  f.oninput = () => readCustomForm(); f.onchange = () => readCustomForm();
  f.querySelector("#cf_save").onclick = saveCustomForm;
  f.querySelector("#cf_cancel").onclick = closeCustomForm;
  readCustomForm();
  try { if (!c0) f.querySelector("#cf_title").focus(); } catch (_) { /* fine */ }
}

function customFormHtml(c0) {
  const v = (arr, i) => ((arr && arr[i] != null) ? arr[i] : "");
  const row = (seg, [r, lab, unit], word) => {
    const o = seg === "fans" ? (c0 && c0.pf) : (c0 && c0.pv && c0.pv[seg]);
    const food = r === "co2" && o && o.co2unit === "food";
    const arr = o ? (food ? o.co2typed : o[r]) : null;
    const un = r === "co2"
      ? `<select class="un" aria-label="CO₂e unit"><option value="co2">kg CO₂e</option><option value="food" ${food ? "selected" : ""}>kg food waste</option></select>`
      : `<span class="un">${unit}</span>`;
    return `<div class="pvr" data-seg="${seg}" data-r="${r}"><span class="rl">${lab}</span>
      <input type="number" min="0" step="any" class="lo" value="${v(arr, 0)}" placeholder="low" aria-label="${lab} low">
      <input type="number" min="0" step="any" class="mid" value="${v(arr, 1)}" placeholder="0" aria-label="${lab} saved per ${word}">
      <input type="number" min="0" step="any" class="hi" value="${v(arr, 2)}" placeholder="high" aria-label="${lab} high">
      ${un}<span class="base"></span></div>`;
  };
  const segrow = (seg, title, word) => `<div class="segrow" data-seg="${seg}" hidden><div class="sh">${title} · what one ${word} saves</div>
    <div class="cols"><span></span><span class="onlyrange">low</span><span>your guess</span><span class="onlyrange">high</span><span></span><span>what a ${word} ${seg === "fans" ? "does" : "uses"} today</span></div>
    ${RES.map(r => row(seg, r, word)).join("")}</div>`;
  const on = seg => c0 && (seg === "fans" ? c0.fans : (c0.segs || []).includes(seg));
  const tick = (seg, lab) => `<label class="tch"><input type="checkbox" data-seg="${seg}" ${on(seg) ? "checked" : ""}>${lab}</label>`;
  return `<div class="cform ${c0 && c0.range ? "range" : ""}">
    <input type="hidden" id="cf_id" value="${esc(c0 ? c0.id : "")}">
    <div class="ch">${c0 ? "Edit your lever" : "Your own lever"} <span class="ev mine">your estimate</span>
      <span class="sp"></span><button type="button" class="lnk" id="cf_cancel">${icon("close", 12)} close</button></div>
    <p class="note" style="margin:0">Type what one visit (or one fan) saves. It joins the list and the map like the studied levers, tagged “your estimate”, and is saved in this browser only.</p>
    <label class="f"><span>Name</span><input type="text" id="cf_title" maxlength="60" placeholder="e.g. Hotel water pledge" value="${esc(c0 ? c0.title : "")}"></label>
    <label class="f"><span>What a person does</span><input type="text" id="cf_plain" maxlength="160" placeholder="one plain sentence" value="${esc(c0 ? c0.plain : "")}"></label>
    <label class="f"><span>Cost</span><select id="cf_cost">${COST_TIERS.map((tt, i) => `<option value="${i}" ${(c0 ? c0.cost : 1) === i ? "selected" : ""}>${tt}</option>`).join("")}</select></label>
    <label class="f"><span>When</span><select id="cf_bucket"><option value="before" ${!c0 || c0.bucket !== "during" ? "selected" : ""}>Before the tournament</option><option value="during" ${c0 && c0.bucket === "during" ? "selected" : ""}>During the tournament</option></select></label>
    <div class="f"><span>Touches</span><div>${CSEGS.map(([s, lab]) => tick(s, lab)).join("")}${tick("fans", "Fans at the match")}</div></div>
    <div class="f"><span>Range</span><label class="tch"><input type="checkbox" id="cf_range" ${c0 && c0.range ? "checked" : ""}>Not sure? give a low and a high too</label></div>
    ${CSEGS.map(([s, lab, word]) => segrow(s, lab, word)).join("")}${segrow("fans", "Fans at the match", "fan")}
    <div class="err" id="cf_err"></div>
    <div class="cta2"><button type="button" class="btn sm primary" id="cf_save">Save lever</button></div>
  </div>`;
}

/** read the form, paint the "uses today → −x%" hints and the error list; returns the inputs and the errors */
function readCustomForm() {
  const form = root.querySelector("#sc-customform"), q = s => form.querySelector(s);
  const num = el => { const s = String(el.value == null ? "" : el.value).trim(); if (s === "") return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
  const range = !!q("#cf_range").checked; q(".cform").classList.toggle("range", range);
  const segs = [...form.querySelectorAll("input[data-seg]")].filter(cb => cb.checked).map(cb => cb.dataset.seg);
  const fans = segs.includes("fans"), shopSegs = segs.filter(s => s !== "fans");
  form.querySelectorAll(".segrow").forEach(d => d.hidden = !segs.includes(d.dataset.seg));
  q("#cf_bucket").disabled = fans && !shopSegs.length;   // a fans-only lever lives on the match card
  const errors = [], warns = [];
  const c0 = { id: q("#cf_id").value || "", title: q("#cf_title").value.trim(), plain: q("#cf_plain").value.trim(),
    bucket: q("#cf_bucket").value, cost: +q("#cf_cost").value || 0, fans, segs: shopSegs, range, pv: {}, pf: {} };
  if (!c0.title) errors.push("Give the lever a name.");
  if (!segs.length) errors.push("Tick at least one shop type, or fans at the match.");
  let any = 0;
  form.querySelectorAll(".pvr").forEach(row => {
    const seg = row.dataset.seg, r = row.dataset.r; if (!segs.includes(seg)) return;
    const [, lab, unit] = RES.find(x => x[0] === r), word = segWord(seg), plural = word + "s";
    const f = seg === "fans" ? null : ctx.lev.segments[seg].factor;
    const unitSel = row.querySelector("select.un"), food = !!unitSel && unitSel.value === "food";   // CO₂e typed as kg of food waste
    const fr = f ? f[r] : null;   // what a visit uses today, always in the resource's own unit
    const baseTxt = f ? `≈${fr} ${unit}${food ? `; 1 kg waste ≈ ${FOOD_WASTE_CO2} kg CO₂e` : ""}`
      : (food ? `1 kg waste ≈ ${FOOD_WASTE_CO2} kg CO₂e; no shop baseline for fans` : "no shop baseline for fans");
    const base = row.querySelector(".base"); row.querySelectorAll("input").forEach(i => i.classList.remove("bad"));
    const mid = num(row.querySelector(".mid")), lo0 = num(row.querySelector(".lo")), hi0 = num(row.querySelector(".hi"));
    if (mid === null && (!range || (lo0 === null && hi0 === null))) { base.innerHTML = baseTxt; return; }
    if (mid === null) { errors.push(`${lab} for ${plural}: give the middle number too.`); row.querySelector(".mid").classList.add("bad"); base.innerHTML = baseTxt; return; }
    const lo = range && lo0 !== null ? lo0 : mid, hi = range && hi0 !== null ? hi0 : mid, tri = [lo, mid, hi];
    if (tri.some(x => Number.isNaN(x) || x < 0)) { errors.push(`${lab} for ${plural}: numbers must be zero or more.`); row.querySelector(".mid").classList.add("bad"); base.innerHTML = baseTxt; return; }
    if (!(lo <= mid && mid <= hi)) { errors.push(`${lab} for ${plural}: low ≤ middle ≤ high.`); row.querySelectorAll(".lo,.hi").forEach(i => i.classList.add("bad")); }
    const eq = food ? tri.map(x => x * FOOD_WASTE_CO2) : tri;
    let pct = "";
    if (fr) {
      const p = eq[1] / fr;
      pct = ` → <b>−${(p * 100).toFixed(1)}%</b>` + (range && hi !== lo ? ` (${(eq[0] / fr * 100).toFixed(1)}–${(eq[2] / fr * 100).toFixed(1)})` : "");
      if (eq[2] > fr) {
        errors.push(`${lab} for ${plural}: a ${word} only makes ${fr} ${unit}${food ? ` (that is ${(fr / FOOD_WASTE_CO2).toFixed(1)} kg of food)` : ""}, you cannot save more than that.`);
        row.querySelector(eq[1] > fr ? ".mid" : ".hi").classList.add("bad");
      } else if (p > 0.5) warns.push(`${lab} for ${plural}: −${(p * 100).toFixed(0)}% is a very big cut, be sure.`);
    }
    base.innerHTML = baseTxt + pct;
    any++;
    const o = seg === "fans" ? c0.pf : (c0.pv[seg] ||= {});
    o[r] = eq;   // stored in the resource's own unit
    if (r === "co2") { o.co2unit = food ? "food" : "co2"; o.co2typed = tri; }
  });
  if (segs.length && !any) errors.push("Type at least one saving.");
  q("#cf_err").innerHTML = (CF_TRIED ? errors.map(e => `<div>${esc(e)}</div>`).join("") : "") + warns.map(w => `<div class="warn">${esc(w)}</div>`).join("");
  return { c: c0, errors };
}

function saveCustomForm() {
  CF_TRIED = true;
  const { c: c0, errors } = readCustomForm(); if (errors.length) return;
  if (!c0.id) c0.id = customId(c0.title);
  const l = buildCustomLever(ctx.lev, c0);
  ctx.lev.levers = ctx.lev.levers.filter(x => x.id !== c0.id).concat([l]);
  ctx.state.levers.add(c0.id); detailId = c0.id;
  ctx.saveCustomLevers(); closeCustomForm();
  changed();
}
