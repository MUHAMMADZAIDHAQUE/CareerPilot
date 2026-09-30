from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from typing import Optional, Dict, Any
import io
import mimetypes

from backend.app.core.config import settings
from backend.app.services.storage.service import get_storage_service
from backend.app.services.storage.local_adapter import LocalStorageAdapter
from backend.app.api.deps import get_optional_current_user
from backend.app.models.user import User

router = APIRouter(prefix="/storage", tags=["Storage"])


@router.get("/status", summary="Storage Service Status")
async def get_storage_status() -> Dict[str, Any]:
    """Returns persistent storage status, active backend, and configuration."""
    storage = get_storage_service()
    backend_type = getattr(settings, "STORAGE_BACKEND", "local")
    return {
        "status": "operational",
        "backend": backend_type,
        "bucket": getattr(settings, "SUPABASE_STORAGE_BUCKET", "careerpilot-storage"),
        "local_root": getattr(settings, "STORAGE_LOCAL_ROOT", "data/storage"),
        "isolation_model": "tenant_scoped",
    }


@router.get("/stream", summary="Stream file via signed URL or active session")
async def stream_storage_file(
    key: str = Query(..., description="Canonical storage key"),
    expires: Optional[int] = Query(None, description="Expiration timestamp for signed URL"),
    sig: Optional[str] = Query(None, description="HMAC signature for signed URL"),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Streams stored file with anti-tamper signature or authenticated session check.
    Prevents unauthorized cross-tenant file inspection.
    """
    storage = get_storage_service()

    # Case 1: Signed URL verification
    is_valid_signed = False
    if expires and sig and isinstance(storage, LocalStorageAdapter):
        if storage.verify_signature(key, expires, sig):
            is_valid_signed = True
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or expired storage signature.",
            )

    # Case 2: Authenticated session check
    user_id = None
    if not is_valid_signed:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication or valid signature required to stream file.",
            )
        user_id = str(current_user.id)

    try:
        content = await storage.download_file(storage_key=key, user_id=user_id if not is_valid_signed else None)
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except FileNotFoundError as fe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fe))

    media_type, _ = mimetypes.guess_type(key)
    if not media_type:
        media_type = "application/pdf" if key.endswith(".pdf") else "application/octet-stream"

    filename = key.split("/")[-1]
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
