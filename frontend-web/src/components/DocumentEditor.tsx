import React, { useState } from 'react';
import { UniversalDocument, DocumentBlock, BlockType } from '../types';
import { Language, translations } from '../i18n/translations';
import { 
  AlertCircle, Save, Download, FileText, 
  FileSpreadsheet, Check, Trash2, Share2 
} from 'lucide-react';
import { getExportUrl } from '../services/api';
import { shareNativeDocument } from '../services/native';
import { exportLocalDocument } from '../services/clientExporter';

interface DocumentEditorProps {
  currentLang: Language;
  document: UniversalDocument;
  onSave: (updatedBlocks: DocumentBlock[], title: string) => Promise<void>;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  currentLang,
  document,
  onSave
}) => {
  const t = translations[currentLang];
  const [blocks, setBlocks] = useState<DocumentBlock[]>(document.blocks);
  const [title, setTitle] = useState<string>(document.title);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const handleBlockChange = (id: string, newContent: string) => {
    setBlocks(prev =>
      prev.map(b => (b.id === id ? { ...b, content: newContent, needs_review: false } : b))
    );
  };

  const handleFieldChange = (id: string, key: string, value: string) => {
    setBlocks(prev =>
      prev.map(b => (b.id === id ? { ...b, key, value, content: `${key}: ${value}`, needs_review: false } : b))
    );
  };

  const handleTableCellChange = (blockId: string, rowIndex: number, colIndex: number, val: string) => {
    setBlocks(prev =>
      prev.map(b => {
        if (b.id !== blockId || !b.rows) return b;
        const newRows = b.rows.map((row, rIdx) => {
          if (rIdx !== rowIndex) return row;
          const newRow = [...row];
          newRow[colIndex] = val;
          return newRow;
        });
        return { ...b, rows: newRows, needs_review: false };
      })
    );
  };

  const handleAddBlock = (type: BlockType) => {
    const newBlock: DocumentBlock = {
      id: 'block-' + Date.now(),
      type,
      content: '',
      confidence: 1.0,
      needs_review: false
    };
    setBlocks(prev => [...prev, newBlock]);
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(blocks, title);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert('Greška pri čuvanju promena.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    const plainText = blocks.map(b => {
      if (b.type === 'field') return `${b.key}: ${b.value}`;
      if (b.type === 'list_item') return `• ${b.content}`;
      if (b.type === 'table' && b.rows) return b.rows.map(r => r.join(' | ')).join('\n');
      return b.content;
    }).join('\n\n');

    await shareNativeDocument(title, `${title}\n\n${plainText}`);
  };

  const handleExport = (format: 'txt' | 'csv' | 'pdf' | 'docx') => {
    setExportOpen(false);
    const backendUrl = getExportUrl(document.id, format);
    if (backendUrl && backendUrl !== '#') {
      window.open(backendUrl, '_blank');
    } else {
      // In-browser klijentski izvoz (radi uvek, uključujući GitHub Pages)
      exportLocalDocument({ ...document, title, blocks }, format);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
      {/* Zaglavlje Editora */}
      <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex-1 min-w-[200px]">
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
            {t.structuredResult}
          </span>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-base sm:text-lg font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-0.5"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Share */}
          <button
            onClick={handleShare}
            title="Podeli dokument"
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Podeli</span>
          </button>

          {/* Sačuvaj */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 hidden sm:inline">{t.savedSuccess}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{t.saveChanges}</span>
              </>
            )}
          </button>

          {/* Izvoz */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(o => !o)}
              className="px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
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

      {/* Telo sa blokovima */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 max-h-[calc(100vh-280px)]">
        {blocks.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            {t.emptyState}
          </div>
        ) : (
          blocks.map(block => (
            <div
              key={block.id}
              className={`group relative rounded-xl p-3 border transition-all ${
                block.needs_review
                  ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Zastavica "Proveri" */}
              {block.needs_review && (
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100/90 px-2.5 py-1 rounded-md w-fit">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t.needsReviewBadge}</span>
                  {block.review_reason && (
                    <span className="font-normal text-amber-700">({block.review_reason})</span>
                  )}
                </div>
              )}

              {/* Render po tipu */}
              {block.type === 'title' ? (
                <input
                  type="text"
                  value={block.content}
                  onChange={e => handleBlockChange(block.id, e.target.value)}
                  className="w-full text-base font-bold text-slate-900 border-b border-transparent focus:border-indigo-500 focus:outline-none pb-1"
                />
              ) : block.type === 'heading' ? (
                <input
                  type="text"
                  value={block.content}
                  onChange={e => handleBlockChange(block.id, e.target.value)}
                  className="w-full text-sm font-semibold text-slate-800 border-b border-transparent focus:border-indigo-500 focus:outline-none pb-1"
                />
              ) : block.type === 'list_item' ? (
                <div className="flex items-start gap-2">
                  <span className="text-indigo-600 font-bold mt-0.5">•</span>
                  <textarea
                    rows={1}
                    value={block.content}
                    onChange={e => handleBlockChange(block.id, e.target.value)}
                    className="w-full text-xs sm:text-sm text-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded p-1"
                  />
                </div>
              ) : block.type === 'field' ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder={t.fieldKey}
                    value={block.key || ''}
                    onChange={e => handleFieldChange(block.id, e.target.value, block.value || '')}
                    className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg w-full sm:w-1/3 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <input
                    type="text"
                    placeholder={t.fieldValue}
                    value={block.value || ''}
                    onChange={e => handleFieldChange(block.id, block.key || '', e.target.value)}
                    className="text-xs sm:text-sm text-slate-900 border border-slate-200 px-2.5 py-1.5 rounded-lg flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              ) : block.type === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    {block.headers && (
                      <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                        <tr>
                          {block.headers.map((h, i) => (
                            <th key={i} className="p-2 text-left font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {block.rows?.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-1.5">
                              <input
                                type="text"
                                value={cell}
                                onChange={e => handleTableCellChange(block.id, rIdx, cIdx, e.target.value)}
                                className="w-full px-1.5 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 rounded text-slate-800 focus:outline-none"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <textarea
                  rows={2}
                  value={block.content}
                  onChange={e => handleBlockChange(block.id, e.target.value)}
                  className="w-full text-xs sm:text-sm text-slate-800 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded p-1.5"
                />
              )}

              <button
                onClick={() => handleDeleteBlock(block.id)}
                title={t.deleteBlock}
                className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Donja kontrolna traka */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAddBlock('paragraph')}
            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors"
          >
            {t.addBlock}
          </button>
          <button
            onClick={() => handleAddBlock('list_item')}
            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors"
          >
            {t.addListItem}
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-3">
          <span>{t.confidence} {Math.round((document.metadata?.overall_confidence || 0.8) * 100)}%</span>
          <span>{t.processingTime} {document.metadata?.processing_time_ms || 0}ms</span>
          <span className="text-indigo-600 font-medium">({document.metadata?.ocr_engine || 'OCR'})</span>
        </div>
      </div>
    </div>
  );
};
