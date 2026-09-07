import uuid
import time
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from typing import Optional, List, Dict, Any

from app.models.schemas import (
    UniversalDocument, DocumentBlock, DocumentMetadata, DocumentType,
    DocumentStatus, AnalysisStatusResponse, AnalysisCreateResponse, UpdateBlockRequest, BlockType
)
from app.ocr.tesseract_engine import TesseractEngine
from app.parsers.structure_parsers import (
    GeneralDocumentParser, HandwritingParser, ReceiptParser, FormParser, TableParser
)
from app.exporters.document_exporter import DocumentExporter
from app.core.storage import DocumentStore

router = APIRouter(prefix="/v1", tags=["analysis"])
ocr_engine = TesseractEngine()

@router.get("/health")
async def health_check():
    DocumentStore.cleanup_old()
    return {
        "status": "ok",
        "ocr_available": ocr_engine.is_available(),
        "ocr_engine": "tesseract",
        "version": "1.0.0"
    }

@router.post("/analysis", response_model=AnalysisCreateResponse)
async def create_analysis(
    file: UploadFile = File(...),
    doc_type: Optional[DocumentType] = Form(DocumentType.DOCUMENT),
    language: Optional[str] = Form("sr-Latn")
):
    # Provera ekstenzije
    filename = file.filename or "upload.jpg"
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Fajl je prazan.")

    analysis_id = str(uuid.uuid4())
    start_time = time.time()

    # Inicijalni pending status
    meta = DocumentMetadata(
        created_at=datetime.utcnow().isoformat(),
        original_filename=filename,
        ocr_engine="tesseract",
        processing_time_ms=0.0,
        overall_confidence=1.0
    )
    doc = UniversalDocument(
        id=analysis_id,
        title="",
        doc_type=doc_type or DocumentType.DOCUMENT,
        language=language or "sr-Latn",
        status=DocumentStatus.PROCESSING,
        blocks=[],
        metadata=meta
    )
    DocumentStore.save(doc, contents)

    # Izvrši OCR
    try:
        ocr_result = ocr_engine.recognize(contents, language=language or "sr-Latn")
        
        # Izaberi odgovarajući parser
        if doc_type == DocumentType.HANDWRITING:
            parser = HandwritingParser()
        elif doc_type == DocumentType.RECEIPT:
            parser = ReceiptParser()
        elif doc_type == DocumentType.FORM:
            parser = FormParser()
        elif doc_type == DocumentType.TABLE:
            parser = TableParser()
        else:
            parser = GeneralDocumentParser()

        blocks = parser.parse(ocr_result)
        
        # Izvuci naslov iz prvog TITLE bloka ako postoji
        title = ""
        for b in blocks:
            if b.type == BlockType.TITLE:
                title = b.content
                break
        if not title and blocks:
            title = blocks[0].content[:50]

        duration = (time.time() - start_time) * 1000
        doc.title = title or "Digitalizovani dokument"
        doc.blocks = blocks
        doc.status = DocumentStatus.COMPLETED
        doc.metadata.processing_time_ms = round(duration, 2)
        doc.metadata.overall_confidence = round(ocr_result.mean_confidence, 3)

        DocumentStore.update(doc)

        return AnalysisCreateResponse(
            analysis_id=analysis_id,
            status=DocumentStatus.COMPLETED,
            message="Analiza uspešno završena."
        )
    except Exception as e:
        doc.status = DocumentStatus.FAILED
        DocumentStore.update(doc)
        raise HTTPException(status_code=500, detail=f"Greška pri OCR obradi: {str(e)}")

@router.get("/analysis/{analysis_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(analysis_id: str):
    doc = DocumentStore.get(analysis_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Analiza nije pronađena.")
    return AnalysisStatusResponse(
        id=doc.id,
        status=doc.status,
        progress=100 if doc.status == DocumentStatus.COMPLETED else 50,
        message="Obrada završena" if doc.status == DocumentStatus.COMPLETED else "U toku..."
    )

@router.get("/analysis/{analysis_id}/result", response_model=UniversalDocument)
async def get_analysis_result(analysis_id: str):
    doc = DocumentStore.get(analysis_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nije pronađen.")
    return doc

@router.get("/analysis/{analysis_id}/data")
async def get_analysis_data(analysis_id: str):
    """Vraća pojednostavljene podatke po blokovima za lake preglede."""
    doc = DocumentStore.get(analysis_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nije pronađen.")
    return {
        "id": doc.id,
        "title": doc.title,
        "doc_type": doc.doc_type,
        "items": [
            {
                "id": b.id,
                "type": b.type,
                "content": b.content,
                "key": b.key,
                "value": b.value,
                "needs_review": b.needs_review
            } for b in doc.blocks
        ]
    }

@router.get("/analysis/{analysis_id}/columns")
async def get_analysis_columns(analysis_id: str):
    """Vraća kolone iz tabele ako dokument sadrži tabelarnu strukturu."""
    doc = DocumentStore.get(analysis_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nije pronađen.")
    
    for b in doc.blocks:
        if b.type == BlockType.TABLE:
            return {
                "id": doc.id,
                "headers": b.headers or [],
                "row_count": len(b.rows or []),
                "rows": b.rows or []
            }
    return {"id": doc.id, "headers": [], "row_count": 0, "rows": []}

@router.get("/analysis/{analysis_id}/image")
async def get_analysis_image(analysis_id: str):
    img_bytes = DocumentStore.get_image(analysis_id)
    if not img_bytes:
        raise HTTPException(status_code=404, detail="Slika nije pronađena.")
    return Response(content=img_bytes, media_type="image/jpeg")

@router.put("/analysis/{analysis_id}/blocks", response_model=UniversalDocument)
async def update_blocks(analysis_id: str, request: UpdateBlockRequest):
    doc = DocumentStore.get(analysis_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nije pronađen.")
    
    doc.blocks = request.blocks
    if request.title is not None:
        doc.title = request.title
    DocumentStore.update(doc)
    return doc

@router.get("/analysis/{analysis_id}/export/{format}")
async def export_document(analysis_id: str, format: str):
    doc = DocumentStore.get(analysis_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nije pronađen.")

    fmt = format.lower()
    safe_title = "".join(c for c in (doc.title or "dokument") if c.isalnum() or c in (' ', '_', '-')).strip()
    safe_title = safe_title.replace(' ', '_') or "dokument"

    if fmt == "txt":
        txt_content = DocumentExporter.to_txt(doc)
        return Response(
            content=txt_content.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.txt"'}
        )
    elif fmt == "csv":
        csv_content = DocumentExporter.to_csv(doc)
        return Response(
            content=csv_content.encode("utf-8-sig"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.csv"'}
        )
    elif fmt == "docx":
        docx_bytes = DocumentExporter.to_docx(doc)
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.docx"'}
        )
    elif fmt == "pdf":
        pdf_bytes = DocumentExporter.to_pdf(doc)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'}
        )
    else:
        raise HTTPException(status_code=400, detail=f"Nepodržan format izvoza: {format}. Podržani: txt, csv, docx, pdf.")
