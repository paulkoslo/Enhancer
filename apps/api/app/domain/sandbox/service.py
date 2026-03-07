from __future__ import annotations

import json
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from app.core.config import get_settings


class SandboxService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def run_script(
        self,
        *,
        code: str,
        tests: str,
        input_path: str,
    ) -> dict:
        if not self.settings.enable_advanced_sandbox:
            raise RuntimeError("Advanced sandbox mode is disabled.")
        with TemporaryDirectory(prefix="enhancer-sandbox-") as temp_dir:
            workdir = Path(temp_dir)
            (workdir / "generated.py").write_text(code, encoding="utf-8")
            (workdir / "test_generated.py").write_text(tests, encoding="utf-8")
            result = subprocess.run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "-v",
                    f"{workdir}:/workspace",
                    "-v",
                    f"{input_path}:/workspace/input",
                    "enhancer-sandbox:latest",
                    "python",
                    "-m",
                    "pytest",
                    "-q",
                    "/workspace/test_generated.py",
                ],
                capture_output=True,
                text=True,
            )
            return {
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "artifacts": json.dumps({"workdir": str(workdir)}),
            }
