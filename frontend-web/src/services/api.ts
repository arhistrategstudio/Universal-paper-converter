import { UniversalDocument, DocumentType, DocumentBlock } from '../types';
import { recognizeInBrowser } from './browserOcr';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function checkHealth() {
  if (!API_BASE) return { status: 'browser-mode', ocr_engine: 'tesseract.js' };
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.json();
  } catch {
    return { status: 'browser-mode', ocr_engine: 'tesseract.js' };
  }
}

export async function uploadAndAnalyze(
  file: File | Blob,
  fileName: string = 'document.jpg',
  docType: DocumentType = 'document',
  language: string = 'sr-Latn'
): Promise<UniversalDocument> {
  // Ako je definisan udaljeni backend URL, pokušaj backend
  if (API_BASE && API_BASE.startsWith('http')) {
    try {
      const formData = new FormData();
      formData.append('file', file, fileName);
      formData.append('doc_type', docType);
      formData.append('language', language);

      const res = await fetch(`${API_BASE}/analysis`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const createData = await res.json();
        return await getAnalysisResult(createData.analysis_id);
      }
    } catch (e) {
      console.warn('Backend server nije dostupan, automatski prelazak na klijentski In-Browser OCR...', e);
    }
  }

  // JAVNI WEB / GITHUB PAGES / STANDALONE REŽIM:
  // Koristi direktni klijentski OCR u browseru (100% nezavisan od localhost-a)
  return await recognizeInBrowser(file, docType, language);
}

export async function getAnalysisResult(analysisId: string): Promise<UniversalDocument> {
  if (!API_BASE) throw new Error('Offline doc');
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/result`);
  if (!res.ok) throw new Error('Dokument nije pronađen.');
  return res.json();
}

export async function updateAnalysisBlocks(
  analysisId: string,
  blocks: DocumentBlock[],
  title?: string
): Promise<UniversalDocument> {
  if (API_BASE && API_BASE.startsWith('http')) {
    try {
      const res = await fetch(`${API_BASE}/analysis/${analysisId}/blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks, title }),
      });
      if (res.ok) return res.json();
    } catch {
      // ignore
    }
  }
  return {
    id: analysisId,
    title: title || '',
    doc_type: 'document',
    language: 'sr-Latn',
    status: 'completed',
    blocks,
    metadata: {
      created_at: new Date().toISOString(),
      original_filename: 'document.jpg',
      ocr_engine: 'tesseract.js',
      processing_time_ms: 0,
      overall_confidence: 1.0,
    }
  };
}

export function getExportUrl(analysisId: string, format: 'txt' | 'csv' | 'docx' | 'pdf'): string {
  if (API_BASE && API_BASE.startsWith('http')) {
    return `${API_BASE}/analysis/${analysisId}/export/${format}`;
  }
  return '#';
}
