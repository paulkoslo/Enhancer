from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.models import FileRecord
from app.db.session import get_session
from app.domain.workbooks.service import WorkbookService
from app.schemas.files import FileResponse, FileSheetResponse


router = APIRouter()
service = WorkbookService()


def _serialize_file(file_record: FileRecord, session: Session) -> FileResponse:
    sheets = service.list_sheets(session, file_record.id)
    return FileResponse(
        id=file_record.id,
        original_name=file_record.original_name,
        media_type=file_record.media_type,
        size_bytes=file_record.size_bytes,
        created_at=file_record.created_at,
        sheets=[
            FileSheetResponse(
                id=sheet.id,
                sheet_name=sheet.sheet_name,
                row_count=sheet.row_count,
                column_count=sheet.column_count,
                columns=sheet.columns_json,
                preview=sheet.preview_json,
                profile=sheet.profile_json,
            )
            for sheet in sheets
        ],
    )


@router.post("", response_model=FileResponse)
async def upload_file(
    upload: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> FileResponse:
    file_record = await service.ingest_upload(session, upload)
    session.commit()
    session.refresh(file_record)
    return _serialize_file(file_record, session)


@router.get("/{file_id}", response_model=FileResponse)
def get_file(file_id: str, session: Session = Depends(get_session)) -> FileResponse:
    file_record = session.get(FileRecord, file_id)
    if file_record is None:
        raise HTTPException(status_code=404, detail="File not found")
    return _serialize_file(file_record, session)
