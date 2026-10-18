"""Compatibility entry point used by Gatekeeper.reset()."""

import importlib.util
from pathlib import Path

_source = Path(__file__).resolve().parents[1] / "loader.py"
_spec = importlib.util.spec_from_file_location("gatekeeper_data_source_loader", _source)
if _spec is None or _spec.loader is None:
    raise ImportError(f"cannot load {_source}")
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)
load_real_data = _module.load_real_data

__all__ = ["load_real_data"]
