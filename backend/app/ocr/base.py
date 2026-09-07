from abc import ABC, abstractmethod
from typing import List, Dict, Any
from pydantic import BaseModel

class OCRWord(BaseModel):
    text: str
    confidence: float
    bbox: Dict[str, int] # x, y, w, h
    line_num: int
    block_num: int

class OCRLine(BaseModel):
    text: str
    confidence: float
    words: List[OCRWord]
    line_num: int
    bbox: Dict[str, int]

class OCRResult(BaseModel):
    raw_text: str
    lines: List[OCRLine]
    mean_confidence: float
    engine_name: str
    language: str

class BaseOCREngine(ABC):
    @abstractmethod
    def recognize(self, image_bytes: bytes, language: str = "sr-Latn") -> OCRResult:
        """
        Glavna OCR metoda koja prima bajtove slike i vraća strukturisan OCRResult
        sa pouzdanošću po rečima i linijama.
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Proverava da li je engine instaliran i spreman za rad."""
        pass
