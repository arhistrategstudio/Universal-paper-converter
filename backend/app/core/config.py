import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
TESSDATA_DIR = os.getenv("TESSDATA_PREFIX", str(BASE_DIR / "tessdata"))
TESSERACT_CMD = os.getenv("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")

MAX_UPLOAD_SIZE_MB = 20
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}

# Session retention (minuta pre automatskog čišćenja privremenih fajlova)
SESSION_EXPIRY_MINUTES = 30
