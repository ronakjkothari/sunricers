/* Spatial map.

   The map page is the one place an iframe is still allowed, and it is the next
   page slated for the redesign (full-bleed map, floating control bar, three
   stat pills over the canvas, detail cards beneath). Until then this mounts the
   existing page and steers it rather than reloading its ~11 MB of place data.

   The frame is created on first activation, so none of that payload is on the
   boot path. */

import { esc } from "../lib/format.js";

let root = null, ctx = null, frame = null, poll = 0;

export function mount(el, context) {
  root = el;
  ctx = context;
  root.innerHTML = `
    <section class="card panel" style="margin-top:0">
      <header>
        <h2>Where demand sits on the map</h2>
        <span class="chip" id="sp-city"></span>
        <span class="sp"></span>
        <a class="btn sm" id="sp-pop" target="_blank" rel="noopener">Open full map</a>
      </header>
      <div class="frameshell">
        <iframe id="sp-frame" title="Nexus Pulse spatial map" loading="lazy"></iframe>
        <div class="frameph" id="sp-ph">Loading the map — this downloads about 11 MB of place data.</div>
      </div>
    </section>`;
}

export function update(context) {
  ctx = context;
  const k = ctx.stats.byCity[ctx.state.city];
  root.querySelector("#sp-city").textContent = ctx.state.city;
  root.querySelector("#sp-pop").href =
    `spatial.html?city=${encodeURIComponent(ctx.state.city)}&theme=${ctx.state.theme}`;
  if (frame) steer();
}

/** Called by the shell when the tab becomes visible. */
export function activate(context) {
  ctx = context;
  update(context);
  if (frame) { steer(); return; }

  frame = root.querySelector("#sp-frame");
  frame.classList.add("on");   // height before src, so MapLibre measures correctly
  frame.src = `spatial.html?embed=1&city=${encodeURIComponent(ctx.state.city)}&theme=${ctx.state.theme}`;
  frame.onload = () => {
    clearInterval(poll);
    poll = setInterval(() => {
      try {
        if (frame.contentWindow && frame.contentWindow.__spatialReady) {
          clearInterval(poll);
          root.querySelector("#sp-ph").hidden = true;
          steer();
        }
      } catch (_) {
        clearInterval(poll);
        root.querySelector("#sp-ph").hidden = true;
      }
    }, 150);
    setTimeout(() => { clearInterval(poll); root.querySelector("#sp-ph").hidden = true; }, 20000);
  };
}

function steer() {
  try {
    const w = frame.contentWindow;
    if (!w || !w.__spatialReady) return;
    const st = w.__spatialState;
    if (st.city !== ctx.state.city) w.setCity(ctx.state.city);
    if (st.theme !== ctx.state.theme) w.setTheme(ctx.state.theme);
  } catch (_) { /* not ready — the poll will catch up */ }
}
