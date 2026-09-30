from typing import Optional
from backend.app.core.config import settings
from backend.app.services.storage.base import StorageService
from backend.app.services.storage.local_adapter import LocalStorageAdapter
from backend.app.services.storage.supabase_adapter import SupabaseStorageAdapter

_storage_instance: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    """
    Factory function returning the active StorageService singleton.
    Selects SupabaseStorageAdapter if STORAGE_BACKEND == 'supabase', else LocalStorageAdapter.
    """
    global _storage_instance
    if _storage_instance is None:
        backend = getattr(settings, "STORAGE_BACKEND", "local").lower()
        if backend == "supabase":
            _storage_instance = SupabaseStorageAdapter()
        else:
            _storage_instance = LocalStorageAdapter()
    return _storage_instance


def reset_storage_service() -> None:
    """Resets the singleton instance (useful for testing)."""
    global _storage_instance
    _storage_instance = None
