import { createWorker } from 'tesseract.js';
import { UniversalDocument, DocumentType, DocumentBlock } from '../types';

const CONFIDENCE_THRESHOLD = 0.65;

export async function recognizeInBrowser(
  imageSource: File | Blob | string,
  docType: DocumentType = 'document',
  language: string = 'sr-Latn'
): Promise<UniversalDocument> {
  const startTime = Date.now();

  let tessLang = 'srp_latn';
  const langLower = language.toLowerCase();
  if (langLower.includes('cyrl') || langLower.includes('cir')) {
    tessLang = 'srp';
  } else if (langLower.includes('en')) {
    tessLang = 'eng';
  }

  // Inicijalizuj Tesseract.js worker
  const worker = await createWorker(tessLang, 1, {
    logger: () => {},
  });

  const ret = await worker.recognize(imageSource);
  await worker.terminate();

  const data = ret.data as any;
  const rawText: string = data.text || '';
  const lines: any[] = data.lines || (rawText.split('\n').filter(Boolean).map((t: string) => ({ text: t, confidence: data.confidence || 80 })));
  const meanConfidence = (data.confidence || 75) / 100;

  const blocks = parseBlocks(lines, rawText, docType, meanConfidence);

  let title = 'Digitalizovani dokument';
  for (const b of blocks) {
    if (b.type === 'title' && b.content.trim()) {
      title = b.content.trim();
      break;
    }
  }
  if (title === 'Digitalizovani dokument' && blocks.length > 0 && blocks[0].content) {
    title = blocks[0].content.slice(0, 50);
  }

  const duration = Date.now() - startTime;
  const docId = 'doc-' + Math.random().toString(36).substring(2, 9);

  return {
    id: docId,
    title,
    doc_type: docType,
    language,
    status: 'completed',
    blocks,
    metadata: {
      created_at: new Date().toISOString(),
      original_filename: typeof imageSource === 'object' && 'name' in imageSource ? (imageSource as any).name : 'scan.jpg',
      ocr_engine: 'tesseract.js (In-Browser OCR)',
      processing_time_ms: duration,
      overall_confidence: Number(meanConfidence.toFixed(2)),
    },
  };
}

function parseBlocks(
  lines: any[],
  rawText: string,
  docType: DocumentType,
  meanConfidence: number
): DocumentBlock[] {
  if (!lines || lines.length === 0) {
    const rawLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    return rawLines.map((text, idx) => ({
      id: `b-${idx}`,
      type: idx === 0 ? 'title' : 'paragraph',
      content: text,
      confidence: meanConfidence,
      needs_review: meanConfidence < CONFIDENCE_THRESHOLD,
    }));
  }

  if (docType === 'handwriting') {
    return parseHandwriting(lines, meanConfidence);
  } else if (docType === 'receipt') {
    return parseReceipt(lines, meanConfidence);
  } else if (docType === 'form') {
    return parseForm(lines, meanConfidence);
  } else if (docType === 'table') {
    return parseTable(lines, meanConfidence);
  } else {
    return parseGeneral(lines, meanConfidence);
  }
}

function parseGeneral(lines: any[], meanConf: number): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let isFirst = true;

  lines.forEach((line, idx) => {
    const text = (line.text || '').trim();
    if (!text) return;

    const conf = (line.confidence != null ? line.confidence / 100 : meanConf);
    const needsReview = conf < CONFIDENCE_THRESHOLD;

    const listMatch = text.match(/^(\*|\-|\u2022|\d+[\.\)])\s*(.+)/);
    if (listMatch) {
      blocks.push({
        id: `block-${idx}`,
        type: 'list_item',
        content: listMatch[2].trim(),
        confidence: Number(conf.toFixed(2)),
        needs_review: needsReview,
      });
      isFirst = false;
      return;
    }

    if (isFirst && text.length < 70 && !text.endsWith('.')) {
      blocks.push({
        id: `block-${idx}`,
        type: 'title',
        content: text,
        confidence: Number(conf.toFixed(2)),
        needs_review: needsReview,
      });
      isFirst = false;
      return;
    }

    if (text.length < 45 && !text.endsWith('.') && (text === text.toUpperCase() || blocks.length > 0)) {
      blocks.push({
        id: `block-${idx}`,
        type: 'heading',
        content: text,
        level: 2,
        confidence: Number(conf.toFixed(2)),
        needs_review: needsReview,
      });
      return;
    }

    blocks.push({
      id: `block-${idx}`,
      type: 'paragraph',
      content: text,
      confidence: Number(conf.toFixed(2)),
      needs_review: needsReview,
    });
    isFirst = false;
  });

  return blocks;
}

function parseHandwriting(lines: any[], meanConf: number): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  lines.forEach((line, idx) => {
    const text = (line.text || '').trim();
    if (!text) return;

    const conf = (line.confidence != null ? line.confidence / 100 : meanConf);
    const needsReview = conf < 0.70;

    if (idx === 0 || text.toLowerCase().includes('sastanak')) {
      blocks.push({
        id: `block-${idx}`,
        type: idx === 0 ? 'title' : 'heading',
        content: text,
        confidence: Number(conf.toFixed(2)),
        needs_review: needsReview,
      });
      return;
    }

    const taskMatch = text.match(/^([A-ZŠĐČĆŽa-zšđčćž\s]+)\s*[\-\–\:]\s*(.+)/);
    const listMatch = text.match(/^(\*|\-|\u2022|\d+[\.\)])\s*(.+)/);

    if (listMatch) {
      blocks.push({
        id: `block-${idx}`,
        type: 'list_item',
        content: listMatch[2].trim(),
        confidence: Number(conf.toFixed(2)),
        needs_review: needsReview,
      });
    } else if (taskMatch && taskMatch[1].split(' ').length <= 2) {
      blocks.push({
        id: `block-${idx}`,
        type: 'list_item',
        content: `${taskMatch[1].trim()} — ${taskMatch[2].trim()}`,
        confidence: Number(conf.toFixed(2)),
        needs_review: needsReview,
      });
    } else {
      blocks.push({
        id: `block-${idx}`,
        type: 'paragraph',
        content: text,
        confidence: Number(conf.toFixed(2)),
        needs_review: needsReview,
      });
    }
  });
  return blocks;
}

function parseReceipt(lines: any[], meanConf: number): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let merchant = '';
  let receiptNo = '';
  let date = '';
  let total = '';
  const items: string[][] = [];

  lines.forEach((line, idx) => {
    const text = (line.text || '').trim();
    if (!text) return;

    if (idx === 0 && !merchant) {
      merchant = text;
      return;
    }

    const rnMatch = text.match(/(?:račun|racun|broj|rn|inv|receipt)[\s\:\#\-№]+([A-Za-z0-9\/\-]+)/i);
    if (rnMatch && !receiptNo) {
      receiptNo = rnMatch[1].trim();
      return;
    }

    const dMatch = text.match(/(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/);
    if (dMatch && !date) {
      date = dMatch[1].trim();
    }

    const totalMatch = text.match(/(?:ukupno|total|iznos|za uplatu)[\s\:\-]+([0-9\.\,]+)/i);
    if (totalMatch && !total) {
      total = totalMatch[1].trim();
      return;
    }

    const priceMatch = text.match(/^(.+?)\s+([0-9]+[0-9\.\,]*)$/);
    if (priceMatch && !/ukupno|total|porez|pdv|datum/i.test(text)) {
      items.push([priceMatch[1].trim(), '1', priceMatch[2].trim()]);
    }
  });

  if (merchant) blocks.push({ id: 'b-merch', type: 'title', content: merchant, confidence: 0.9, needs_review: false });
  if (receiptNo) blocks.push({ id: 'b-rn', type: 'field', key: 'Broj računa', value: receiptNo, content: `Broj računa: ${receiptNo}`, confidence: 0.9, needs_review: false });
  if (date) blocks.push({ id: 'b-date', type: 'field', key: 'Datum', value: date, content: `Datum: ${date}`, confidence: 0.9, needs_review: false });
  if (items.length > 0) blocks.push({ id: 'b-table', type: 'table', content: 'Stavke računa', headers: ['Naziv stavke', 'Količina', 'Cena'], rows: items, confidence: 0.85, needs_review: false });
  if (total) blocks.push({ id: 'b-total', type: 'field', key: 'Ukupno', value: total, content: `UKUPNO: ${total}`, confidence: 0.95, needs_review: false });

  return blocks.length > 0 ? blocks : parseGeneral(lines, meanConf);
}

function parseForm(lines: any[], meanConf: number): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let isTitle = true;

  lines.forEach((line, idx) => {
    const text = (line.text || '').trim();
    if (!text) return;

    const conf = (line.confidence != null ? line.confidence / 100 : meanConf);
    const fieldMatch = text.match(/^([A-ZŠĐČĆŽa-zšđčćž0-9\s\.\/]+)\s*[\:\–\-]\s*(.*)$/);

    if (fieldMatch && !isTitle) {
      const key = fieldMatch[1].trim();
      const val = fieldMatch[2].trim();
      blocks.push({
        id: `block-${idx}`,
        type: 'field',
        key,
        value: val,
        content: val ? `${key}: ${val}` : `${key}:`,
        confidence: Number(conf.toFixed(2)),
        needs_review: conf < CONFIDENCE_THRESHOLD || !val,
      });
    } else {
      blocks.push({
        id: `block-${idx}`,
        type: isTitle ? 'title' : 'paragraph',
        content: text,
        confidence: Number(conf.toFixed(2)),
        needs_review: conf < CONFIDENCE_THRESHOLD,
      });
    }
    isTitle = false;
  });
  return blocks;
}

function parseTable(lines: any[], meanConf: number): DocumentBlock[] {
  const tableRows: string[][] = [];
  const blocks: DocumentBlock[] = [];

  lines.forEach((line) => {
    const text = (line.text || '').trim();
    if (!text) return;

    let cells: string[] = [];
    if (text.includes('|')) {
      cells = text.split('|').map(c => c.trim()).filter(Boolean);
    } else if (text.includes('\t')) {
      cells = text.split('\t').map(c => c.trim()).filter(Boolean);
    } else {
      cells = text.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
    }

    if (cells.length >= 2) {
      tableRows.push(cells);
    } else {
      if (tableRows.length === 0) {
        blocks.push({ id: 'b-head', type: 'title', content: text, confidence: meanConf, needs_review: false });
      } else {
        blocks.push({ id: 'b-note-' + Math.random(), type: 'paragraph', content: text, confidence: meanConf, needs_review: false });
      }
    }
  });

  if (tableRows.length > 0) {
    blocks.push({
      id: 'b-table-main',
      type: 'table',
      content: 'Tabela',
      headers: tableRows[0],
      rows: tableRows.slice(1),
      confidence: meanConf,
      needs_review: meanConf < CONFIDENCE_THRESHOLD,
    });
  }

  return blocks.length > 0 ? blocks : parseGeneral(lines, meanConf);
}
