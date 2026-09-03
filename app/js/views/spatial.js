/* Spatial map.

   The map page is the one place an iframe is still allowed, and it is the next
   page slated for the redesign (full-bleed map, floating control bar, three
   stat pills over the canvas, detail cards beneath). Until then this mounts the
   existing page and steers it rather than reloading its ~11 MB of place data.

   The frame is created on first activation, so none of that payload is on the
   boot path. The lab's levers ride along: in the URL on first load, then through
   the map's setLevers / setCustomLevers, and back through parent.__leversFromMap
   when someone ticks a lever on the map. The map reports its own height so the
   page keeps a single scrollbar. */

let root = null, ctx = null, frame = null, poll = 0;

const leverQuery = () => (ctx.state.levers.size ? `&levers=${[...ctx.state.levers].join(",")}` : "");

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

  // the embedded map reports its height so the page keeps a single scrollbar
  window.__frameHeight = h => { if (frame && h > 200) frame.style.height = Math.ceil(h) + "px"; };
}

export function update(context) {
  ctx = context;
  root.querySelector("#sp-city").textContent = ctx.cityName();
  // the pop-out must open on the same city and levers, or the two views disagree
  root.querySelector("#sp-pop").href =
    `spatial.html?city=${encodeURIComponent(ctx.state.city)}&theme=${ctx.state.theme}${leverQuery()}`;
  if (frame) steer();
}

/** Called by the shell when the tab becomes visible. */
export function activate(context) {
  ctx = context;
  update(context);
  if (frame) { steer(); return; }

  frame = root.querySelector("#sp-frame");
  frame.classList.add("on");   // height before src, so MapLibre measures correctly
  frame.src = `spatial.html?embed=1&city=${encodeURIComponent(ctx.state.city)}&theme=${ctx.state.theme}${leverQuery()}`;
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

/** Steer the already-loaded map instead of reloading it. Safe to call any time. */
export function steer() {
  if (!frame) return;
  try {
    const w = frame.contentWindow;
    if (!w || !w.__spatialReady) return;
    const st = w.__spatialState;
    if (st.city !== ctx.state.city) w.setCity(ctx.state.city);
    if (st.theme !== ctx.state.theme) w.setTheme(ctx.state.theme);
    if (typeof w.setCustomLevers === "function") {
      const sig = JSON.stringify(ctx.customLevers());
      if (w.__customSig !== sig) w.setCustomLevers(ctx.customLevers());
    }
    if (typeof w.setLevers === "function") {
      const mine = [...ctx.state.levers].sort().join(",");
      const theirs = [...(st.levers || [])].sort().join(",");
      if (mine !== theirs) w.setLevers([...ctx.state.levers], true);
    }
  } catch (_) { /* not ready — the poll will catch up */ }
}

/** after "show on map": scroll the page so the map itself (not the tiles above it) is in view */
export function scrollToMap(tries = 0) {
  try {
    const w = frame && frame.contentWindow;
    if (w && w.__spatialReady) {
      const m = w.document.getElementById("map");
      const y = frame.getBoundingClientRect().top + window.scrollY + m.getBoundingClientRect().top - 70;
      window.scrollTo(0, Math.max(0, y));   // instant: this follows a tab switch, nothing to animate from
      return;
    }
  } catch (_) { /* cross-origin or not ready */ }
  if (tries < 40) setTimeout(() => scrollToMap(tries + 1), 250);
}
