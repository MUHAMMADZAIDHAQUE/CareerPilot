from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import re


class StorageService(ABC):
    """
    Abstract Base Class for Tenant-Isolated Persistent Storage.
    Enforces user-scoped storage paths, signed access, and anti-path-traversal guarantees.
    """

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitizes filename to prevent directory traversal and illegal characters."""
        # Strip directory parts
        clean = filename.replace("\\", "/").split("/")[-1]
        # Remove any non-alphanumeric except . _ -
        clean = re.sub(r"[^\w\.\-]", "_", clean)
        return clean or "unnamed_file"

    @staticmethod
    def build_storage_key(user_id: str, subfolder: str, filename: str) -> str:
        """Constructs canonical user-scoped storage path: users/{user_id}/{subfolder}/{filename}"""
        safe_user = re.sub(r"[^\w\-]", "_", user_id)
        safe_folder = re.sub(r"[^\w\-]", "_", subfolder)
        safe_name = StorageService.sanitize_filename(filename)
        return f"users/{safe_user}/{safe_folder}/{safe_name}"

    @staticmethod
    def verify_ownership(storage_key: str, user_id: Optional[str]) -> None:
        """Verifies that the requested storage key belongs to the authenticated user."""
        if not user_id:
            return  # Internal or system-level access
        safe_user = re.sub(r"[^\w\-]", "_", user_id)
        expected_prefix = f"users/{safe_user}/"
        if not storage_key.startswith(expected_prefix):
            raise PermissionError(
                f"Unauthorized storage access: User '{user_id}' does not own resource '{storage_key}'."
            )

    @abstractmethod
    async def upload_file(
        self,
        user_id: str,
        content: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
        is_public: bool = False,
        subfolder: str = "resumes",
    ) -> str:
        """Uploads a file to storage and returns its canonical storage key."""
        pass

    @abstractmethod
    async def download_file(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Downloads file contents as bytes, verifying user ownership."""
        pass

    @abstractmethod
    async def get_signed_url(
        self,
        storage_key: str,
        expires_in: int = 3600,
        user_id: Optional[str] = None,
    ) -> str:
        """Generates a temporary signed URL or authenticated streaming route."""
        pass

    @abstractmethod
    async def delete_file(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> bool:
        """Deletes a file from storage after verifying ownership."""
        pass

    @abstractmethod
    async def file_exists(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> bool:
        """Checks if a storage key exists and is accessible."""
        pass

    @abstractmethod
    async def get_metadata(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Returns file metadata (size, content_type, updated_at)."""
        pass
