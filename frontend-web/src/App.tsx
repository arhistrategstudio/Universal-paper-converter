import React, { useState } from 'react';
import { Header } from './components/Header';
import { DocumentScanner } from './components/DocumentScanner';
import { ImageViewer } from './components/ImageViewer';
import { DocumentEditor } from './components/DocumentEditor';
import { Language, translations } from './i18n/translations';
import { DocumentType, UniversalDocument, DocumentBlock } from './types';
import { uploadAndAnalyze, getAnalysisResult, updateAnalysisBlocks } from './services/api';
import { ArrowLeft, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('sr');
  const t = translations[lang];

  // Stanja toka aplikacije: 'home' -> 'preview' -> 'result'
  const [currentStep, setCurrentStep] = useState<'home' | 'preview' | 'result'>('home');
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('document');
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentResult, setDocumentResult] = useState<UniversalDocument | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImageSelected = (file: File | Blob, url: string, docType: DocumentType) => {
    setSelectedFile(file);
    setPreviewUrl(url);
    setSelectedDocType(docType);
    setErrorMessage(null);
    setCurrentStep('preview');
  };

  const handleProcessDocument = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const resp = await uploadAndAnalyze(
        selectedFile,
        'document.jpg',
        selectedDocType,
        lang === 'sr' ? 'sr-Latn' : 'en'
      );

      const result = await getAnalysisResult(resp.analysis_id);
      setDocumentResult(result);
      setCurrentStep('result');
    } catch (err: any) {
      setErrorMessage(err.message || 'Došlo je do greške prilikom obrade dokumenta.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveBlocks = async (updatedBlocks: DocumentBlock[], newTitle: string) => {
    if (!documentResult) return;
    const updated = await updateAnalysisBlocks(documentResult.id, updatedBlocks, newTitle);
    setDocumentResult(updated);
  };

  const handleReset = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setDocumentResult(null);
    setErrorMessage(null);
    setCurrentStep('home');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header currentLang={lang} onLanguageChange={setLang} onReset={handleReset} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between shadow-sm">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="font-bold text-rose-900">×</button>
          </div>
        )}

        {/* 1. EKRAN: HOME / SKENIRANJE */}
        {currentStep === 'home' && (
          <div className="py-6">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                {t.appTitle}
              </h2>
              <p className="text-base sm:text-lg text-slate-600">
                {t.appSubtitle}
              </p>
            </div>

            <DocumentScanner
              currentLang={lang}
              onImageSelected={handleImageSelected}
              isProcessing={isProcessing}
            />
          </div>
        )}

        {/* 2. EKRAN: PREVIEW & ENHANCE PRE OBRADE */}
        {currentStep === 'preview' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                {t.backToHome}
              </button>
              <span className="text-xs font-medium text-slate-500">
                Tip: <strong className="text-slate-800 uppercase">{t.docTypes[selectedDocType]}</strong>
              </span>
            </div>

            <div className="h-[550px]">
              <ImageViewer
                currentLang={lang}
                imageUrl={previewUrl}
                onProcess={handleProcessDocument}
                isProcessing={isProcessing}
              />
            </div>
          </div>
        )}

        {/* 3. EKRAN: REZULTAT (ORIGINAL vs DIGITALNI DOKUMENT) */}
        {currentStep === 'result' && documentResult && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                {t.backToHome}
              </button>

              <div className="text-xs text-slate-500 font-medium">
                Sesija: <span className="font-mono text-slate-700">{documentResult.id.slice(0, 8)}</span>
              </div>
            </div>

            {/* Dvo-kolonski responsive prikaz: Desktop: Original | Digitalni dokument; Mobile: vertikalno */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Leva kolona: Original slika */}
              <div className="lg:col-span-5 h-[450px] lg:h-[calc(100vh-210px)] lg:sticky lg:top-24">
                <ImageViewer
                  currentLang={lang}
                  imageUrl={previewUrl}
                />
              </div>

              {/* Desna kolona: Digitalni dokument editor */}
              <div className="lg:col-span-7 h-auto lg:h-[calc(100vh-210px)]">
                <DocumentEditor
                  currentLang={lang}
                  document={documentResult}
                  onSave={handleSaveBlocks}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
