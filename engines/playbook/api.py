"""
Optional thin HTTP API for Plan D.

Run (requires fastapi + uvicorn):
  pip install fastapi uvicorn
  uvicorn engines.playbook.api:app --reload --port 8081

Endpoints are intentionally small so Plan A can proxy/import later.
"""

from __future__ import annotations

from functools import lru_cache

from .service import PlaybookService, build_default_service

try:
    from fastapi import FastAPI, HTTPException
except ImportError:  # pragma: no cover
    app = None  # type: ignore
else:
    app = FastAPI(
        title="Plan D — Eleven Hosts Playbook",
        version="0.2.0",
        description=(
            "Sustainability-readiness scorecards, peers, and transferable plays "
            "for FIFA 2026 U.S. host cities. Standalone back-engine for overlay on Plan A."
        ),
    )

    @lru_cache(maxsize=1)
    def get_service() -> PlaybookService:
        return build_default_service()

    @app.get("/health")
    def health():
        return {"ok": True, "engine": "plan_d_eleven_hosts_playbook", "version": "0.2.0"}

    @app.get("/playbook")
    def playbook():
        return get_service().build_payload()

    @app.get("/playbook/a-contract")
    def a_contract():
        """Frozen Plan A integration payload (contract 1.0.0)."""
        return get_service().build_a_contract()

    @app.get("/playbook/scorecards")
    def scorecards():
        return get_service().build_a_contract()["scorecards"]

    @app.get("/playbook/cities/{city}")
    def city_card(city: str):
        cards = get_service().build_a_contract()["scorecards"]
        match = next(
            (c for c in cards if c["host_city"].lower() == city.lower()),
            None,
        )
        if not match:
            raise HTTPException(status_code=404, detail=f"Unknown city: {city}")
        return match

    @app.get("/playbook/filter/{driver}")
    def filter_driver(driver: str):
        """Hosts with elevated z on a driver key (energy_kwh, kg_co2e, …)."""
        contract = get_service().build_a_contract()
        cities = contract["indexes"]["by_primary_driver"].get(driver)
        if cities is None:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown driver: {driver}. Use energy_kwh|kg_co2e|water_liters|cdd|uhi",
            )
        return {
            "driver": driver,
            "cities": cities,
            "scorecards": [
                c for c in contract["scorecards"] if c["host_city"] in cities
            ],
        }

    @app.post("/playbook/refresh")
    def refresh():
        get_service.cache_clear()
        paths = get_service().export()
        return {"refreshed": True, "artifacts": {k: str(v) for k, v in paths.items()}}
