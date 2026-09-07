import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_full_analysis_workflow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with open("test_sample_paper.jpg", "rb") as f:
            file_bytes = f.read()

        # 1. Pozovi /api/v1/analysis
        resp = await ac.post(
            "/api/v1/analysis",
            files={"file": ("test_sample_paper.jpg", file_bytes, "image/jpeg")},
            data={"doc_type": "handwriting", "language": "sr-Latn"}
        )
        assert resp.status_code == 200
        analysis_data = resp.json()
        analysis_id = analysis_data["analysis_id"]
        assert analysis_data["status"] == "completed"

        # 2. Proveri status
        status_resp = await ac.get(f"/api/v1/analysis/{analysis_id}/status")
        assert status_resp.status_code == 200
        assert status_resp.json()["status"] == "completed"

        # 3. Proveri rezultat
        result_resp = await ac.get(f"/api/v1/analysis/{analysis_id}/result")
        assert result_resp.status_code == 200
        result = result_resp.json()
        assert len(result["blocks"]) > 0
        assert "Sastanak" in result["title"] or any("Sastanak" in b["content"] for b in result["blocks"])

        # 4. Proveri /api/v1/analysis/{id}/data
        data_resp = await ac.get(f"/api/v1/analysis/{analysis_id}/data")
        assert data_resp.status_code == 200
        assert "items" in data_resp.json()

        # 5. Proveri /api/v1/analysis/{id}/columns
        col_resp = await ac.get(f"/api/v1/analysis/{analysis_id}/columns")
        assert col_resp.status_code == 200

        # 6. Proveri izvoz u PDF, DOCX, TXT, CSV
        for fmt in ["pdf", "docx", "txt", "csv"]:
            exp_resp = await ac.get(f"/api/v1/analysis/{analysis_id}/export/{fmt}")
            assert exp_resp.status_code == 200
            assert len(exp_resp.content) > 0
