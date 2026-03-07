from __future__ import annotations

import os
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def _test_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ENHANCER_DATABASE_URL", f"sqlite:///{tmp_path / 'enhancer-test.db'}")
    monkeypatch.setenv("ENHANCER_STORAGE_ROOT", str(tmp_path / "artifacts"))
    monkeypatch.setenv("ENHANCER_ENCRYPTION_SECRET", "test-secret")
    monkeypatch.setenv("ENHANCER_INLINE_EXECUTION", "true")
    monkeypatch.setenv("ENHANCER_ENABLE_ADVANCED_SANDBOX", "false")
    for module_name in list(os.sys.modules):
        if module_name.startswith("app."):
            del os.sys.modules[module_name]
