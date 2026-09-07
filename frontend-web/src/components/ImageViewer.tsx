import React, { useState } from 'react';
import { RotateCw, ZoomIn, ZoomOut, Check, Sliders } from 'lucide-react';
import { Language, translations } from '../i18n/translations';

interface ImageViewerProps {
  currentLang: Language;
  imageUrl: string;
  onProcess?: () => void;
  isProcessing?: boolean;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  currentLang,
  imageUrl,
  onProcess,
  isProcessing = false
}) => {
  const t = translations[currentLang];
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [contrastEnhanced, setContrastEnhanced] = useState(false);

  const rotate = () => setRotation(r => (r + 90) % 360);
  const zoomIn = () => setZoom(z => Math.min(z + 0.2, 2.5));
  const zoomOut = () => setZoom(z => Math.max(z - 0.2, 0.6));

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-md">
      {/* Toolbar */}
      <div className="bg-slate-800/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          {t.originalPhoto}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={rotate}
            title="Rotiraj"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            title="Smanji"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={zoomIn}
            title="Uvećaj"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setContrastEnhanced(c => !c)}
            title="Filter kontrasta"
            className={`p-1.5 rounded-lg transition-colors ${
              contrastEnhanced ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 min-h-[300px] lg:min-h-[500px]">
        <img
          src={imageUrl}
          alt="Original"
          style={{
            transform: `rotate(${rotation}deg) scale(${zoom})`,
            filter: contrastEnhanced ? 'contrast(1.4) brightness(1.05)' : 'none',
            transition: 'transform 0.2s ease-out, filter 0.2s ease',
          }}
          className="max-w-full max-h-full object-contain rounded-lg shadow-lg select-none"
        />
      </div>

      {/* Akciono dugme za obradu ako je pre-processing faza */}
      {onProcess && (
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex justify-end">
          <button
            onClick={onProcess}
            disabled={isProcessing}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.processing}
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                {t.processButton}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
