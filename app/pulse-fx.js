/* Shared pixel flutter + KPI step-count. Snappy, not smooth. */
(function (global) {
  "use strict";

  function reduced() {
    try {
      return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_) {
      return true;
    }
  }

  function fmtNum(n) {
    if (!isFinite(n)) return "—";
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return n.toFixed(0);
  }

  global.animateKpis = function animateKpis(root, fmt) {
    const f = fmt || fmtNum;
    if (!root) return;
    const els = root.querySelectorAll(".num[data-val]");
    if (reduced()) {
      els.forEach(el => { el.textContent = f(+el.dataset.val); });
      return;
    }
    els.forEach(el => {
      const target = +el.dataset.val;
      const steps = 18;
      let i = 0;
      const tick = () => {
        i++;
        const t = i / steps;
        const eased = 1 - Math.pow(1 - t, 2);
        el.textContent = f(target * eased);
        if (i < steps) setTimeout(tick, 28);
        else el.textContent = f(target);
      };
      tick();
    });
  };

  global.armSerieDraw = function armSerieDraw(svg) {
    if (!svg || reduced()) return;
    svg.querySelectorAll(".serie.draw").forEach(line => {
      if (typeof line.getTotalLength !== "function") return;
      const len = Math.ceil(line.getTotalLength());
      line.style.setProperty("--path-len", String(len));
    });
  };

  function startFlutter() {
    const c = document.getElementById("fx");
    if (!c || reduced() || typeof c.getContext !== "function") return;
    const ctx = c.getContext("2d", { alpha: true });
    if (!ctx) return;
    let w = 0, h = 0, cell = 10, cols = 0, rows = 0, grid = null, last = 0;

    const palette = () => {
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      return dark
        ? ["#0b6e4f", "#7dffb3", "#c44b16", "#1a7a8c", "#00000000"]
        : ["#0b6e4f", "#c44b16", "#1a7a8c", "#b8860b", "#00000000"];
    };

    function resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      w = global.innerWidth || 0;
      h = global.innerHeight || 0;
      if (!w || !h) return;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = w + "px";
      c.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = Math.max(8, Math.floor(Math.min(w, h) / 72));
      cols = Math.ceil(w / cell) + 1;
      rows = Math.ceil(h / cell) + 1;
      grid = new Uint8Array(cols * rows);
      const pal = palette();
      for (let i = 0; i < grid.length; i++) {
        grid[i] = Math.random() < 0.08 ? (1 + ((Math.random() * (pal.length - 2)) | 0)) : 0;
      }
    }

    function frame(ts) {
      if (!grid) { resize(); }
      if (ts - last < 70) {
        global.requestAnimationFrame(frame);
        return;
      }
      last = ts;
      const pal = palette();
      ctx.clearRect(0, 0, w, h);
      const flips = Math.max(8, (cols * rows * 0.004) | 0);
      for (let n = 0; n < flips; n++) {
        const i = (Math.random() * grid.length) | 0;
        grid[i] = Math.random() < 0.7 ? 0 : (1 + ((Math.random() * (pal.length - 2)) | 0));
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = grid[y * cols + x];
          if (!v) continue;
          ctx.fillStyle = pal[v];
          ctx.globalAlpha = 0.18 + (v % 3) * 0.07;
          ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
        }
      }
      ctx.globalAlpha = 1;
      global.requestAnimationFrame(frame);
    }

    resize();
    global.addEventListener("resize", resize);
    if (typeof MutationObserver === "function") {
      const obs = new MutationObserver(resize);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
    if (typeof global.requestAnimationFrame === "function") {
      global.requestAnimationFrame(frame);
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startFlutter);
    } else {
      startFlutter();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
