import os
import subprocess
import tempfile
import csv
import io
from typing import List, Dict
from PIL import Image
from app.ocr.base import BaseOCREngine, OCRResult, OCRLine, OCRWord
from app.core.config import TESSERACT_CMD, TESSDATA_DIR
from app.ocr.preprocessor import ImagePreprocessor

class TesseractEngine(BaseOCREngine):
    def __init__(self):
        self.cmd = TESSERACT_CMD if os.path.exists(TESSERACT_CMD) else "tesseract"
        self.tessdata = os.path.abspath(TESSDATA_DIR)

    def is_available(self) -> bool:
        try:
            res = subprocess.run([self.cmd, "--version"], capture_output=True)
            return res.returncode == 0
        except Exception:
            return False

    def _map_language(self, language: str) -> str:
        lang_lower = language.lower()
        if "cyrl" in lang_lower or "cir" in lang_lower:
            return "srp"
        elif "latn" in lang_lower or "srp" in lang_lower:
            return "srp_latn"
        elif "en" in lang_lower:
            return "eng"
        return "srp_latn"

    def recognize(self, image_bytes: bytes, language: str = "sr-Latn") -> OCRResult:
        tess_lang = self._map_language(language)

        # 1. Preprocesiranje slike
        processed_cv2 = ImagePreprocessor.preprocess_pipeline(image_bytes)
        clean_img = ImagePreprocessor.clean_paper(processed_cv2)
        pil_img = Image.fromarray(clean_img)

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_img:
            temp_img_path = temp_img.name
            pil_img.save(temp_img_path, format="PNG")

        try:
            cmd_args = [
                self.cmd,
                "--tessdata-dir", self.tessdata,
                temp_img_path,
                "stdout",
                "-l", tess_lang,
                "-c", "tessedit_create_tsv=1"
            ]

            proc = subprocess.run(cmd_args, capture_output=True)
            tsv_output = proc.stdout.decode("utf-8", errors="replace")

            if not tsv_output.strip() or proc.returncode != 0:
                # Fallback na engleski
                cmd_args_fallback = [
                    self.cmd,
                    "--tessdata-dir", self.tessdata,
                    temp_img_path,
                    "stdout",
                    "-l", "eng",
                    "-c", "tessedit_create_tsv=1"
                ]
                proc = subprocess.run(cmd_args_fallback, capture_output=True)
                tsv_output = proc.stdout.decode("utf-8", errors="replace")

            lines_dict: Dict[int, List[OCRWord]] = {}
            all_confidences = []

            reader = csv.DictReader(io.StringIO(tsv_output), delimiter="\t")
            for row in reader:
                text = (row.get("text") or "").strip()
                if not text:
                    continue

                conf_raw = float(row.get("conf", 0))
                conf = max(0.0, conf_raw / 100.0)
                all_confidences.append(conf)

                word = OCRWord(
                    text=text,
                    confidence=conf,
                    bbox={
                        "x": int(row.get("left", 0)),
                        "y": int(row.get("top", 0)),
                        "w": int(row.get("width", 0)),
                        "h": int(row.get("height", 0)),
                    },
                    line_num=int(row.get("line_num", 0)),
                    block_num=int(row.get("block_num", 0))
                )

                line_key = int(row.get("block_num", 0)) * 1000 + int(row.get("line_num", 0))
                if line_key not in lines_dict:
                    lines_dict[line_key] = []
                lines_dict[line_key].append(word)

            lines: List[OCRLine] = []
            raw_lines = []
            for l_num, words in lines_dict.items():
                line_text = " ".join(w.text for w in words)
                line_conf = sum(w.confidence for w in words) / len(words) if words else 0.0
                min_x = min(w.bbox['x'] for w in words)
                min_y = min(w.bbox['y'] for w in words)
                max_x = max(w.bbox['x'] + w.bbox['w'] for w in words)
                max_y = max(w.bbox['y'] + w.bbox['h'] for w in words)

                lines.append(OCRLine(
                    text=line_text,
                    confidence=line_conf,
                    words=words,
                    line_num=l_num,
                    bbox={"x": min_x, "y": min_y, "w": max_x - min_x, "h": max_y - min_y}
                ))
                raw_lines.append(line_text)

            mean_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0

            return OCRResult(
                raw_text="\n".join(raw_lines),
                lines=lines,
                mean_confidence=mean_conf,
                engine_name="tesseract",
                language=language
            )
        finally:
            if os.path.exists(temp_img_path):
                try: os.remove(temp_img_path)
                except Exception: pass
