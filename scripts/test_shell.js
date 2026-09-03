/**
 * Regression test for the Nexus Pulse shell.
 *
 *   node scripts/test_shell.js        # from the repo root
 *
 * The shell is ES modules now, so instead of scraping an inline <script> and
 * running it against a DOM stub, this imports the pure modules directly and
 * checks them against the real app/data JSON. That catches what actually bites:
 * a contract field that moved, weights that stopped parsing, a decomposition
 * that no longer sums to the score it claims to explain, a city with no photo.
 *
 * What it cannot check is pixels — layout, the map, and dark mode still need a
 * human with a browser. See app/README.md.
 *
 * Stdlib only. Exits non-zero if anything fails.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "app");

let failures = 0;
let checks = 0;

function ok(label, cond, detail) {
  checks++;
  if (cond) return;
  failures++;
  console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
}

function section(name) {
  console.log(`\n${name}`);
}

const mod = p => import(pathToFileURL(path.join(APP, "js", p)).href);
const readJSON = p => JSON.parse(fs.readFileSync(path.join(APP, p), "utf8"));

async function main() {
  const { build, weightsOf, verdict, METRIC_ABS } = await mod("lib/stats.js");
  const { fmt, ordinal, pretty, isSummer } = await mod("lib/format.js");
  const { icon, DRIVER_ICON } = await mod("lib/icons.js");

  const contract = readJSON("data/a_integration.json");
  const series = readJSON("data/overview_kpis.json");
  const S = build(contract, series);
  const cards = contract.scorecards;

  /* ------------------------------------------------------------------ */
  section("contract");
  ok("11 scorecards", cards.length === 11, `got ${cards.length}`);
  ok("every card has ops_scale.absolute",
    cards.every(k => k.ops_scale && k.ops_scale.absolute));
  ok("every card has 5 drivers with z and raw",
    cards.every(k => k.drivers.length === 5 && k.drivers.every(d =>
      isFinite(d.z) && isFinite(d.raw))));
  ok("ranks are 1..11 and unique",
    new Set(cards.map(k => k.rank)).size === 11 &&
    Math.min(...cards.map(k => k.rank)) === 1 &&
    Math.max(...cards.map(k => k.rank)) === 11);

  /* ------------------------------------------------------------------ */
  section("weights");
  const w = weightsOf(contract);
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  ok("five weights recovered", Object.keys(w).length === 5, JSON.stringify(w));
  ok("weights sum to 1.0", Math.abs(sum - 1) < 1e-9, `sum = ${sum}`);
  ok("every driver key has a weight",
    cards[0].drivers.every(d => typeof w[d.key] === "number"));
  // service.py now derives the string from weight_map, so "0.20" prints as
  // "0.2" after a regen. The parser must survive that, and prefer `weights`.
  const derived = weightsOf({ meta: { formula: {
    stress: "0.35*z(energy)+0.25*z(co2e)+0.2*z(water)+0.1*z(cdd)+0.1*z(uhi)" } } });
  ok("parser handles the regenerated string format",
    Math.abs(Object.values(derived).reduce((a, b) => a + b, 0) - 1) < 1e-9 &&
    derived.water_liters === 0.2, JSON.stringify(derived));
  ok("structured weights win over the string",
    weightsOf({ meta: { formula: { weights: { energy_kwh: 1 }, stress: "0.35*z(energy)" } } })
      .energy_kwh === 1);

  /* ------------------------------------------------------------------ */
  section("decomposition");
  // The waterfall claims to *be* the formula. If these stop summing, it lies.
  for (const k of cards) {
    const total = S.contributions(k).reduce((a, d) => a + d.value, 0);
    ok(`${k.host_city}: contributions sum to stress_index`,
      Math.abs(total - k.stress_index) < 5e-4,
      `Σ=${total.toFixed(6)} vs ${k.stress_index}`);
  }

  // The waterfall is drawn in readiness points and claims to land on the score.
  // If this identity breaks, the panel is showing a picture of a different number.
  ok("neutral readiness is inside the 0-100 scale",
    S.neutralReadiness > 0 && S.neutralReadiness < 100, String(S.neutralReadiness));
  for (const k of cards) {
    const landed = S.neutralReadiness +
      S.contributions(k).reduce((a, d) => a + S.points(d.value), 0);
    ok(`${k.host_city}: readiness points land on the score`,
      Math.abs(landed - k.readiness_score) < 0.02,
      `${landed.toFixed(3)} vs ${k.readiness_score}`);
  }

  /* ------------------------------------------------------------------ */
  section("peer statistics");
  for (const mk of Object.keys(METRIC_ABS)) {
    const ranks = Object.values(S.rankOf[mk]);
    ok(`${mk}: ranks are 1..11 and unique`,
      new Set(ranks).size === 11 && Math.min(...ranks) === 1 && Math.max(...ranks) === 11);
    ok(`${mk}: median series covers every month`,
      S.band[mk].med.length === series.months.length &&
      S.band[mk].med.every(isFinite));
    ok(`${mk}: interquartile band is ordered`,
      S.band[mk].lo.every((v, i) => v <= S.band[mk].med[i] + 1e-6 &&
        S.band[mk].med[i] <= S.band[mk].hi[i] + 1e-6));
  }
  for (const mk of ["e", "w", "co2"]) {
    const rr = Object.values(S.rateRankOf[mk]);
    ok(`${mk}: rate ranks are 1..11 and unique`,
      new Set(rr).size === 11 && Math.min(...rr) === 1 && Math.max(...rr) === 11);
  }
  ok("rate ranks differ from size ranks",
    ["e", "w", "co2"].some(mk => S.cities.some(c => S.rateRankOf[mk][c] !== S.rankOf[mk][c])),
    "if these always agree the chips carry no extra information");
  ok("summer window is June and July only",
    S.summerIdx.every(i => isSummer(series.months[i])) && S.summerIdx.length > 0);
  ok("driverPct is finite for every city and driver",
    cards.every(k => k.drivers.every(d => isFinite(S.driverPct(d.key, d.raw)))));
  const { pctLabel } = await mod("lib/stats.js");
  ok("pctLabel never leaks an unrounded float",
    cards.every(k => k.drivers.every(d => {
      const l = pctLabel(S.driverPct(d.key, d.raw));
      return l === "at median" || /^[+−]\d+(\.\d)?%$/.test(l);
    })), "e.g. +53.03090010925694%");
  ok("pctLabel handles the tie case", pctLabel(0) === "at median");

  // "10th highest rate of 11" reads as a criticism of a city that is doing
  // well; a rank past the midpoint should be named from the near end instead.
  const { polarRank } = await mod("lib/stats.js");
  const pr = r => polarRank(r, 11, "highest rate", "lowest rate");
  ok("top of the scale drops the ordinal", pr(1) === "highest rate", pr(1));
  ok("bottom of the scale drops the ordinal", pr(11) === "lowest rate", pr(11));
  ok("upper half counts from the top", pr(3) === "3rd highest rate", pr(3));
  ok("lower half counts from the bottom", pr(10) === "2nd lowest rate", pr(10));
  ok("the midpoint stays on the high side", pr(6) === "6th highest rate", pr(6));
  ok("no rank is ever called 10th highest of 11",
    Array.from({ length: 11 }, (_, i) => pr(i + 1))
      .every(l => !/(7|8|9|10|11)(th|st|nd|rd) highest/.test(l)));
  ok("polarRank takes alternative words",
    polarRank(10, 11, "largest", "smallest") === "2nd smallest");

  /* ------------------------------------------------------------------ */
  section("series");
  ok("every host has a series", S.cities.every(c => series.cities[c]));
  ok("every metric series is 60 months",
    S.cities.every(c => Object.keys(METRIC_ABS).every(mk =>
      (series.cities[c][mk] || []).length === series.months.length)));
  ok("no NaN in any series",
    S.cities.every(c => Object.keys(METRIC_ABS).every(mk =>
      series.cities[c][mk].every(isFinite))));

  /* ------------------------------------------------------------------ */
  section("verdict copy");
  for (const k of cards) {
    const v = verdict(k, cards.length);
    ok(`${k.host_city}: verdict renders`,
      typeof v === "string" && v.includes(k.host_city) && v.length > 30 && !/undefined|NaN/.test(v),
      v);
    ok(`${k.host_city}: verdict subject/verb agree`,
      !/and[^.]*sits/.test(v.replace(/<\/?b>/g, "")), v);
  }

  /* ------------------------------------------------------------------ */
  section("driver focus");
  // Focusing a driver narrows every panel, including the play list. That only
  // works if D keeps tagging plays with the drivers they act on.
  const { DRIVER_METRIC, DRIVER_LAYER } = await mod("views/overview.js");
  const driverKeys = cards[0].drivers.map(d => d.key);
  ok("focus maps point at real drivers",
    Object.keys(DRIVER_METRIC).every(k2 => driverKeys.includes(k2)) &&
    Object.keys(DRIVER_LAYER).every(k2 => driverKeys.includes(k2)));
  ok("mapped metrics exist", Object.values(DRIVER_METRIC)
    .every(mk => Object.keys(METRIC_ABS).includes(mk)));
  ok("mapped visit layers exist on every host",
    cards.every(k => Object.values(DRIVER_LAYER)
      .every(l => l in k.ops_scale.visit_mix)));

  let tagged = 0, matched = 0;
  for (const k of cards) {
    for (const p2 of k.recommended_plays || []) {
      ok(`${k.host_city}: "${p2.title.slice(0, 26)}" is tagged with drivers`,
        Array.isArray(p2.targets) && p2.targets.length > 0 &&
        p2.targets.every(t => driverKeys.includes(t)),
        JSON.stringify(p2.targets));
      tagged++;
    }
    for (const key of driverKeys) {
      if ((k.recommended_plays || []).some(p2 => (p2.targets || []).includes(key))) matched++;
    }
  }
  ok("plays are tagged at all", tagged > 0);
  ok("focusing a driver finds plays for most host/driver pairs", matched >= cards.length,
    `${matched} matching pairs across ${cards.length} hosts`);

  /* ------------------------------------------------------------------ */
  section("intervention lab");
  // The lab's arithmetic is a pure module; run it against the real levers.json
  // exactly as the Scenarios tab and the Compare tab's plays do.
  const LV = await mod("lib/levers.js");
  let LEV = null;
  try { LEV = readJSON("data/levers.json"); } catch (_) { /* reported below */ }
  ok("data/levers.json exists (python3 scripts/build_levers.py)", !!LEV);
  if (LEV) {
    ok("levers carry the fields the cards need",
      LEV.levers.every(l => l.id && l.title && l.plain && l.bucket && l.evidence && l.evidence_plain &&
        Array.isArray(l.dials) && l.best_source && l.best_source.u && (l.offmap || l.cuts)));
    ok("every bucket the lab lists exists on some lever",
      LV.BUCKETS.every(([b]) => LEV.levers.some(l => l.bucket === b)),
      LV.BUCKETS.map(b => b[0]).join(", "));
    ok("every cut is [low, mid, high] fractions in order",
      LEV.levers.filter(l => l.cuts).every(l => Object.values(l.cuts).every(cs => Object.values(cs).every(v =>
        v.length === 3 && v[0] <= v[1] && v[1] <= v[2] && v[0] >= 0 && v[2] <= 1))));
    ok("every shop type a lever touches has a factor",
      LEV.levers.filter(l => l.cuts).every(l => Object.keys(l.cuts).every(s =>
        LEV.segments[s] && ["kwh", "water", "co2"].every(r => isFinite(LEV.segments[s].factor[r])))));
    ok("every lever has a cost tier", LEV.levers.every(l => l.cost_tier && typeof l.cost_tier.t === "string"));
    let matches = [];
    try { matches = readJSON("data/matches.json"); } catch (_) { /* optional */ }

    for (const k of cards) {
      const { seg, tot } = LV.segmentPiles(LEV, [k]);
      const a = k.ops_scale.absolute;
      // the shop-type split must add back up to D's city totals, or the lab disagrees with the Overview
      const sums = Object.fromEntries(["kwh", "water", "co2"].map(r =>
        [r, Object.values(seg).reduce((s, x) => s + x[r], 0)]));
      ok(`${k.host_city}: shop-type piles add up to the city totals`,
        Math.abs(sums.kwh - a.energy_kwh) < 1e-3 * a.energy_kwh &&
        Math.abs(sums.water - a.water_liters) < 1e-3 * a.water_liters &&
        Math.abs(sums.co2 - a.kg_co2e) < 1e-3 * a.kg_co2e,
        JSON.stringify(sums));
      ok(`${k.host_city}: totals are the absolutes`,
        tot.kwh === a.energy_kwh && tot.water === a.water_liters && tot.co2 === a.kg_co2e);

      const R = LV.rankLevers(LEV, [k], k, matches.filter(m => m.m === k.host_city));
      ok(`${k.host_city}: every lever ranks with finite cuts in [0, 1]`,
        R.rows.length === LEV.levers.length && R.rows.every(x =>
          ["kwh", "water", "co2"].every(r => isFinite(x.cut[r]) && x.cut[r] >= 0 && x.cut[r] <= 1) &&
          x.reach >= 0 && x.reach <= 1));
      ok(`${k.host_city}: something helps`, R.pressing.length > 0);
      if (R.worst) {
        ok(`${k.host_city}: ranked by the worst driver's cut`,
          R.rows.every((x, i) => i === 0 || R.rows[i - 1].cut[R.worst] >= x.cut[R.worst] - 1e-12));
      }
    }

    // all levers on: compounding never beats 100 % and never adds
    const allOn = new Set(LEV.levers.map(l => l.id));
    const keep = LV.combinedCuts(LEV, allOn);
    ok("combined keep fractions stay inside (0, 1]",
      Object.values(keep).every(cs => Object.values(cs).every(v => v.every(x => x > 0 && x <= 1))));
    const H = cards[0];
    const { seg: sH, tot: tH } = LV.segmentPiles(LEV, [H]);
    const cut = LV.totalCut(sH, tH, keep);
    const single = LEV.levers.filter(l => l.cuts).map(l => LV.aloneCut(l, sH, tH));
    ok("all levers together cut less than or equal to the sum of each alone",
      ["kwh", "water", "co2"].every(r => cut[r][1] <= single.reduce((s, x) => s + (x[r] || 0), 0) + 1e-9));
    ok("low ≤ mid ≤ high after compounding",
      ["kwh", "water", "co2"].every(r => cut[r][0] <= cut[r][1] + 1e-12 && cut[r][1] <= cut[r][2] + 1e-12));

    // "All 11 hosts" is the same arithmetic over every card
    const allPiles = LV.segmentPiles(LEV, cards);
    ok("all-hosts totals are the sum of the cities",
      Math.abs(allPiles.tot.kwh - cards.reduce((s, k) => s + k.ops_scale.absolute.energy_kwh, 0)) < 1e-6);

    // the organiser's own lever takes the same shape as a studied one
    const seg0 = Object.keys(LEV.segments)[0], f0 = LEV.segments[seg0].factor;
    const mine = LV.buildCustomLever(LEV, { id: "custom_t", title: "t", segs: [seg0], cost: 1,
      pv: { [seg0]: { kwh: [f0.kwh / 4, f0.kwh / 2, f0.kwh] } } });
    ok("custom lever: kWh per visit becomes a [low, mid, high] fraction",
      mine.custom && mine.cuts[seg0] && Math.abs(mine.cuts[seg0].kwh[1] - 0.5) < 1e-12 && mine.cuts[seg0].kwh[2] === 1,
      JSON.stringify(mine.cuts));
    const fans = LV.buildCustomLever(LEV, { id: "custom_f", title: "f", fans: true, pf: { co2: [1, 2, 3] } });
    ok("custom lever for fans lives on the match card", fans.offmap && fans.bucket === "match day" && !fans.cuts);
  }

  // the shell wiring the lab depends on
  const bootSrc = fs.readFileSync(path.join(APP, "js/boot.js"), "utf8");
  ok("boot loads levers.json and matches.json", /data\/levers\.json/.test(bootSrc) && /data\/matches\.json/.test(bootSrc));
  ok("boot offers All 11 hosts", /ALL = "__all__"/.test(bootSrc) && /isAll/.test(bootSrc));
  ok("boot keeps levers in the hash", /levers=/.test(bootSrc));
  ok("boot listens to the map (levers and city)", /__leversFromMap/.test(bootSrc) && /__cityFromMap/.test(bootSrc));
  const spSrc = fs.readFileSync(path.join(APP, "js/views/spatial.js"), "utf8");
  ok("the map frame gets levers, custom levers and reports its height",
    /setLevers/.test(spSrc) && /setCustomLevers/.test(spSrc) && /__frameHeight/.test(spSrc));
  const scSrc = fs.readFileSync(path.join(APP, "js/views/scenarios.js"), "utf8");
  ok("scenarios draws levers, the ranking and the custom form",
    /drawLevers/.test(scSrc) && /drawLeverRank/.test(scSrc) && /customFormHtml/.test(scSrc));
  const cmSrc = fs.readFileSync(path.join(APP, "js/views/compare.js"), "utf8");
  ok("compare's plays come from levers.json", /rankLevers/.test(cmSrc) && /levers\.json/.test(cmSrc));
  const ovSrc = fs.readFileSync(path.join(APP, "js/views/overview.js"), "utf8");
  ok("the Overview's plays come from levers.json too", /rankLevers/.test(ovSrc) && /drawLeverPlays/.test(ovSrc));
  const spatialHtml = fs.readFileSync(path.join(APP, "spatial.html"), "utf8");
  ok("spatial.html still exposes setLevers / setCustomLevers and calls back",
    /window\.setLevers\s*=/.test(spatialHtml) && /window\.setCustomLevers\s*=/.test(spatialHtml) &&
    /__leversFromMap/.test(spatialHtml) && /__frameHeight/.test(spatialHtml));
  ok("pages.css styles the lab", /\.lever\b/.test(fs.readFileSync(path.join(APP, "css/pages.css"), "utf8")));

  /* ------------------------------------------------------------------ */
  section("assets");
  const IMG_SLUG = {
    "New York/New Jersey": "new-york",
    "San Francisco Bay Area": "san-francisco",
    "Kansas City": "kansas-city",
    "Los Angeles": "los-angeles",
  };
  const slugOf = c => IMG_SLUG[c] || c.toLowerCase().replace(/[^a-z]+/g, "-");
  let lqip = {};
  try { lqip = readJSON("assets/img/lqip.json"); } catch (_) { /* reported below */ }
  ok("lqip.json exists with 11 entries", Object.keys(lqip).length === 11);
  for (const c of S.cities) {
    const s = slugOf(c);
    ok(`${c}: photo derivatives exist`,
      fs.existsSync(path.join(APP, "assets/img", `${s}-1200.webp`)) &&
      fs.existsSync(path.join(APP, "assets/img", `${s}-320.webp`)),
      `expected assets/img/${s}-{1200,320}.webp`);
    ok(`${c}: has a blur-up placeholder`, typeof lqip[c] === "string" && lqip[c].startsWith("data:"));
  }
  for (const c of S.cities) {
    const f = path.join(APP, "data", "city_cards", `${c.toLowerCase().replace(/\//g, "_").replace(/ /g, "_")}.md`);
    ok(`${c}: one-pager exists`, fs.existsSync(f), f);
  }

  /* ------------------------------------------------------------------ */
  section("wiring");
  const html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
  ok("index.html has no iframe", !/<iframe/i.test(html));
  ok("index.html loads boot.js as a module", /type="module"[^>]*js\/boot\.js/.test(html));
  for (const css of ["css/base.css", "css/overview.css", "css/pages.css"]) {
    ok(`${css} is linked and present`,
      html.includes(css) && fs.existsSync(path.join(APP, css)));
  }
  // the compositing cost that made the old shell drop frames — comments don't count
  const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

  // The host picker opens past the banner's bottom edge. overflow:hidden on the
  // banner clips it with no error — the photo is clipped by .bmedia instead.
  const ovCss = stripComments(fs.readFileSync(path.join(APP, "css/overview.css"), "utf8"));
  const bannerRule = (ovCss.match(/\.banner\s*\{[^}]*\}/) || [""])[0];
  ok("the banner does not clip its overflow", !/overflow\s*:\s*hidden/.test(bannerRule), bannerRule);
  ok(".bmedia clips the photo instead",
    /\.banner\s+\.bmedia\s*\{[^}]*overflow\s*:\s*hidden/.test(ovCss));
  ok("the picker markup uses the media wrapper",
    /class="bmedia"/.test(fs.readFileSync(path.join(APP, "js/views/overview.js"), "utf8")));
  ok("no backdrop-filter declared in css/",
    !fs.readdirSync(path.join(APP, "css"))
      .some(f => /backdrop-filter\s*:/.test(
        stripComments(fs.readFileSync(path.join(APP, "css", f), "utf8")))));
  ok("every driver has an icon", cards[0].drivers.every(d => DRIVER_ICON[d.key]));
  ok("icon() returns svg", icon("energy").startsWith("<svg"));
  // hairline icons read as tentative next to the display face
  ok("icons are drawn at a heavy stroke", /stroke-width="2(\.\d)?"/.test(icon("grid")), icon("grid"));
  for (const n of ["grid", "chev", "chevDown", "map", "layers", "sliders", "moon", "sun"]) {
    ok(`icon "${n}" is defined`, icon(n).length > 90 && icon(n) !== icon("__missing__"));
  }

  for (const f of ["favicon.ico", "assets/icon.png",
                   "assets/img/icon-32.png", "assets/img/icon-64.png", "assets/img/icon-192.png"]) {
    ok(`${f} exists`, fs.existsSync(path.join(APP, f)));
  }
  ok("index.html links the favicon", /rel="icon"/.test(html));
  ok("the rail uses the icon asset, not initials",
    /icon-64\.png/.test(fs.readFileSync(path.join(APP, "js/boot.js"), "utf8")));
  ok("both display and text faces are loaded",
    /Montserrat/.test(html) && /Manrope/.test(html));

  /* ------------------------------------------------------------------ */
  section("theme parity");
  // Views bake colours into markup by reading these at render time, so a token
  // the dark block forgets silently renders a light-theme colour on a dark card.
  const base = fs.readFileSync(path.join(APP, "css", "base.css"), "utf8");
  const block = re => (base.match(re) || [""])[0];
  const props = s => new Set([...s.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));

  const lightBlock = block(/:root\s*\{[\s\S]*?\n\}/);
  const light = props(lightBlock);
  const dark = props(block(/:root\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/));

  // a token whose value is itself var(--x) resolves at use time and tracks the
  // dark --x automatically, so the dark block need not restate it
  const aliases = new Set(
    [...lightBlock.matchAll(/(--[a-z0-9-]+)\s*:\s*var\(/gi)].map(m => m[1]));

  ok("dark theme defines tokens", dark.size > 10, `got ${dark.size}`);
  const COLOURY = /^--(bg|surface|line|ink|accent|c-|v-|sh-)/;
  const missing = [...light].filter(p => COLOURY.test(p) && !dark.has(p) && !aliases.has(p));
  ok("dark theme overrides every colour token", missing.length === 0, missing.join(", "));
  const orphan = [...dark].filter(p => !light.has(p));
  ok("no token is defined only in the dark block", orphan.length === 0, orphan.join(", "));

  // palette.js caches a fixed key list; anything it asks for must actually exist
  const paletteSrc = fs.readFileSync(path.join(APP, "js/lib/palette.js"), "utf8");
  const asked = [...paletteSrc.matchAll(/"(--[a-z0-9-]+)"/g)].map(m => m[1]);
  const unknown = asked.filter(p => !light.has(p));
  ok("palette.js only reads tokens that exist", unknown.length === 0, unknown.join(", "));

  /* ------------------------------------------------------------------ */
  section("formatting");
  ok("fmt compacts billions", fmt(24_700_000_000) === "24.7B", fmt(24_700_000_000));
  ok("ordinal", ordinal(1) === "1st" && ordinal(2) === "2nd" && ordinal(11) === "11th");
  ok("pretty month", pretty("2024-06") === "Jun 2024", pretty("2024-06"));

  /* ------------------------------------------------------------------ */
  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.error(`${failures} FAILED`);
    process.exit(1);
  }
  console.log("shell OK");
}

main().catch(err => { console.error(err); process.exit(1); });
