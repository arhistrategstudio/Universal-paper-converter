import { UniversalDocument, DocumentType, DocumentBlock } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function uploadAndAnalyze(
  file: File | Blob,
  fileName: string = 'document.jpg',
  docType: DocumentType = 'document',
  language: string = 'sr-Latn'
): Promise<{ analysis_id: string; status: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('doc_type', docType);
  formData.append('language', language);

  const res = await fetch(`${API_BASE}/analysis`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Došlo je do greške prilikom analize slike.');
  }

  return res.json();
}

export async function getAnalysisResult(analysisId: string): Promise<UniversalDocument> {
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/result`);
  if (!res.ok) {
    throw new Error('Dokument nije pronađen.');
  }
  return res.json();
}

export async function updateAnalysisBlocks(
  analysisId: string,
  blocks: DocumentBlock[],
  title?: string
): Promise<UniversalDocument> {
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/blocks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks, title }),
  });
  if (!res.ok) {
    throw new Error('Greška pri ažuriranju dokumenta.');
  }
  return res.json();
}

export function getExportUrl(analysisId: string, format: 'txt' | 'csv' | 'docx' | 'pdf'): string {
  return `${API_BASE}/analysis/${analysisId}/export/${format}`;
}

export function getImagePreviewUrl(analysisId: string): string {
  return `${API_BASE}/analysis/${analysisId}/image`;
}
