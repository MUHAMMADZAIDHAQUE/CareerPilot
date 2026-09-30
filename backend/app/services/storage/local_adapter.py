import os
import hmac
import hashlib
import time
from pathlib import Path
from typing import Optional, Dict, Any

from backend.app.services.storage.base import StorageService
from backend.app.core.config import settings
from backend.app.core.logging import logger


class LocalStorageAdapter(StorageService):
    """
    Local filesystem storage adapter for development and testing.
    Stores files under data/storage/users/{user_id}/...
    Strictly prevents directory traversal and enforces user scoping.
    """

    def __init__(self, root_dir: Optional[str] = None):
        self.root_dir = Path(root_dir or getattr(settings, "STORAGE_LOCAL_ROOT", "data/storage")).resolve()
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.secret_key = settings.SECRET_KEY.encode("utf-8")

    def _resolve_safe_path(self, storage_key: str, user_id: Optional[str] = None) -> Path:
        """Resolves storage key to absolute path and verifies containment inside root_dir."""
        self.verify_ownership(storage_key, user_id)
        # Explicit anti-traversal check
        if ".." in storage_key or storage_key.startswith("/"):
            raise PermissionError(f"Directory traversal detected for storage key: '{storage_key}'.")

        clean_key = storage_key.replace("\\", "/").lstrip("/")
        full_path = (self.root_dir / clean_key).resolve()

        # Strict containment check (anti-path traversal)
        try:
            full_path.relative_to(self.root_dir)
        except ValueError:
            raise PermissionError(f"Directory traversal detected for storage key: '{storage_key}'.")

        return full_path

    def _generate_signature(self, storage_key: str, expires_at: int) -> str:
        msg = f"{storage_key}:{expires_at}".encode("utf-8")
        return hmac.new(self.secret_key, msg, hashlib.sha256).hexdigest()

    def verify_signature(self, storage_key: str, expires_at: int, signature: str) -> bool:
        if time.time() > expires_at:
            return False
        expected = self._generate_signature(storage_key, expires_at)
        return hmac.compare_digest(expected, signature)

    async def upload_file(
        self,
        user_id: str,
        content: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
        is_public: bool = False,
        subfolder: str = "resumes",
    ) -> str:
        storage_key = self.build_storage_key(user_id=user_id, subfolder=subfolder, filename=filename)
        path = self._resolve_safe_path(storage_key, user_id=user_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        logger.info(f"LocalStorage: Saved {len(content)} bytes to {storage_key}")
        return storage_key

    async def download_file(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> bytes:
        path = self._resolve_safe_path(storage_key, user_id=user_id)
        if not path.is_file():
            raise FileNotFoundError(f"Storage file not found: '{storage_key}'.")
        return path.read_bytes()

    async def get_signed_url(
        self,
        storage_key: str,
        expires_in: int = 3600,
        user_id: Optional[str] = None,
    ) -> str:
        self.verify_ownership(storage_key, user_id)
        expires_at = int(time.time()) + expires_in
        sig = self._generate_signature(storage_key, expires_at)
        return f"{settings.API_V1_PREFIX}/storage/stream?key={storage_key}&expires={expires_at}&sig={sig}"

    async def delete_file(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> bool:
        path = self._resolve_safe_path(storage_key, user_id=user_id)
        if path.is_file():
            path.unlink()
            return True
        return False

    async def file_exists(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> bool:
        try:
            path = self._resolve_safe_path(storage_key, user_id=user_id)
            return path.is_file()
        except (PermissionError, ValueError):
            return False

    async def get_metadata(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        path = self._resolve_safe_path(storage_key, user_id=user_id)
        if not path.is_file():
            raise FileNotFoundError(f"Storage file not found: '{storage_key}'.")
        stat = path.stat()
        return {
            "storage_key": storage_key,
            "size_bytes": stat.st_size,
            "modified_at": stat.st_mtime,
            "backend": "local",
        }
