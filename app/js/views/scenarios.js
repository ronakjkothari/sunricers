/* Scenarios — the intervention lab stub.

   Still the single linear surge lever. The redesign agreed for this page
   (projection ribbon with an uncertainty band, cost/impact play ranking)
   waits on the attendance-to-EFW regression and the cost fields. */

import { fmt, esc } from "../lib/format.js";
import { icon } from "../lib/icons.js";
import { c, METRIC_COLOR } from "../lib/palette.js";
import { METRIC_ABS } from "../lib/stats.js";

const ROWS = [
  ["v", "Visits", "visits"],
  ["e", "Energy", "kWh"],
  ["w", "Water", "L"],
  ["co2", "CO₂e", "kg CO₂e"],
];

let root = null, ctx = null;

export function mount(el, context) {
  root = el;
  ctx = context;
  root.innerHTML = `
    <section class="card panel" style="margin-top:0">
      <header>
        <h2>Intervention lab</h2>
        <span class="chip">preview</span>
      </header>
      <div class="body">
        <p class="note" style="margin-bottom:18px;max-width:70ch">
          Scale visitor demand and watch the summer footprint move. Footprints here are
          visits × intensity factors, so a visitor surge scales them linearly. Cooling
          degree days and urban heat are not scaled — they do not depend on visitor counts.</p>
        <div class="lab">
          <div>
            <div class="eyebrow">Live lever · visitor surge</div>
            <div class="slider">
              <input type="range" id="sc-surge" min="1" max="2" step="0.05" value="1"
                     aria-label="Visitor surge multiplier">
              <span class="sv num" id="sc-val">1.00×</span>
            </div>
          </div>
          <div>
            <div class="eyebrow" id="sc-title"></div>
            <table class="stbl" id="sc-tbl"></table>
          </div>
        </div>
      </div>
    </section>`;

  const sl = root.querySelector("#sc-surge");
  sl.oninput = () => { ctx.state.surge = +sl.value; draw(); };
}

export function update(context) {
  ctx = context;
  root.querySelector("#sc-surge").value = ctx.state.surge;
  draw();
}

function draw() {
  const k = ctx.stats.byCity[ctx.state.city];
  if (!k) return;
  const a = k.ops_scale.absolute, mult = ctx.state.surge;

  root.querySelector("#sc-val").textContent = mult.toFixed(2) + "×";
  root.querySelector("#sc-title").textContent = `Baseline vs surge · ${k.host_city}`;

  root.querySelector("#sc-tbl").innerHTML = `
    <tr><th>Resource</th><th>Baseline summer</th><th>At ${mult.toFixed(2)}×</th><th>Change</th></tr>
    ${ROWS.map(([mk, label, unit]) => {
      const base = a[METRIC_ABS[mk]] || 0, out = base * mult;
      return `<tr>
        <td><span class="dotc" style="background:${c(METRIC_COLOR[mk])}"></span>${label}</td>
        <td class="num">${fmt(base)}</td>
        <td class="num">${fmt(out)}</td>
        <td class="num" style="color:${mult > 1 ? c("--v-up") : "var(--ink-3)"}">
          ${mult > 1 ? "+" : ""}${fmt(out - base)} ${esc(unit)}</td>
      </tr>`;
    }).join("")}`;
}
