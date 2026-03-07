from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import FileRecord, ResearchEvidence, RowResult
from app.domain.artifacts.service import ArtifactService
from app.domain.runs.types import ArtifactKind
from app.domain.workbooks.service import WorkbookService


class ExportService:
    def __init__(self) -> None:
        self.workbooks = WorkbookService()
        self.artifacts = ArtifactService()

    def export_run(self, session: Session, *, run_id: str, file_id: str, sheet_name: str) -> tuple[str, str]:
        dataframe = self.workbooks.load_sheet_dataframe(session, file_id=file_id, sheet_name=sheet_name).copy()
        row_results = list(
            session.scalars(select(RowResult).where(RowResult.run_id == run_id).order_by(RowResult.row_index.asc()))
        )
        for row_result in row_results:
            for key, value in row_result.output_json.items():
                dataframe.loc[row_result.row_index, key] = value

        audit_df = pd.DataFrame(
            [
                {
                    "row_index": row_result.row_index,
                    "status": row_result.status,
                    "validation_state": row_result.validation_state,
                    "confidence": row_result.confidence,
                    "warnings": ", ".join(row_result.warnings_json),
                }
                for row_result in row_results
            ]
        )
        evidence_df = pd.DataFrame(
            [
                {
                    "row_index": evidence.row_index,
                    "source_url": evidence.source_url,
                    "title": evidence.title,
                    "snippet": evidence.snippet,
                    "retrieved_at": evidence.retrieved_at,
                }
                for evidence in session.scalars(
                    select(ResearchEvidence)
                    .where(ResearchEvidence.run_id == run_id)
                    .order_by(ResearchEvidence.row_index.asc())
                )
            ]
        )

        file_record = session.get(FileRecord, file_id)
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            dataframe.to_excel(writer, sheet_name=sheet_name[:31], index=False)
            audit_df.to_excel(writer, sheet_name="Audit", index=False)
            evidence_df.to_excel(writer, sheet_name="Evidence", index=False)
        base_name = self._base_name(file_record.original_name if file_record else "enhanced.xlsx")
        artifact = self.artifacts.save_bytes(
            session,
            kind=ArtifactKind.FINAL_WORKBOOK,
            data=buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            run_id=run_id,
            file_id=file_id,
            suffix=".xlsx",
            metadata={
                "original_name": file_record.original_name if file_record else None,
                "filename": f"{base_name}-enhanced.xlsx",
            },
        )
        audit_artifact = self.artifacts.save_json(
            session,
            kind=ArtifactKind.AUDIT_REPORT,
            payload={
                "row_count": len(row_results),
                "evidence_count": len(evidence_df),
            },
            run_id=run_id,
            file_id=file_id,
        )
        session.flush()
        return artifact.id, audit_artifact.id

    def export_dry_run(self, session: Session, *, run_id: str, file_id: str, sheet_name: str) -> str:
        source_df = self.workbooks.load_sheet_dataframe(session, file_id=file_id, sheet_name=sheet_name).copy()
        row_results = list(
            session.scalars(select(RowResult).where(RowResult.run_id == run_id).order_by(RowResult.row_index.asc()))
        )
        sample_indices = [result.row_index for result in row_results]
        sample_df = source_df.iloc[sample_indices].copy() if sample_indices else source_df.head(0).copy()
        for row_result in row_results:
            for key, value in row_result.output_json.items():
                sample_df.loc[row_result.row_index, key] = value
        sample_df = sample_df.reset_index(drop=False).rename(columns={"index": "source_row_index"})

        evidence_rows = list(
            session.scalars(
                select(ResearchEvidence)
                .where(ResearchEvidence.run_id == run_id)
                .order_by(ResearchEvidence.row_index.asc(), ResearchEvidence.retrieved_at.asc())
            )
        )
        evidence_map: dict[int, list[str]] = {}
        for evidence in evidence_rows:
            evidence_map.setdefault(evidence.row_index, []).append(evidence.source_url)

        audit_df = pd.DataFrame(
            [
                {
                    "row_index": row_result.row_index,
                    "row_key": row_result.row_key,
                    "status": row_result.status,
                    "validation_state": row_result.validation_state,
                    "confidence": row_result.confidence,
                    "warnings": "; ".join(row_result.warnings_json),
                    "source_urls": "\n".join(evidence_map.get(row_result.row_index, [])),
                }
                for row_result in row_results
            ]
        )
        file_record = session.get(FileRecord, file_id)
        base_name = self._base_name(file_record.original_name if file_record else "dry-run.xlsx")
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            sample_df.to_excel(writer, sheet_name="Dry Run Results", index=False)
            audit_df.to_excel(writer, sheet_name="Dry Run Audit", index=False)
        artifact = self.artifacts.save_bytes(
            session,
            kind=ArtifactKind.DRY_RUN_RESULTS,
            data=buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            run_id=run_id,
            file_id=file_id,
            suffix=".xlsx",
            metadata={
                "filename": f"{base_name}-dry-run.xlsx",
                "sheet_name": sheet_name,
            },
        )
        session.flush()
        return artifact.id

    @staticmethod
    def _base_name(filename: str) -> str:
        return Path(filename).stem or "enhancer"
