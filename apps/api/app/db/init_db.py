from app.db.models import ApiKey, Artifact, FileRecord, FileSheet, PlanVersion, ResearchEvidence
from app.db.models import RowResult, RunEvent, RunMessage, RunRecord, WorkspaceSettings
from app.db.session import Base, engine


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
