import { UniversalDocument, DocumentType } from '../types';

/**
 * Formatira sirovi OCR tekst u čist, profesionalno strukturisan dokument:
 * - Izdvaja naslov dokumenta
 * - Izdvaja zaglavlje/podatke (npr. Uput br, Datum, itd.)
 * - Spaja povezane rečenice u prirodne, čitke pasuse umesto odsečenih redova
 * - Čisti OCR mrlje, izolovane interpunkcije i besmislene karaktere
 * - Formatira liste (- stavka) i sekcije
 */
export function formatStructuredDocument(rawText: string, docType: DocumentType = 'document'): { title: string; content: string } {
  if (!rawText || !rawText.trim()) {
    return { title: 'Prazan dokument', content: '' };
  }

  // 1. Podeli po linijama i očisti praznine
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => isValidLine(l));

  if (lines.length === 0) {
    return { title: 'Digitalizovani dokument', content: rawText.trim() };
  }

  // 2. Prepoznavanje naslova (prva smislena linija)
  let title = 'Digitalizovani dokument';
  let startIndex = 0;

  if (lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length < 80) {
      title = firstLine;
      startIndex = 1;
    }
  }

  // 3. Spajanje rečenica u strukturisane pasuse i celine
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    // Detekcija novih sekcija (npr. Naslov podsekcije, Lista, Ključ: Vrednost)
    const isHeading = line.length < 40 && (line === line.toUpperCase() || line.endsWith(':') || /^(Zadaci|Kontrola|Dijagnoza|Terapija|Nalaz|Sledeći sastanak|Napomena)/i.test(line));
    const isListItem = /^(\*|\-|\u2022|\d+[\.\)])\s*/.test(line);
    const isKeyValue = /^([A-ZŠĐČĆŽa-zšđčćž0-9\s\.\/]{2,25})\s*[\:\–\-]\s*(.+)$/.test(line);

    if (isHeading || isListItem || isKeyValue) {
      // Sačuvaj prethodni pasus ako postoji
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }
      
      if (isHeading) {
        paragraphs.push(`\n## ${line}\n`);
      } else if (isListItem) {
        const itemText = line.replace(/^(\*|\-|\u2022|\d+[\.\)])\s*/, '').trim();
        paragraphs.push(`• ${itemText}`);
      } else {
        paragraphs.push(line);
      }
    } else {
      // Običan tekst rečenice
      if (currentParagraph.length === 0) {
        currentParagraph.push(line);
      } else {
        const lastPart = currentParagraph[currentParagraph.length - 1];
        // Ako se prethodni red završio tačkom ili dvotačkom, možda je nova rečenica ili pasus
        if (lastPart.endsWith('.') && line[0] === line[0].toUpperCase()) {
          // Nastavi u isti pasus prirodnim razmakom
          currentParagraph.push(line);
        } else {
          // Nastavak prekinute rečenice iz prethodnog reda
          currentParagraph.push(line);
        }
      }
    }
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }

  // Sastavi u jedinstveni organizovan tekst sa jasnim razmacima između pasusa
  const formattedContent = paragraphs
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    title,
    content: formattedContent,
  };
}

function isValidLine(line: string): boolean {
  const s = line.trim();
  if (s.length < 2) return false;
  // Samo interpukcija (npr ";", ".", "-")
  if (/^[;\:_\-\.\,\*\#\$\%\^\&\(\)\[\]\{\}\\\/\|\~`\'\"\s]+$/.test(s)) return false;
  // Nasumični OCR artefakt bez samoglasnika
  const letters = s.replace(/[^a-zA-Z\u0400-\u04FF\u0100-\u017F]/g, '');
  if (letters.length >= 3 && !/[aeiouyAEIOUYаеиоуАЕИОУ]/i.test(letters)) return false;
  return true;
}
