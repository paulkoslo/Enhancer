from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import FileRecord, FileSheet
from app.domain.artifacts.service import ArtifactService
from app.domain.runs.types import ArtifactKind


COLUMN_NAME_HINTS = {
    "company": ["company", "company name", "kundenname", "organization", "firma", "name"],
    "website": ["website", "domain", "url", "webseite"],
    "address": ["address", "street", "straße", "street 1"],
    "city": ["city", "ort", "town"],
    "country": ["country", "land"],
}


class WorkbookService:
    def __init__(self) -> None:
        self.artifacts = ArtifactService()

    async def ingest_upload(self, session: Session, upload: UploadFile) -> FileRecord:
        data = await upload.read()
        file_record = FileRecord(
            original_name=upload.filename or "upload.xlsx",
            media_type=upload.content_type or "application/octet-stream",
            size_bytes=len(data),
            storage_key="",
            metadata_json={},
        )
        session.add(file_record)
        session.flush()
        artifact = self.artifacts.save_bytes(
            session,
            kind=ArtifactKind.UPLOAD,
            data=data,
            content_type=file_record.media_type,
            file_id=file_record.id,
            suffix=Path(file_record.original_name).suffix,
        )
        file_record.storage_key = artifact.storage_key
        self._persist_sheet_metadata(session, file_record=file_record, data=data)
        session.flush()
        return file_record

    def _persist_sheet_metadata(self, session: Session, *, file_record: FileRecord, data: bytes) -> None:
        workbook = self.read_workbook(data=data, filename=file_record.original_name)
        for sheet_name, dataframe in workbook.items():
            preview = dataframe.head(5).fillna("").to_dict(orient="records")
            profile = self.profile_sheet(dataframe)
            file_sheet = FileSheet(
                file_id=file_record.id,
                sheet_name=sheet_name,
                row_count=int(len(dataframe)),
                column_count=int(len(dataframe.columns)),
                columns_json=[str(column) for column in dataframe.columns],
                preview_json=preview,
                profile_json=profile,
            )
            session.add(file_sheet)

    def read_workbook(self, *, data: bytes | None = None, filename: str, path: str | None = None) -> dict[str, pd.DataFrame]:
        suffix = Path(filename).suffix.lower()
        if suffix == ".csv":
            if data is not None:
                return {"Data": pd.read_csv(BytesIO(data))}
            if path is None:
                raise ValueError("path required when reading from disk")
            return {"Data": pd.read_csv(path)}
        if data is not None:
            excel = pd.ExcelFile(BytesIO(data))
        elif path is not None:
            excel = pd.ExcelFile(path)
        else:
            raise ValueError("data or path required")
        return {sheet_name: pd.read_excel(excel, sheet_name=sheet_name) for sheet_name in excel.sheet_names}

    def load_sheet_dataframe(self, session: Session, *, file_id: str, sheet_name: str) -> pd.DataFrame:
        file_record = session.get(FileRecord, file_id)
        if file_record is None:
            raise ValueError("file not found")
        path = self.artifacts.storage.resolve_path(file_record.storage_key)
        if path is not None:
            workbook = self.read_workbook(filename=file_record.original_name, path=path)
        else:
            data = self.artifacts.storage.read_bytes(file_record.storage_key)
            workbook = self.read_workbook(filename=file_record.original_name, data=data)
        return workbook[sheet_name]

    def list_sheets(self, session: Session, file_id: str) -> list[FileSheet]:
        stmt = select(FileSheet).where(FileSheet.file_id == file_id).order_by(FileSheet.sheet_name.asc())
        return list(session.scalars(stmt))

    def profile_sheet(self, dataframe: pd.DataFrame) -> dict[str, Any]:
        columns = [str(column) for column in dataframe.columns]
        normalized_columns = {column.lower().strip(): column for column in columns}
        candidate_columns: dict[str, str | None] = {}
        for category, hints in COLUMN_NAME_HINTS.items():
            candidate_columns[category] = None
            for hint in hints:
                match = next((original for normalized, original in normalized_columns.items() if hint in normalized), None)
                if match:
                    candidate_columns[category] = match
                    break
        return {
            "columns": columns,
            "column_types": {str(column): str(dtype) for column, dtype in dataframe.dtypes.items()},
            "candidate_columns": candidate_columns,
            "missingness": {
                str(column): float(dataframe[column].isna().mean()) for column in dataframe.columns
            },
            "entity_type": "company" if candidate_columns.get("company") else "generic_table",
        }
