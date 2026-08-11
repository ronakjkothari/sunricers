# sunricers

Rice Urban Sustainability Hackathon — **Track 2: Energy–Food–Water Nexus**

## Start here (teammates)

1. [`docs/TRACK2_DATA_SHORTLIST.md`](docs/TRACK2_DATA_SHORTLIST.md) — what data matters and why  
2. [`docs/DATA_TECH_DOCUMENT.md`](docs/DATA_TECH_DOCUMENT.md) — schemas, intensity factors, joins  
3. [`docs/PROPOSED_SOLUTION_PLANS.md`](docs/PROPOSED_SOLUTION_PLANS.md) — 4 architectures to brainstorm from  
4. **[`data/curated/`](data/curated/)** — viz-ready CSV package (load these, not the 8 GB raw dumps)

## Rebuild curated package

Requires local raw `*-rice` folders under Downloads (paths set in the script) and `duckdb`:

```bash
pip install duckdb
python scripts/build_track2_curated_package.py
```

## Hackathon

[Devpost — Rice Urban Sustainability Hackathon](https://rice-urban-sustainability.devpost.com/)
