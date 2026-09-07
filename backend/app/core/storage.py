import time
from typing import Dict, Optional
from app.models.schemas import UniversalDocument, DocumentStatus

class DocumentStore:
    """
    Privremena in-memory sesijska memorija.
    Čuva dokumente tokom aktivne sesije sa automatskim istekom radi privatnosti.
    """
    _docs: Dict[str, UniversalDocument] = {}
    _images: Dict[str, bytes] = {}
    _timestamps: Dict[str, float] = {}

    @classmethod
    def save(cls, doc: UniversalDocument, image_bytes: Optional[bytes] = None):
        cls._docs[doc.id] = doc
        cls._timestamps[doc.id] = time.time()
        if image_bytes:
            cls._images[doc.id] = image_bytes

    @classmethod
    def get(cls, doc_id: str) -> Optional[UniversalDocument]:
        return cls._docs.get(doc_id)

    @classmethod
    def get_image(cls, doc_id: str) -> Optional[bytes]:
        return cls._images.get(doc_id)

    @classmethod
    def update(cls, doc: UniversalDocument):
        if doc.id in cls._docs:
            cls._docs[doc.id] = doc
            cls._timestamps[doc.id] = time.time()

    @classmethod
    def delete(cls, doc_id: str):
        cls._docs.pop(doc_id, None)
        cls._images.pop(doc_id, None)
        cls._timestamps.pop(doc_id, None)

    @classmethod
    def cleanup_old(cls, max_age_seconds: int = 1800):
        """Uklanja podatke starije od 30 minuta radi privatnosti."""
        now = time.time()
        expired = [doc_id for doc_id, ts in cls._timestamps.items() if now - ts > max_age_seconds]
        for doc_id in expired:
            cls.delete(doc_id)
