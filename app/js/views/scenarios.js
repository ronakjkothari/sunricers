/* Scenarios — the intervention lab.

   Left: a visitor-surge slider, then the levers as checkboxes grouped by when
   they happen (before / during / match day), plus the organiser's own lever.
   Right (sticky): a plain sentence, one bar per resource (percent cut, black
   whisker = low–high range), who does what, a match-card box for off-map
   levers, and the number table folded away. Above both: the levers ranked for
   the selected city ("What helps this city").

   All arithmetic lives in ../lib/levers.js; this file only draws. Without
   data/levers.json the tab falls back to the plain surge table. */

import { fmt, full, esc, niceMax } from "../lib/format.js";
import { icon } from "../lib/icons.js";
import { c, METRIC_COLOR } from "../lib/palette.js";
import { METRIC_ABS } from "../lib/stats.js";
import {
  RES, RES_COLOR, RES_LABEL, RES_UNIT, BUCKETS, COST_TIERS, FOOD_WASTE_CO2, CSEGS, EQUIV,
  leverById, costTier, segLabel, segWord, segmentPiles, combinedCuts, totalCut, aloneCut,
  rankLevers, buildCustomLever, customId,
} from "../lib/levers.js";

const ROWS = [["v", "Visits", "visits"], ["e", "Energy", "kWh"], ["w", "Water", "L"], ["co2", "CO₂e", "kg CO₂e"]];

let root = null, ctx = null;
let CF_TRIED = false;   // errors are listed only after the first Save press, so the form does not jump while typing

const byId = id => leverById(ctx.lev, id);
const onLevers = () => [...ctx.state.levers].map(byId).filter(Boolean);
const piles = () => segmentPiles(ctx.lev, ctx.cardsOf());

/* ---------------------------------------------------------------- mount */

export function mount(el, context) {
  root = el;
  ctx = context;
  root.innerHTML = `
    <section class="card panel" style="margin-top:0">
      <header>
        <h2>Intervention lab</h2>
        <span class="chip" id="sc-city"></span>
      </header>
      <div class="body">
        <p class="note" style="margin-bottom:14px;max-width:80ch">
          Switch levers on and watch energy, water and CO₂e move against the summer baseline. Every cut is a
          <b>range</b> (low / middle / high) built from measured studies, never one number; the percent is the
          trustworthy part. Each lever card says what a person actually does, what it touches, and where its
          numbers come from.</p>
        <div class="leverrank" id="sc-rank"></div>
        <div class="lab">
          <div>
            <div class="eyebrow">Visitor surge</div>
            <p class="note">Scale tournament-window visitors against the summer baseline. Levers apply on top of it.</p>
            <div class="slider">
              <input type="range" id="sc-surge" min="1" max="2" step="0.05" value="1"
                     aria-label="Visitor surge multiplier">
              <span class="sv num" id="sc-val">1.00×</span>
            </div>
            <p class="note" id="sc-hint">More visitors means bigger totals; the <b>percent</b> each lever saves stays
              the same, so the bars on the right do not move — the kWh and litres under them do.</p>

            <div class="eyebrow" style="margin-top:20px">Levers</div>
            <div class="levers" id="sc-levers"></div>
            <div id="sc-customlab">
              <button class="addlever" id="sc-addlever" type="button"><b>+ Add your own lever</b>
                <span>Type what one visit saves in kWh, litres and kg CO₂e (or kg of food waste). It joins the list and
                the map like the studied levers, tagged “your estimate”.</span></button>
              <div id="sc-customform" hidden></div>
            </div>
          </div>
          <div>
            <div class="eyebrow" id="sc-title">What changes</div>
            <div class="impact" id="sc-impact"></div>
            <div id="sc-offmap"></div>
            <details class="numbers"><summary>The numbers behind the bars</summary>
              <table class="stbl" id="sc-tbl"></table>
              <p class="note" id="sc-note"></p>
            </details>
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn sm" id="sc-showonmap">${icon("map", 14)} Show these levers on the map</button>
              <button class="btn sm ghost" id="sc-clear">Clear levers</button>
            </div>
            <p class="note" id="sc-leversnote"></p>
          </div>
        </div>
      </div>
    </section>`;

  const sl = root.querySelector("#sc-surge");
  sl.oninput = () => { ctx.state.surge = +sl.value; drawSurge(); };
  root.querySelector("#sc-showonmap").onclick = () => ctx.showOnMap();
  root.querySelector("#sc-clear").onclick = () => { ctx.state.levers.clear(); changed(true); };
  root.querySelector("#sc-addlever").onclick = () => openCustomForm(null);
}

export function update(context) {
  ctx = context;
  root.querySelector("#sc-surge").value = ctx.state.surge;
  root.querySelector("#sc-city").textContent = ctx.cityName();
  drawLevers();
  drawSurge();
}

/** a lever was switched on or off: redraw the numbers, tell the shell (link + map) */
function changed(rebuildList) {
  if (rebuildList) drawLevers();
  else syncCards();
  drawSurge();
  ctx.leversChanged();
}

/* ----------------------------------------------------------- the levers */

/** one line on a ticked card: what this lever alone does to the selected city's totals */
function hereLine(l) {
  const { seg, tot } = piles();
  const a = aloneCut(l, seg, tot);
  const parts = RES.filter(([r]) => a[r]).map(([r, label]) => `${label} −${(a[r] * 100).toFixed(1)}%`);
  return parts.length
    ? `In ${ctx.cityName()}: ${parts.join(" · ")}`
    : `Touches shop types with almost no data in ${ctx.cityName()}`;
}

function drawLevers() {
  const box = root.querySelector("#sc-levers"), LEV = ctx.lev;
  if (!LEV) {
    box.innerHTML = `<p class="note">No <code>data/levers.json</code>. Run <code>python3 scripts/build_levers.py</code>.</p>`;
    root.querySelector("#sc-customlab").hidden = true;
    return;
  }
  box.innerHTML = BUCKETS.map(([b, label]) => {
    const ls = LEV.levers.filter(l => l.bucket === b);
    return `<div class="bucket">${esc(label)}</div>` + ls.map(l => {
      const on = ctx.state.levers.has(l.id);
      if (l.custom) return customCardHtml(l, on);
      const eff = l.offmap
        ? Object.entries(l.offmap.per_fan).filter(([k]) => k !== "gal")
            .map(([k, v]) => `${RES_LABEL[k]} <b>${v[1]}</b> ${RES_UNIT[k]} per fan (${v[0]}–${v[2]})`).join(" · ")
        : Object.entries(l.cuts).map(([seg, cuts]) => `${LEV.segments[seg].label}: ` +
            Object.entries(cuts).map(([k, v]) =>
              `${RES_LABEL[k]} <b>−${(v[1] * 100).toFixed(1)}%</b> <span class="lowhigh">(${(v[0] * 100).toFixed(1)}–${(v[2] * 100).toFixed(1)})</span>`
            ).join(", ")).join(" · ");
      return `<label class="lever ${on ? "on" : ""}">
        <input type="checkbox" data-id="${esc(l.id)}" ${on ? "checked" : ""}>
        <div>
          <div class="lt">${esc(l.title)}<span class="ev" title="evidence grade">${esc(l.evidence)}</span></div>
          <div class="lp">${esc(l.plain)}</div>
          <div class="lm">${eff}</div>
          <div class="here">${on && !l.offmap ? esc(hereLine(l)) : ""}</div>
        </div>
        <details><summary>evidence, dials, source</summary>
          <div style="margin-top:4px">${esc(l.evidence_plain)}</div>
          <div style="margin-top:4px"><b>What an organiser can turn:</b> ${l.dials.map(esc).join("; ")}.</div>
          ${l.cost ? `<div style="margin-top:4px"><b>What it costs:</b> ${esc(l.cost)}</div>` : ""}
          <div style="margin-top:4px"><b>Best source:</b>
            <a href="${esc(l.best_source.u)}" target="_blank" rel="noopener">${esc(l.best_source.t)}</a>
            · card <code>${esc(l.card)}</code> · ${esc(l.placeholder)}</div>
        </details>
      </label>`;
    }).join("");
  }).join("");
  box.querySelectorAll("input[type=checkbox]").forEach(cb => cb.onchange = () => {
    if (cb.checked) ctx.state.levers.add(cb.dataset.id); else ctx.state.levers.delete(cb.dataset.id);
    changed(false);   // update in place: a rebuilt list would move the box under the cursor
  });
  bindCustomButtons(box);
}

/** tick state and the "here" line on every card, without rebuilding the list */
function syncCards() {
  root.querySelectorAll("#sc-levers .lever").forEach(card => {
    const input = card.querySelector("input"), id = input.dataset.id, l = byId(id);
    const on = ctx.state.levers.has(id);
    input.checked = on;
    card.classList.toggle("on", on);
    const h = card.querySelector(".here");
    if (h) h.textContent = on && l && !l.offmap ? hereLine(l) : "";
  });
}

/* ------------------------------------------------------------ the answer */

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

/** The visible answer: a sentence, one bar per resource showing the % cut (whisker = low–high), and who does what. */
function drawImpact(seg, tot, keep, k) {
  const box = root.querySelector("#sc-impact");
  const on = onLevers().filter(l => !l.offmap);
  const onOff = onLevers().filter(l => l.offmap);
  if (!on.length) {
    box.innerHTML = `<div class="empty">${onOff.length
      ? "Only match-day levers are on — their numbers are in the match card below."
      : "Switch a lever on at the left. The bars here will show how much it cuts, and the range."}</div>`;
    return;
  }
  const cut = totalCut(seg, tot, keep);   // fractions: the surge cancels out
  const axisMax = Math.max(0.05, niceMax(Math.max(...RES.map(([r]) => cut[r][2]))));
  const moved = RES.filter(([r]) => cut[r][1] > 1e-6);
  const still = RES.filter(([r]) => !(cut[r][1] > 1e-6)).map(([r, l]) => (r === "co2" ? l : l.toLowerCase()));
  const parts = moved.map(([r, label, unit]) =>
    `<b>${r === "co2" ? label : label.toLowerCase()} down ${(cut[r][1] * 100).toFixed(1)}%</b>
     (${(cut[r][0] * 100).toFixed(1)} to ${(cut[r][2] * 100).toFixed(1)}), about ${fmt(cut[r][1] * tot[r] * k)} ${unit},
     or ${EQUIV[r](cut[r][1] * tot[r] * k)}`);
  const who = (on.length === 1 ? on[0].title : `${on.length} levers`) +
    (onOff.length ? ` (plus ${onOff.length} match-day lever${onOff.length > 1 ? "s" : ""}, counted on the match card below)` : "");
  const hl = moved.length
    ? `${esc(who)} in ${esc(ctx.cityName())} over the summer: ${parts.join("; ")}.${still.length ? ` No measured effect on ${still.join(" or ")}.` : ""}`
    : `${esc(who)} touch shop types that barely exist in ${esc(ctx.cityName())}'s data, so nothing moves here.`;

  const W = 100;
  const rows = RES.map(([r, label, unit]) => {
    const [lo, mid, hi] = cut[r].map(v => v / axisMax * W);
    const col = c(RES_COLOR[r]), ink = c("--ink");
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

  // who does what: each lever alone, on the same city pile
  const alone = on.map(l => { const out = aloneCut(l, seg, tot); return { l, out, max: Math.max(0, ...Object.values(out)) }; })
    .sort((a, b) => b.max - a.max);
  const byl = alone.map(({ l, out }) => `<div class="lvrow">
      <div class="n">${esc(l.title)}<br><small>${Object.keys(l.cuts).map(sg => ctx.lev.segments[sg].label).join(", ")}</small></div>
      <div class="bars">${RES.filter(([r]) => out[r]).map(([r, label]) =>
        `<div class="b"><span>${label}</span><i style="--w:${Math.min(100, out[r] / axisMax * 100).toFixed(1)}%;--c:${c(RES_COLOR[r])}"></i><span>−${(out[r] * 100).toFixed(1)}%</span></div>`).join("")
        || `<div class="b"><span></span><span style="grid-column:2/4">nothing measurable here</span></div>`}</div>
    </div>`).join("");

  box.innerHTML = `<div class="hl">${hl}</div>${rows}
    <div class="axis"><span></span><div class="ticks">${ticks}</div><span></span></div>
    <div class="bylever"><h5>Who does what (each lever on its own, middle value)</h5>${byl}</div>
    <p class="note">Bars are the cut as a share of ${esc(ctx.cityName())}'s June–July total; the black whisker is the
      low–high range (8 in 10 chance the truth is inside). Levers on the same shop type compound, so the top bars can be a
      little less than the sum of the rows below.</p>`;
}

function drawSurge() {
  const k = ctx.state.surge;
  root.querySelector("#sc-val").textContent = k.toFixed(2) + "×";
  root.querySelector("#sc-title").textContent = `What changes · ${ctx.cityName()}`;
  const tbl = root.querySelector("#sc-tbl"), note = root.querySelector("#sc-note");

  if (!ctx.lev) {   // levers file missing: fall back to the plain surge table
    const a = ctx.absolutes();
    tbl.innerHTML = `<tr><th>Resource</th><th>Baseline summer</th><th>At ${k.toFixed(2)}×</th><th>Change</th></tr>` +
      ROWS.map(([mk, label, unit]) => {
        const base = a[METRIC_ABS[mk]] || 0, out = base * k;
        return `<tr><td><span class="dotc" style="background:${c(METRIC_COLOR[mk])}"></span>${label}</td>
          <td class="num">${fmt(base)}</td><td class="num">${fmt(out)}</td>
          <td class="num" style="color:${k > 1 ? c("--v-up") : "var(--ink-3)"}">${k > 1 ? "+" : ""}${fmt(out - base)} ${esc(unit)}</td></tr>`;
      }).join("");
    note.textContent = "Linear scaling only.";
    root.querySelector("#sc-impact").innerHTML = `<div class="empty">Run <code>python3 scripts/build_levers.py</code> to enable the levers.</div>`;
    root.querySelector("#sc-rank").innerHTML = "";
    return;
  }

  const { seg, tot } = piles();
  const keep = combinedCuts(ctx.lev, ctx.state.levers);
  drawImpact(seg, tot, keep, k);

  const nOn = onLevers().length;
  const rows = RES.map(([r, label, unit]) => {
    const base = tot[r] * k;
    const after = [0, 1, 2].map(i => {
      let s = 0;
      for (const sg in seg) s += seg[sg][r] * k * ((keep[sg] && keep[sg][r]) ? keep[sg][r][i] : 1);
      return s;
    });
    const d = after.map(v => v - base);   // low cut = index 0 → smallest saving
    const pcts = d.map(v => (base ? v / base * 100 : 0));
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
  note.innerHTML = nOn
    ? `Baseline is the June–July total for ${esc(ctx.cityName())} (store-visits × intensity factors, the same numbers as the
       Overview tab), split into shop types by visit mix. Each lever cuts only the shop types it touches; levers on the same
       type compound. Low and high are the 10th and 90th percentiles of each lever's simulation, combined end to end. The
       percent is what to trust; the absolute kWh and litres inherit the baseline's noise.`
    : `Switch a lever on to see its cut. Baseline is the June–July total for ${esc(ctx.cityName())}; a ${k.toFixed(2)}× surge scales it linearly.`;
  root.querySelector("#sc-offmap").innerHTML = offmapHtml();
  drawLeverRank();

  const nShop = onLevers().filter(l => !l.offmap).length, nOff = nOn - nShop;
  root.querySelector("#sc-leversnote").textContent = nOn
    ? `${nShop ? `${nShop} shop lever${nShop > 1 ? "s" : ""}` : ""}${nShop && nOff ? " and " : ""}${nOff ? `${nOff} match-day lever${nOff > 1 ? "s" : ""}` : ""} on.
       On the map the touched shops get a dark ring and the tiles show the after-numbers; match-day levers appear on the match card.`
    : "";
}

/* ------------------------------------------------- what helps this city */

function drawLeverRank() {
  const box = root.querySelector("#sc-rank");
  const { card, rows, worst, top, z, heat, ms, seats, zWord } = rankLevers(ctx.lev, ctx.cardsOf(), ctx.cardOf(), ctx.matchesHere());
  const rl = r => RES_LABEL[r], name = esc(ctx.cityName());
  const heatNote = heat.length
    ? ` Heat is a driver here too (${heat.map(d => `${d.label.toLowerCase()} z +${d.z.toFixed(2)}`).join(", ")}), so energy cuts that touch cooling matter more than the number shows.`
    : "";
  const lead = !card
    ? `Levers ranked by their biggest single cut across all 11 hosts. Pick a city to rank against that city's own problem.`
    : !worst
    ? `${name} is ${zWord(z[top])} on all three (energy z ${z.kwh.toFixed(2)}, water ${z.water.toFixed(2)}, CO₂e ${z.co2.toFixed(2)}),
       so nothing stands out and levers are ranked by their biggest single cut.${heatNote}`
    : `${name}'s worst of the three is <b>${rl(worst)}</b> (${zWord(z[worst])}, z ${z[worst] >= 0 ? "+" : ""}${z[worst].toFixed(2)}),
       so levers are ranked by their ${rl(worst) === "CO₂e" ? "CO₂e" : rl(worst).toLowerCase()} cut. ` +
      RES.filter(([r]) => r !== worst).map(([r, lab]) => `${lab}: ${zWord(z[r])}`).join("; ") + "." + heatNote;
  const pct = (x, hot) => (x > 1e-6
    ? `<td class="num ${hot ? "hot" : ""}">${x < 0.0005 ? "<0.1%" : "−" + (x * 100).toFixed(1) + "%"}</td>`
    : `<td class="num ${hot ? "hot" : ""} nil">—</td>`);

  box.innerHTML = `<h5>What helps ${name} · levers ranked</h5><div class="lead2">${lead}</div>
    <div class="tblwrap"><table class="stbl">
      <tr><th></th><th>Lever</th>${RES.map(([r, lab]) => `<th class="${r === worst ? "hot" : ""}">${lab} cut</th>`).join("")}<th>Reach</th><th>Cost</th></tr>
      ${rows.map(({ l, cut, reach }) => {
        const on = ctx.state.levers.has(l.id), ct = costTier(l);
        return `<tr class="${on ? "on" : ""}">
          <td><input type="checkbox" data-id="${esc(l.id)}" ${on ? "checked" : ""} aria-label="switch on ${esc(l.title)}"></td>
          <td class="n">${esc(l.title)}${l.custom ? `<span class="ev">your estimate</span>` : ""}${l.offmap ? `<span class="tag">match card</span>` : ""}</td>
          ${RES.map(([r]) => pct(cut[r], r === worst)).join("")}
          <td>${l.offmap ? (ms.length ? `${ms.length} fixture${ms.length > 1 ? "s" : ""} · ${full(seats)} fans` : "no fixtures here") : `${(reach * 100).toFixed(0)}% of visits`}</td>
          <td class="cost" title="${esc(l.cost || "")}">${ct ? esc(ct.t) : "not set"}</td></tr>`;
      }).join("")}
    </table></div>
    <p class="note">Each cut is that lever alone, middle value, as a share of ${name}'s June–July total for that one resource;
      the three are kept apart on purpose. Reach is the share of the city's summer visits at the shops the lever touches.
      Match-day levers are attendance × per-fan against the same totals. Cost is the tier on the lever's card; hover for the
      sourced figure. Not scored: whether people will accept it and what lasts after the tournament. That is judgement, not data.</p>`;
  box.querySelectorAll("input[type=checkbox]").forEach(cb => cb.onchange = () => {
    if (cb.checked) ctx.state.levers.add(cb.dataset.id); else ctx.state.levers.delete(cb.dataset.id);
    changed(false);
  });
}

/* ------------------------------------------------------- your own lever */

function customCardHtml(l, on) {
  const c0 = l.inputs || {}, rng = v => v[0] !== v[2];
  const eff = l.offmap
    ? Object.entries(l.offmap.per_fan).map(([k, v]) => `${RES_LABEL[k]} <b>${v[1]}</b> ${RES_UNIT[k]} per fan${rng(v) ? ` (${v[0]}–${v[2]})` : ""}`).join(" · ")
    : Object.entries(l.cuts).map(([seg, cuts]) => `${ctx.lev.segments[seg].label}: ` + Object.entries(cuts).map(([k, v]) =>
        `${RES_LABEL[k]} <b>−${(v[1] * 100).toFixed(1)}%</b>${rng(v) ? ` <span class="lowhigh">(${(v[0] * 100).toFixed(1)}–${(v[2] * 100).toFixed(1)})</span>` : ""}`).join(", ")).join(" · ");
  const typedRows = (obj, word) => RES.filter(([k]) => obj && obj[k]).map(([k, lab, unit]) => {
    const food = k === "co2" && obj.co2unit === "food", v = food ? obj.co2typed : obj[k];
    return `${food ? "Food waste" : lab} <b>${v[1]}</b>${rng(v) ? ` (${v[0]}–${v[2]})` : ""} ${food ? "kg" : unit} per ${word}${food ? ` (= ${obj[k][1]} kg CO₂e)` : ""}`;
  }).join(", ");
  const typed = c0.fans ? typedRows(c0.pf, "fan")
    : (c0.segs || []).map(seg => `${segLabel(seg)}: ${typedRows((c0.pv || {})[seg], segWord(seg)) || "nothing"}`).join(" · ");
  const usesFood = c0.fans ? (c0.pf && c0.pf.co2unit === "food") : Object.values(c0.pv || {}).some(o => o && o.co2unit === "food");
  return `<label class="lever custom ${on ? "on" : ""}">
    <input type="checkbox" data-id="${esc(l.id)}" ${on ? "checked" : ""}>
    <div>
      <div class="lt">${esc(l.title)}<span class="ev mine" title="your own estimate, not a study">your estimate</span></div>
      <div class="lp">${esc(l.plain)}</div>
      <div class="lm">${eff || "no numbers"}</div>
      <div class="here">${on && !l.offmap ? esc(hereLine(l)) : ""}</div>
    </div>
    <details><summary>your numbers, edit, delete</summary>
      <div style="margin-top:4px"><b>You typed:</b> ${typed}.</div>
      <div style="margin-top:4px"><b>Cost:</b> ${esc(COST_TIERS[c0.cost ?? 1])}.</div>
      <div style="margin-top:4px">The percent is your saving per ${c0.fans ? "fan" : "visit"}${c0.fans ? "" : " divided by what a visit uses today (<code>data/curated/intensity_factors.csv</code>)"}${usesFood ? `; food waste is counted at ${FOOD_WASTE_CO2} kg CO₂e per kg (FAO 2013)` : ""}. Saved in this browser only.</div>
      <div class="cbtns"><button type="button" class="btn sm" data-edit="${esc(l.id)}">Edit</button><button type="button" class="btn sm ghost" data-del="${esc(l.id)}">Delete</button></div>
    </details>
  </label>`;
}

function bindCustomButtons(box) {
  box.querySelectorAll("button[data-edit]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); openCustomForm(b.dataset.edit); });
  box.querySelectorAll("button[data-del]").forEach(b => b.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Sure? Delete"; return; }   // two clicks, no blocking dialog
    deleteCustomLever(b.dataset.del);
  });
}

function deleteCustomLever(id) {
  ctx.lev.levers = ctx.lev.levers.filter(l => l.id !== id);
  ctx.state.levers.delete(id);
  ctx.saveCustomLevers(); closeCustomForm(); changed(true);
}

function closeCustomForm() {
  const f = root.querySelector("#sc-customform"); f.hidden = true; f.innerHTML = "";
  root.querySelector("#sc-addlever").hidden = false;
}

function openCustomForm(id) {
  if (!ctx.lev) return;
  const l = id ? byId(id) : null, c0 = l && l.inputs ? l.inputs : null;
  const f = root.querySelector("#sc-customform");
  f.innerHTML = customFormHtml(c0); f.hidden = false; CF_TRIED = false;
  root.querySelector("#sc-addlever").hidden = true;
  f.oninput = () => readCustomForm(); f.onchange = () => readCustomForm();
  f.querySelector("#cf_save").onclick = saveCustomForm;
  f.querySelector("#cf_cancel").onclick = closeCustomForm;
  readCustomForm();
  try { f.scrollIntoView({ block: "nearest", behavior: "smooth" }); if (!c0) f.querySelector("#cf_title").focus(); } catch (_) { /* fine */ }
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
    <div class="ch">${c0 ? "Edit your lever" : "Your own lever"} <span class="ev mine">your estimate</span></div>
    <label class="f"><span>Name</span><input type="text" id="cf_title" maxlength="60" placeholder="e.g. Hotel water pledge" value="${esc(c0 ? c0.title : "")}"></label>
    <label class="f"><span>What a person does</span><input type="text" id="cf_plain" maxlength="160" placeholder="one plain sentence" value="${esc(c0 ? c0.plain : "")}"></label>
    <label class="f"><span>Cost</span><select id="cf_cost">${COST_TIERS.map((tt, i) => `<option value="${i}" ${(c0 ? c0.cost : 1) === i ? "selected" : ""}>${tt}</option>`).join("")}</select></label>
    <label class="f"><span>When</span><select id="cf_bucket"><option value="before" ${!c0 || c0.bucket !== "during" ? "selected" : ""}>Before the tournament</option><option value="during" ${c0 && c0.bucket === "during" ? "selected" : ""}>During the tournament</option></select></label>
    <div class="f"><span>Touches</span><div>${CSEGS.map(([s, lab]) => tick(s, lab)).join("")}${tick("fans", "Fans at the match")}</div></div>
    <div class="f"><span>Range</span><label class="tch"><input type="checkbox" id="cf_range" ${c0 && c0.range ? "checked" : ""}>Not sure? give a low and a high too</label></div>
    ${CSEGS.map(([s, lab, word]) => segrow(s, lab, word)).join("")}${segrow("fans", "Fans at the match", "fan")}
    <div class="err" id="cf_err"></div>
    <div class="cta2"><button type="button" class="btn sm primary" id="cf_save">Save lever</button><button type="button" class="btn sm ghost" id="cf_cancel">Cancel</button>
      <span class="note">Saved in this browser only, tagged “your estimate”.</span></div>
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
  ctx.state.levers.add(c0.id); ctx.saveCustomLevers(); closeCustomForm();
  changed(true);
}
