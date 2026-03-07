from __future__ import annotations

from dataclasses import dataclass

from .artifacts import ArtifactWriter
from .logging import RunLogger
from .models import ModelClient
from .research import ResearchClient
from .validation import ValidationClient
from .workbook import WorkbookClient


@dataclass(slots=True)
class SandboxContext:
    workbook: WorkbookClient
    research: ResearchClient
    models: ModelClient
    validation: ValidationClient
    logging: RunLogger
    artifacts: ArtifactWriter
