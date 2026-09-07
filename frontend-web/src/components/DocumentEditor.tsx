import React, { useState, useEffect } from 'react';
import { UniversalDocument } from '../types';
import { Language, translations } from '../i18n/translations';
import { 
  Save, Download, FileText, FileSpreadsheet, Check, Share2, 
  Copy, Type, Sparkles, RefreshCw
} from 'lucide-react';
import { getExportUrl } from '../services/api';
import { shareNativeDocument } from '../services/native';
import { exportLocalDocument } from '../services/clientExporter';
import { formatStructuredDocument } from '../services/documentFormatter';

interface DocumentEditorProps {
  currentLang: Language;
  document: UniversalDocument;
  onSave: (updatedBlocks: any[], title: string) => Promise<void>;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  currentLang,
  document,
  onSave
}) => {
  const t = translations[currentLang];

  // Inicijalizuj formatirani tekst iz blokova ili naslova
  const initialText = document.blocks.map(b => {
    if (b.type === 'title') return `# ${b.content}\n`;
    if (b.type === 'heading') return `## ${b.content}\n`;
    if (b.type === 'list_item') return `• ${b.content}`;
    if (b.type === 'field') return `${b.key || ''}: ${b.value || b.content}`;
    if (b.type === 'table' && b.rows) {
      const h = b.headers ? b.headers.join(' | ') + '\n' : '';
      return h + b.rows.map(r => r.join(' | ')).join('\n');
    }
    return b.content;
  }).join('\n\n');

  // Primeni automatsko formatiranje u jedinstven koherentan dokument
  const formattedInit = formatStructuredDocument(initialText || document.title, document.doc_type);

  const [title, setTitle] = useState<string>(document.title || formattedInit.title);
  const [content, setContent] = useState<string>(formattedInit.content || initialText);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Sinhronizuj ako stigne novi dokument
  useEffect(() => {
    const formatted = formatStructuredDocument(
      document.blocks.map(b => b.content || `${b.key}: ${b.value}`).join('\n\n') || document.title,
      document.doc_type
    );
    setTitle(document.title || formatted.title);
    setContent(formatted.content || '');
  }, [document.id]);

  const handleCopy = async () => {
    const fullDoc = `${title}\n\n${content}`;
    await navigator.clipboard.writeText(fullDoc);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Pretvori tekst nazad u blokove za kompatibilnost sa backend API-jem
      const updatedBlocks = [
        { id: 'b-main', type: 'paragraph' as const, content, confidence: 0.95, needs_review: false }
      ];
      await onSave(updatedBlocks, title);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert('Greška pri čuvanju.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    await shareNativeDocument(title, `${title}\n\n${content}`);
  };

  const handleExport = (format: 'txt' | 'csv' | 'pdf' | 'docx') => {
    setExportOpen(false);
    const docToExport: UniversalDocument = {
      ...document,
      title,
      blocks: [
        { id: 'b-main', type: 'paragraph', content, confidence: 0.95, needs_review: false }
      ]
    };

    const backendUrl = getExportUrl(document.id, format);
    if (backendUrl && backendUrl !== '#') {
      window.open(backendUrl, '_blank');
    } else {
      exportLocalDocument(docToExport, format);
    }
  };

  // Re-formatiraj tekst automatski
  const handleAutoFormat = () => {
    const formatted = formatStructuredDocument(content, document.doc_type);
    if (formatted.content) {
      setContent(formatted.content);
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
      {/* Zaglavlje Editora */}
      <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
              {t.digitalTitle}
            </span>
            <span className="bg-indigo-100/80 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Strukturisani tekst
            </span>
          </div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Naslov dokumenta..."
            className="w-full text-base sm:text-lg font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-0.5"
          />
        </div>

        {/* Akciona dugmad */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Dugme za pametno auto-formatiranje */}
          <button
            onClick={handleAutoFormat}
            title="Automatski očisti i organizuj pasuse"
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Organizuj</span>
          </button>

          {/* Kopiraj */}
          <button
            onClick={handleCopy}
            title="Kopiraj ceo tekst"
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            {copySuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 hidden sm:inline">Kopirano!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Kopiraj</span>
              </>
            )}
          </button>

          {/* Podeli */}
          <button
            onClick={handleShare}
            title="Podeli dokument"
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Podeli</span>
          </button>

          {/* Sačuvaj */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 hidden sm:inline">{t.savedSuccess}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">{t.saveChanges}</span>
              </>
            )}
          </button>

          {/* Izvoz Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(o => !o)}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.export}</span>
            </button>

            {exportOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-30">
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                >
                  <FileText className="w-4 h-4 text-rose-500" />
                  {t.exportPDF}
                </button>
                <button
                  onClick={() => handleExport('docx')}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  {t.exportDOCX}
                </button>
                <button
                  onClick={() => handleExport('txt')}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  {t.exportTXT}
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  {t.exportCSV}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Jedinstveno glavno polje za organizovani tekst dokumenta */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 bg-white min-h-[400px]">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Prepoznati tekst dokumenta..."
          className="w-full flex-1 min-h-[420px] p-4 text-sm sm:text-base text-slate-900 bg-slate-50/50 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none resize-y leading-relaxed font-sans transition-all"
        />
      </div>

      {/* Donja statusna traka */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-3">
          <span>{wordCount} reči</span>
          <span>•</span>
          <span>{content.length} karaktera</span>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-3">
          <span>{document.metadata?.ocr_engine || 'OCR'}</span>
          <span>•</span>
          <span>{document.metadata?.processing_time_ms || 0}ms</span>
        </div>
      </div>
    </div>
  );
};
