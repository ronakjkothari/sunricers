"""
Plan D — Eleven Hosts Playbook engine.

Standalone backend that computes sustainability-readiness scorecards,
peer sets, and transferable intervention plays for the 11 U.S. FIFA 2026
host cities. Designed to be consumed later by Plan A (Nexus Pulse) UI.
"""

from .config import PlaybookConfig
from .service import PlaybookService, build_default_service

__all__ = ["PlaybookConfig", "PlaybookService", "build_default_service"]
