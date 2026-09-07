import re
import uuid
from typing import List, Optional
from app.ocr.base import OCRResult, OCRLine
from app.models.schemas import DocumentBlock, BlockType

CONFIDENCE_THRESHOLD = 0.65  # Ispod 65% se označava za pregled ("Proveri")

class BaseStructureParser:
    def parse(self, ocr_result: OCRResult) -> List[DocumentBlock]:
        raise NotImplementedError

class GeneralDocumentParser(BaseStructureParser):
    def parse(self, ocr_result: OCRResult) -> List[DocumentBlock]:
        blocks: List[DocumentBlock] = []
        lines = ocr_result.lines

        if not lines:
            if ocr_result.raw_text.strip():
                # Fallback ako nema detektovanih linija u OCR
                for p in ocr_result.raw_text.strip().split("\n"):
                    p = p.strip()
                    if p:
                        blocks.append(DocumentBlock(
                            id=str(uuid.uuid4()),
                            type=BlockType.PARAGRAPH,
                            content=p,
                            confidence=ocr_result.mean_confidence,
                            needs_review=ocr_result.mean_confidence < CONFIDENCE_THRESHOLD
                        ))
            return blocks

        # Identifikacija naslova (prva linija ili velika slova/kratka linija)
        is_first = True
        for line in lines:
            text = line.text.strip()
            if not text:
                continue

            conf = line.confidence
            needs_review = conf < CONFIDENCE_THRESHOLD
            reason = f"Niska pouzdanost prepoznavanja ({int(conf * 100)}%)" if needs_review else None

            # 1. Proveri listu (crtica, zvezdica ili broj: 1. 2. itd)
            list_match = re.match(r"^(\*|\-|\u2022|\d+[\.\)])\s*(.+)", text)
            if list_match:
                blocks.append(DocumentBlock(
                    id=str(uuid.uuid4()),
                    type=BlockType.LIST_ITEM,
                    content=list_match.group(2).strip(),
                    confidence=conf,
                    needs_review=needs_review,
                    review_reason=reason
                ))
                is_first = False
                continue

            # 2. Prva linija ako je kratka i istaknuta -> Title
            if is_first and len(text) < 70 and not text.endswith('.'):
                blocks.append(DocumentBlock(
                    id=str(uuid.uuid4()),
                    type=BlockType.TITLE,
                    content=text,
                    confidence=conf,
                    needs_review=needs_review,
                    review_reason=reason
                ))
                is_first = False
                continue

            # 3. Podnaslov (kratka linija, velika slova ili bez tačke)
            if len(text) < 45 and not text.endswith('.') and (text.isupper() or len(blocks) > 0 and blocks[-1].type == BlockType.PARAGRAPH):
                blocks.append(DocumentBlock(
                    id=str(uuid.uuid4()),
                    type=BlockType.HEADING,
                    content=text,
                    level=2,
                    confidence=conf,
                    needs_review=needs_review,
                    review_reason=reason
                ))
                continue

            # 4. Standardni pasus
            blocks.append(DocumentBlock(
                id=str(uuid.uuid4()),
                type=BlockType.PARAGRAPH,
                content=text,
                confidence=conf,
                needs_review=needs_review,
                review_reason=reason
            ))
            is_first = False

        return blocks

class HandwritingParser(BaseStructureParser):
    def parse(self, ocr_result: OCRResult) -> List[DocumentBlock]:
        blocks: List[DocumentBlock] = []
        lines = ocr_result.lines

        # Za rukopis koristimo viši prag opreza jer je rukopis podložniji greškama
        handwriting_threshold = 0.70

        for idx, line in enumerate(lines):
            text = line.text.strip()
            if not text:
                continue

            conf = line.confidence
            needs_review = conf < handwriting_threshold
            reason = f"Proverite rukom pisani tekst ({int(conf * 100)}% pouzdanost)" if needs_review else None

            # Traženje datuma ili sastanka
            date_match = re.search(r"(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})", text)
            
            # Ako sadrži sastanak ili datum u prvim linijama
            if idx == 0 or ("sastanak" in text.lower() and len(text) < 60):
                blocks.append(DocumentBlock(
                    id=str(uuid.uuid4()),
                    type=BlockType.TITLE if idx == 0 else BlockType.HEADING,
                    content=text,
                    level=1 if idx == 0 else 2,
                    confidence=conf,
                    needs_review=needs_review,
                    review_reason=reason
                ))
                continue

            # Detekcija zadataka: npr "Ime - uraditi..." ili crtice
            task_match = re.match(r"^([A-ZŠĐČĆŽa-zšđčćž\s]+)\s*[\-\–\:]\s*(.+)", text)
            list_match = re.match(r"^(\*|\-|\u2022|\d+[\.\)])\s*(.+)", text)

            if list_match:
                blocks.append(DocumentBlock(
                    id=str(uuid.uuid4()),
                    type=BlockType.LIST_ITEM,
                    content=list_match.group(2).strip(),
                    confidence=conf,
                    needs_review=needs_review,
                    review_reason=reason
                ))
            elif task_match and len(task_match.group(1).split()) <= 2:
                # Format: Ime — zadatak
                blocks.append(DocumentBlock(
                    id=str(uuid.uuid4()),
                    type=BlockType.LIST_ITEM,
                    content=f"{task_match.group(1).strip()} — {task_match.group(2).strip()}",
                    confidence=conf,
                    needs_review=needs_review,
                    review_reason=reason
                ))
            else:
                blocks.append(DocumentBlock(
                    id=str(uuid.uuid4()),
                    type=BlockType.PARAGRAPH,
                    content=text,
                    confidence=conf,
                    needs_review=needs_review,
                    review_reason=reason
                ))

        return blocks

class ReceiptParser(BaseStructureParser):
    def parse(self, ocr_result: OCRResult) -> List[DocumentBlock]:
        blocks: List[DocumentBlock] = []
        lines = ocr_result.lines

        merchant_name = ""
        receipt_no = ""
        date_str = ""
        total_amount = ""
        items: List[List[str]] = []

        for idx, line in enumerate(lines):
            text = line.text.strip()
            if not text:
                continue

            # Prodavac: obično na vrhu (prve 2 linije)
            if idx == 0 and not merchant_name:
                merchant_name = text
                continue

            # Broj računa
            rn_match = re.search(r"(?:račun|racun|broj|rn|inv|receipt)[\s\:\#\-№]+([A-Za-z0-9\/\-]+)", text, re.I)
            if rn_match and not receipt_no:
                receipt_no = rn_match.group(1).strip()
                continue

            # Datum
            d_match = re.search(r"(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})", text)
            if d_match and not date_str:
                date_str = d_match.group(1).strip()

            # Ukupno
            total_match = re.search(r"(?:ukupno|total|iznos|za uplatu)[\s\:\-]+([0-9\.\,]+)", text, re.I)
            if total_match and not total_amount:
                total_amount = total_match.group(1).strip()
                continue

            # Stavke računa: tekst sa cenom/količinom na kraju
            item_match = re.match(r"^(.+?)\s+(\d+(?:[\.\,]\d+)?)\s*(?:kom|x|\*|)\s*([0-9\.\,]+)$", text)
            if item_match:
                item_name = item_match.group(1).strip()
                qty = item_match.group(2).strip()
                price = item_match.group(3).strip()
                items.append([item_name, qty, price])
            else:
                # Prosta stavka sa cenom na kraju
                price_match = re.match(r"^(.+?)\s+([0-9]+[0-9\.\,]*)$", text)
                if price_match and not any(k in text.lower() for k in ["ukupno", "total", "porez", "pdv", "datum"]):
                    items.append([price_match.group(1).strip(), "1", price_match.group(2).strip()])

        # Kreiranje strukturisanih blokova
        if merchant_name:
            blocks.append(DocumentBlock(
                id=str(uuid.uuid4()),
                type=BlockType.TITLE,
                content=merchant_name,
                confidence=0.9
            ))

        if receipt_no:
            blocks.append(DocumentBlock(
                id=str(uuid.uuid4()),
                type=BlockType.FIELD,
                content=f"Broj računa: {receipt_no}",
                key="Broj računa",
                value=receipt_no,
                confidence=0.9
            ))

        if date_str:
            blocks.append(DocumentBlock(
                id=str(uuid.uuid4()),
                type=BlockType.FIELD,
                content=f"Datum: {date_str}",
                key="Datum",
                value=date_str,
                confidence=0.9
            ))

        if items:
            blocks.append(DocumentBlock(
                id=str(uuid.uuid4()),
                type=BlockType.TABLE,
                content="Stavke računa",
                headers=["Naziv stavke", "Količina", "Cena"],
                rows=items,
                confidence=0.85
            ))

        if total_amount:
            blocks.append(DocumentBlock(
                id=str(uuid.uuid4()),
                type=BlockType.FIELD,
                content=f"UKUPNO: {total_amount}",
                key="Ukupno",
                value=total_amount,
                confidence=0.95
            ))

        # Ako ništa od specifičnih polja nije nađeno, dodaj sirove linije
        if not blocks:
            for l in lines:
                blocks.append(DocumentBlock(
                    id=str(uuid.uuid4()),
                    type=BlockType.PARAGRAPH,
                    content=l.text,
                    confidence=l.confidence,
                    needs_review=l.confidence < CONFIDENCE_THRESHOLD
                ))

        return blocks

class FormParser(BaseStructureParser):
    def parse(self, ocr_result: OCRResult) -> List[DocumentBlock]:
        blocks: List[DocumentBlock] = []
        lines = ocr_result.lines

        is_title = True
        for line in lines:
            text = line.text.strip()
            if not text:
                continue

            conf = line.confidence
            needs_review = conf < CONFIDENCE_THRESHOLD
            reason = f"Proverite vrednost polja ({int(conf * 100)}%)" if needs_review else None

            # Traženje para Ključ: Vrednost ili Ključ - Vrednost
            field_match = re.match(r"^([A-ZŠĐČĆŽa-zšđčćž0-9\s\.\/]+)\s*[\:\–\-]\s*(.*)$", text)
            if field_match and not is_title:
                key = field_match.group(1).strip()
                val = field_match.group(2).strip()
                blocks.append(DocumentBlock(
                    id=str(uuid.uuid4()),
                    type=BlockType.FIELD,
                    content=f"{key}: {val}" if val else f"{key}:",
                    key=key,
                    value=val,
                    confidence=conf,
                    needs_review=needs_review or (not val), # Ako je prazno polje, korisnik treba da proveri
                    review_reason="Prazno ili nejasno polje" if not val else reason
                ))
            else:
                if is_title:
                    blocks.append(DocumentBlock(
                        id=str(uuid.uuid4()),
                        type=BlockType.TITLE,
                        content=text,
                        confidence=conf,
                        needs_review=needs_review,
                        review_reason=reason
                    ))
                    is_first = False
                else:
                    blocks.append(DocumentBlock(
                        id=str(uuid.uuid4()),
                        type=BlockType.PARAGRAPH,
                        content=text,
                        confidence=conf,
                        needs_review=needs_review,
                        review_reason=reason
                    ))
            is_title = False

        return blocks

class TableParser(BaseStructureParser):
    def parse(self, ocr_result: OCRResult) -> List[DocumentBlock]:
        blocks: List[DocumentBlock] = []
        lines = ocr_result.lines

        table_rows: List[List[str]] = []
        for line in lines:
            text = line.text.strip()
            if not text:
                continue

            # Razdvajanje po vertikalnoj liniji | ili većem razmaku (2+ razmaka / tab)
            if "|" in text:
                cells = [c.strip() for c in text.split("|") if c.strip()]
            elif "\t" in text:
                cells = [c.strip() for c in text.split("\t") if c.strip()]
            else:
                cells = [c.strip() for c in re.split(r"\s{2,}", text) if c.strip()]

            if len(cells) >= 2:
                table_rows.append(cells)
            else:
                # Linija pre ili posle tabele (naslov ili beleška)
                if not table_rows:
                    blocks.append(DocumentBlock(
                        id=str(uuid.uuid4()),
                        type=BlockType.TITLE,
                        content=text,
                        confidence=line.confidence
                    ))
                else:
                    blocks.append(DocumentBlock(
                        id=str(uuid.uuid4()),
                        type=BlockType.PARAGRAPH,
                        content=text,
                        confidence=line.confidence
                    ))

        if table_rows:
            headers = table_rows[0]
            rows = table_rows[1:] if len(table_rows) > 1 else []
            blocks.append(DocumentBlock(
                id=str(uuid.uuid4()),
                type=BlockType.TABLE,
                content="Tabela",
                headers=headers,
                rows=rows,
                confidence=ocr_result.mean_confidence,
                needs_review=ocr_result.mean_confidence < CONFIDENCE_THRESHOLD
            ))

        return blocks
