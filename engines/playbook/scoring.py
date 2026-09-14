from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field

from .config import PlaybookConfig

COMPONENT_KEYS = ("energy_kwh", "kg_co2e", "water_liters", "cdd", "uhi")

DRIVER_LABELS = {
    "energy_kwh": "Energy",
    "kg_co2e": "Food CO₂e",
    "water_liters": "Water",
    "cdd": "Cooling (CDD)",
    "uhi": "Urban heat",
}


@dataclass
class Scorecard:
    host_city: str
    raw: dict[str, float]
    z_components: dict[str, float]
    stress_index: float
    readiness_score: float  # 0–100, higher = more ready / lower relative nexus load
    readiness_band: tuple[float, float]  # uncertainty band
    rank: int | None = None
    peer_cities: list[str] | None = None
    recommended_plays: list[dict] | None = None
    general_options: list[dict] = field(default_factory=list)
    # where the city sits on each part's fitted curve, 0 = lowest load, 1 = highest
    p_components: dict[str, float] = field(default_factory=dict)

    def drivers(self) -> list[dict]:
        """Stable driver array for radar / parallel-coords / A triage filters."""
        rows = []
        for key in COMPONENT_KEYS:
            z = self.z_components.get(key, 0.0)
            rows.append(
                {
                    "key": key,
                    "label": DRIVER_LABELS[key],
                    "z": round(z, 4),
                    "p": round(self.p_components.get(key, 0.5), 4),
                    "elevated": z > 0,
                    "raw": round(self.raw.get(key, 0.0), 4),
                }
            )
        return rows

    def primary_pressure_drivers(self, top_n: int = 3) -> list[str]:
        elevated = [d for d in self.drivers() if d["elevated"]]
        elevated.sort(key=lambda d: d["z"], reverse=True)
        return [d["key"] for d in elevated[:top_n]]

    def to_dict(self) -> dict:
        return {
            "host_city": self.host_city,
            "rank": self.rank,
            "readiness_score": round(self.readiness_score, 2),
            "readiness_band": [
                round(self.readiness_band[0], 2),
                round(self.readiness_band[1], 2),
            ],
            "stress_index": round(self.stress_index, 4),
            "z_components": {k: round(v, 4) for k, v in self.z_components.items()},
            "p_components": {k: round(v, 4) for k, v in self.p_components.items()},
            "drivers": self.drivers(),
            "primary_pressure_drivers": self.primary_pressure_drivers(),
            "raw_indicators": {k: round(v, 4) for k, v in self.raw.items()},
            "peer_cities": self.peer_cities or [],
            "recommended_plays": self.recommended_plays or [],
            "general_options": self.general_options or [],
        }


def _zscores(values: list[float]) -> list[float]:
    if len(values) < 2:
        return [0.0] * len(values)
    mean = statistics.fmean(values)
    stdev = statistics.pstdev(values)
    if stdev == 0:
        return [0.0] * len(values)
    return [(v - mean) / stdev for v in values]


# ------------------------------------------------------------ fitted curves
# Each part gets the distribution that fit the 11 host cities best (maximum
# likelihood, ranked by AICc, fits that fail a KS test or start/end on a city
# thrown out; 37 scipy distributions tried, September 2026). A city's p is its
# position on that curve, so every part lands on the same 0 to 1 scale
# whatever its unit or skew. Fits are written out here so the engine keeps
# needing only the standard library; they match scipy.stats to 1e-4.

def _phi(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _golden(f, lo: float, hi: float, iters: int = 200) -> float:
    """Minimise a one-dimensional function on [lo, hi]."""
    g = (math.sqrt(5) - 1) / 2
    a, b = lo, hi
    c, d = b - g * (b - a), a + g * (b - a)
    fc, fd = f(c), f(d)
    for _ in range(iters):
        if fc < fd:
            b, d, fd = d, c, fc
            c = b - g * (b - a)
            fc = f(c)
        else:
            a, c, fc = c, d, fd
            d = a + g * (b - a)
            fd = f(d)
    return (a + b) / 2


def _ig_cdf(x: float, mean: float, shape: float) -> float:
    if x <= 0:
        return 0.0
    r = math.sqrt(shape / x)
    tail = 2.0 * shape / mean
    # exp(tail) * phi(-...) overflows for large tails; use the log form
    second = _phi(-r * (x / mean + 1.0))
    second = math.exp(tail + math.log(second)) if second > 0 else 0.0
    return min(1.0, _phi(r * (x / mean - 1.0)) + second)


def _ig_nll(xs: list[float], mean: float, shape: float) -> float:
    return -sum(
        0.5 * math.log(shape / (2 * math.pi * x ** 3)) - shape * (x - mean) ** 2 / (2 * mean ** 2 * x)
        for x in xs
    )


def _cdf_rayleigh(xs: list[float]):
    sigma2 = sum(x * x for x in xs) / (2 * len(xs))
    return lambda x: 1.0 - math.exp(-x * x / (2 * sigma2)) if x > 0 else 0.0


def _cdf_invgauss(xs: list[float]):
    mean = statistics.fmean(xs)
    shape = len(xs) / sum(1 / x - 1 / mean for x in xs)
    return lambda x: _ig_cdf(x, mean, shape)


def _cdf_wald(xs: list[float]):
    """scipy's wald: (x - loc) ~ inverse Gaussian with mean = shape = scale."""
    lo_x, span = min(xs), (max(xs) - min(xs)) or 1.0

    def best_scale(loc: float) -> tuple[float, float]:
        ys = [x - loc for x in xs]
        f = lambda ls: _ig_nll(ys, math.exp(ls), math.exp(ls))
        ls = _golden(f, math.log(1e-6 * span), math.log(1e3 * (max(ys) or 1.0)))
        return math.exp(ls), f(ls)

    loc = _golden(lambda l: best_scale(l)[1], lo_x - 20 * span, lo_x - 1e-9 * span, iters=120)
    scale = best_scale(loc)[0]
    return lambda x: _ig_cdf(x - loc, scale, scale)


def _cdf_gumbel_left(xs: list[float]):
    ys = [-x for x in xs]  # a left Gumbel on x is a right Gumbel on -x
    ybar = statistics.fmean(ys)

    def g(beta: float) -> float:
        w = [math.exp(-(y - ybar) / beta) for y in ys]
        return beta - ybar + sum(y * wi for y, wi in zip(ys, w)) / sum(w)

    lo, hi = 1e-6, 10 * (statistics.pstdev(ys) or 1.0)
    for _ in range(200):  # g rises with beta, so bisect
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if g(mid) < 0 else (lo, mid)
    beta = (lo + hi) / 2
    mu = ybar - beta * math.log(statistics.fmean(math.exp(-(y - ybar) / beta) for y in ys))
    return lambda x: 1.0 - math.exp(-math.exp(-(-x - mu) / beta))


PART_CURVES = {
    "energy_kwh": ("Rayleigh", _cdf_rayleigh),
    "kg_co2e": ("Wald", _cdf_wald),
    "water_liters": ("inverse Gaussian", _cdf_invgauss),
    "cdd": ("Rayleigh", _cdf_rayleigh),
    "uhi": ("Gumbel (left)", _cdf_gumbel_left),
}


def _pvalues(key: str, values: list[float]) -> list[float]:
    if len(values) < 2 or max(values) == min(values):
        return [0.5] * len(values)
    cdf = PART_CURVES[key][1](values)
    return [cdf(v) for v in values]


def compute_scorecards(
    indicators: dict[str, dict[str, float]],
    config: PlaybookConfig,
) -> list[Scorecard]:
    cities = sorted(indicators.keys())
    weights = config.weight_map()

    z_by_city: dict[str, dict[str, float]] = {c: {} for c in cities}
    p_by_city: dict[str, dict[str, float]] = {c: {} for c in cities}
    for key in COMPONENT_KEYS:
        vals = [indicators[c].get(key, 0.0) for c in cities]
        for city, z, p in zip(cities, _zscores(vals), _pvalues(key, vals)):
            z_by_city[city][key] = z
            p_by_city[city][key] = p

    # Stress adds each part's position on its curve, centred so a city in the
    # middle of every curve has stress 0. z is kept for the "above average"
    # wording and the plays; the rank comes from p.
    stress: dict[str, float] = {}
    for city in cities:
        stress[city] = sum(w * (p_by_city[city][key] - 0.5) for key, w in weights.items())

    stress_vals = [stress[c] for c in cities]
    s_min, s_max = min(stress_vals), max(stress_vals)
    span = (s_max - s_min) or 1.0

    cards: list[Scorecard] = []
    for city in cities:
        readiness = 100.0 * (s_max - stress[city]) / span
        band_delta = 100.0 * config.uncertainty_pct
        lo = max(0.0, readiness - band_delta)
        hi = min(100.0, readiness + band_delta)
        cards.append(
            Scorecard(
                host_city=city,
                raw=dict(indicators[city]),
                z_components=dict(z_by_city[city]),
                p_components=dict(p_by_city[city]),
                stress_index=stress[city],
                readiness_score=readiness,
                readiness_band=(lo, hi),
            )
        )

    cards.sort(key=lambda c: c.readiness_score, reverse=True)
    for i, card in enumerate(cards, start=1):
        card.rank = i
    return cards


def profile_vector(card: Scorecard) -> list[float]:
    return [card.z_components[k] for k in COMPONENT_KEYS]


def euclidean(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))
