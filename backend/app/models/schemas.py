from enum import Enum
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class DocumentType(str, Enum):
    DOCUMENT = "document"
    HANDWRITING = "handwriting"
    RECEIPT = "receipt"
    FORM = "form"
    TABLE = "table"
    AUTO = "auto"

class BlockType(str, Enum):
    TITLE = "title"
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    LIST_ITEM = "list_item"
    FIELD = "field"
    TABLE = "table"

class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class DocumentBlock(BaseModel):
    id: str
    type: BlockType
    content: str = ""
    level: Optional[int] = None
    key: Optional[str] = None
    value: Optional[str] = None
    headers: Optional[List[str]] = None
    rows: Optional[List[List[str]]] = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    needs_review: bool = False
    review_reason: Optional[str] = None

class DocumentMetadata(BaseModel):
    created_at: str
    original_filename: str
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    ocr_engine: str = "tesseract"
    processing_time_ms: float = 0.0
    overall_confidence: float = 1.0

class UniversalDocument(BaseModel):
    id: str
    title: str = ""
    doc_type: DocumentType = DocumentType.DOCUMENT
    language: str = "sr-Latn"
    status: DocumentStatus = DocumentStatus.COMPLETED
    blocks: List[DocumentBlock] = Field(default_factory=list)
    metadata: DocumentMetadata

class AnalysisStatusResponse(BaseModel):
    id: str
    status: DocumentStatus
    progress: int = 100
    message: Optional[str] = None

class AnalysisCreateResponse(BaseModel):
    analysis_id: str
    status: DocumentStatus
    message: str

class UpdateBlockRequest(BaseModel):
    blocks: List[DocumentBlock]
    title: Optional[str] = None
