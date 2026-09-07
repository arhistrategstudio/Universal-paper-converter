import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.schemas import UniversalDocument, DocumentBlock, BlockType, DocumentMetadata

@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "ocr_available" in data

def test_document_exporter_txt():
    from app.exporters.document_exporter import DocumentExporter
    doc = UniversalDocument(
        id="test-1",
        title="Sastanak 7.9.2026.",
        doc_type="handwriting",
        language="sr-Latn",
        status="completed",
        blocks=[
            DocumentBlock(id="b1", type=BlockType.TITLE, content="Sastanak 7.9.2026."),
            DocumentBlock(id="b2", type=BlockType.LIST_ITEM, content="Marko - poslati ponudu"),
            DocumentBlock(id="b3", type=BlockType.LIST_ITEM, content="Ana - pozvati klijenta")
        ],
        metadata=DocumentMetadata(
            created_at="2026-09-07T00:00:00",
            original_filename="note.jpg",
            ocr_engine="tesseract",
            processing_time_ms=120.0,
            overall_confidence=0.95
        )
    )
    txt = DocumentExporter.to_txt(doc)
    assert "Sastanak 7.9.2026." in txt
    assert "Marko - poslati ponudu" in txt
    assert "Ana - pozvati klijenta" in txt

def test_document_exporter_docx():
    from app.exporters.document_exporter import DocumentExporter
    doc = UniversalDocument(
        id="test-2",
        title="Dokument Ugovor",
        blocks=[
            DocumentBlock(id="b1", type=BlockType.TITLE, content="UGOVOR O RADU"),
            DocumentBlock(id="b2", type=BlockType.PARAGRAPH, content="Član 1. Zaposleni stupa na rad dana 1.10.2026.")
        ],
        metadata=DocumentMetadata(created_at="2026-09-07", original_filename="test.png")
    )
    docx_bytes = DocumentExporter.to_docx(doc)
    assert len(docx_bytes) > 1000

def test_document_exporter_pdf():
    from app.exporters.document_exporter import DocumentExporter
    doc = UniversalDocument(
        id="test-3",
        title="Fiskalni Račun",
        blocks=[
            DocumentBlock(id="b1", type=BlockType.TITLE, content="PRODAVNICA D.O.O."),
            DocumentBlock(id="b2", type=BlockType.FIELD, key="Broj računa", value="1234/2026"),
            DocumentBlock(id="b3", type=BlockType.TABLE, headers=["Artikal", "Količina", "Cena"], rows=[["Kafa", "1", "250.00"]])
        ],
        metadata=DocumentMetadata(created_at="2026-09-07", original_filename="racun.png")
    )
    pdf_bytes = DocumentExporter.to_pdf(doc)
    assert len(pdf_bytes) > 500
