/* Formatting helpers. Previously duplicated verbatim in index.html and
   spatial.html; this is the single copy. */

export const MNAME = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Compact magnitude: 24.7B, 53.1M, 1.9k. */
export function fmt(n) {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toFixed(0);
}

export const full = n => Math.round(n).toLocaleString();

export const esc = s => String(s).replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** "2024-06" -> "Jun 2024" */
export const pretty = m => MNAME[+m.slice(5, 7) - 1] + " " + m.slice(0, 4);

/** June and July: the tournament-analog window readiness is scored on. */
export const isSummer = m => { const x = +m.slice(5, 7); return x === 6 || x === 7; };

export const slug = s => s.toLowerCase().replace(/\//g, "_").replace(/ /g, "_");

export function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p * 2) / 2 * p;
}

/** 1 -> "1st", 11 -> "11th" */
export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const signed = (n, digits = 0) => (n > 0 ? "+" : "") + n.toFixed(digits);
