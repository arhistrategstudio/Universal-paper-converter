import { createWorker } from 'tesseract.js';
import { UniversalDocument, DocumentType, DocumentBlock } from '../types';

const CONFIDENCE_THRESHOLD = 0.60;

/**
 * Predobrada slike u browseru pomoću HTML5 Canvas-a:
 * - Povećanje kontrasta (kontrast i nivo osvetljenja)
 * - Skaliranje ako je rezolucija niska (za sitan tekst ili rukopis)
 * - Uklanjanje šuma (binarizacija / grayscale)
 */
async function preprocessImage(imageSource: File | Blob | string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource as Blob));
        return;
      }

      // Ako je slika manja od 1200px, skaliraj je na 1.5x radi boljeg OCR-a
      let scale = 1;
      if (img.width < 1400) {
        scale = Math.min(2.0, 1600 / img.width);
      }
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      // Adaptivno pojačanje kontrasta i sivilo (Grayscale + Contrast stretch)
      for (let i = 0; i < d.length; i += 4) {
        // Luma formula
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        
        // Pojačaj kontrast: tamniji tekst tamniji, papir svetliji
        let contrastVal = (gray - 128) * 1.35 + 128;
        if (contrastVal < 0) contrastVal = 0;
        if (contrastVal > 255) contrastVal = 255;

        d[i] = contrastVal;
        d[i + 1] = contrastVal;
        d[i + 2] = contrastVal;
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource as Blob));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Čišćenje OCR linija:
 * Filtrira linije koje su čisto OCR đubre (npr. nasumični simboli "^", ";", "XmgS", "@%#")
 */
function isNoise(text: string): boolean {
  const clean = text.trim();
  if (!clean || clean.length < 2) return true;
  
  // Samo interpukcija ili specijalni karakteri
  if (/^[;\:_\-\.\,\*\#\$\%\^\&\(\)\[\]\{\}\\\/\|\~`\'\"\s]+$/.test(clean)) return true;

  // Nasumični string bez ijednog samoglasnika a-e-i-o-u (često "XmgS", "Pqz", "kjb")
  const lettersOnly = clean.replace(/[^a-zA-Z\u0400-\u04FF\u0100-\u017F]/g, '');
  if (lettersOnly.length >= 3 && !/[aeiouyAEIOUYаеиоуАЕИОУ]/i.test(lettersOnly)) {
    return true;
  }

  return false;
}

export async function recognizeInBrowser(
  imageSource: File | Blob | string,
  docType: DocumentType = 'document',
  language: string = 'sr-Latn'
): Promise<UniversalDocument> {
  const startTime = Date.now();

  // 1. Predobrada slike
  const preprocessedUrl = await preprocessImage(imageSource);

  // 2. Mapiranje jezika: Za srpski rukopis ili dokument kombinujemo srp_latn i eng
  let tessLang = 'srp_latn+eng';
  const langLower = language.toLowerCase();
  if (langLower.includes('cyrl') || langLower.includes('cir')) {
    tessLang = 'srp';
  } else if (langLower === 'en') {
    tessLang = 'eng';
  }

  // 3. Inicijalizuj Tesseract.js radnik
  const worker = await createWorker(tessLang, 1, {
    logger: () => {},
  });

  const ret = await worker.recognize(preprocessedUrl);
  await worker.terminate();

  const data = ret.data as any;
  const rawText: string = data.text || '';
  
  // 4. Pametno spajanje rečenica i pasusa umesto seckanja u 50 pojedinačnih polja
  const blocks = buildCleanDocumentBlocks(data, rawText, docType);

  let title = 'Digitalizovani dokument';
  for (const b of blocks) {
    if (b.type === 'title' && b.content.trim()) {
      title = b.content.trim();
      break;
    }
  }

  const duration = Date.now() - startTime;
  const docId = 'doc-' + Math.random().toString(36).substring(2, 9);
  const meanConf = (data.confidence || 75) / 100;

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
      ocr_engine: 'tesseract.js (Enhanced Client OCR)',
      processing_time_ms: duration,
      overall_confidence: Number(meanConf.toFixed(2)),
    },
  };
}

/**
 * Spaja prepoznati tekst u prave koherentne pasuse i celine,
 * umesto da svaka pojedinačna linija bude zaseban boks
 */
function buildCleanDocumentBlocks(data: any, rawText: string, docType: DocumentType): DocumentBlock[] {
  const rawParagraphs: string[] = [];
  
  // Ako imamo paragraphs iz Tesseract-a
  if (data.paragraphs && data.paragraphs.length > 0) {
    for (const p of data.paragraphs) {
      const pText = (p.text || '').replace(/\r\n/g, ' ').replace(/\n/g, ' ').trim();
      if (pText && !isNoise(pText)) {
        rawParagraphs.push(pText);
      }
    }
  } else {
    // Fallback: razdvoji po duplom novom redu ili po logičnim linijama
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l && !isNoise(l));
    let currentParagraph = '';
    
    for (const line of lines) {
      if (!currentParagraph) {
        currentParagraph = line;
      } else if (currentParagraph.endsWith('.') || currentParagraph.endsWith(':') || line.startsWith('-') || line.startsWith('•') || /^\d+[\.\)]/.test(line)) {
        rawParagraphs.push(currentParagraph);
        currentParagraph = line;
      } else {
        // Nastavak rečenice iz prethodnog reda
        currentParagraph += ' ' + line;
      }
    }
    if (currentParagraph) {
      rawParagraphs.push(currentParagraph);
    }
  }

  const blocks: DocumentBlock[] = [];
  let isFirst = true;

  rawParagraphs.forEach((para, idx) => {
    const cleanPara = para.replace(/\s+/g, ' ').trim();
    if (!cleanPara || isNoise(cleanPara)) return;

    // 1. Proveri listu (npr. - ili • ili 1.)
    const listMatch = cleanPara.match(/^(\*|\-|\u2022|\d+[\.\)])\s*(.+)/);
    if (listMatch) {
      blocks.push({
        id: `block-${idx}`,
        type: 'list_item',
        content: listMatch[2].trim(),
        confidence: 0.85,
        needs_review: false,
      });
      isFirst = false;
      return;
    }

    // 2. Parovi Ključ: Vrednost (npr. "Uput br.: IPQZ479855" ili "Ime: Marko")
    const fieldMatch = cleanPara.match(/^([A-ZŠĐČĆŽa-zšđčćž0-9\s\.\/]{2,25})\s*[\:\–\-]\s*(.+)$/);
    if (fieldMatch && (docType === 'form' || docType === 'receipt' || fieldMatch[1].toLowerCase().includes('br') || fieldMatch[1].toLowerCase().includes('datum') || fieldMatch[1].toLowerCase().includes('uput'))) {
      const key = fieldMatch[1].trim();
      const val = fieldMatch[2].trim();
      blocks.push({
        id: `block-${idx}`,
        type: 'field',
        key,
        value: val,
        content: `${key}: ${val}`,
        confidence: 0.90,
        needs_review: false,
      });
      isFirst = false;
      return;
    }

    // 3. Naslov (prvi kratki red bez tačke na kraju)
    if (isFirst && cleanPara.length < 65 && !cleanPara.endsWith('.')) {
      blocks.push({
        id: `block-${idx}`,
        type: 'title',
        content: cleanPara,
        confidence: 0.90,
        needs_review: false,
      });
      isFirst = false;
      return;
    }

    // 4. Podnaslov (npr. "Zadaci", "Kontrola", "Sledeći sastanak")
    if (cleanPara.length < 35 && (!cleanPara.endsWith('.') || cleanPara.toUpperCase() === cleanPara || cleanPara.toLowerCase() === 'kontrola.')) {
      blocks.push({
        id: `block-${idx}`,
        type: 'heading',
        content: cleanPara,
        level: 2,
        confidence: 0.88,
        needs_review: false,
      });
      return;
    }

    // 5. Celoviti pasus teksta
    // Ako ima reči koje su nejasne, označi sa "Proveri" samo ako je zaista problematično
    const suspicious = /[\{\}\<\>\|\~\^\\]/.test(cleanPara);
    blocks.push({
      id: `block-${idx}`,
      type: 'paragraph',
      content: cleanPara,
      confidence: suspicious ? 0.55 : 0.85,
      needs_review: suspicious,
      review_reason: suspicious ? 'Proverite neuobičajene simbole' : undefined,
    });
    isFirst = false;
  });

  return blocks;
}
