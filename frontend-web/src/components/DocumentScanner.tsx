import React, { useRef, useState } from 'react';
import { Camera as CameraIcon, Upload, Image as ImageIcon, Sparkles, X, FolderOpen } from 'lucide-react';
import { DocumentType } from '../types';
import { Language, translations } from '../i18n/translations';
import { isNativePlatform, takeNativePhoto, pickGalleryPhoto } from '../services/native';

interface ScannerProps {
  currentLang: Language;
  onImageSelected: (file: File | Blob, previewUrl: string, docType: DocumentType) => void;
  isProcessing: boolean;
}

export const DocumentScanner: React.FC<ScannerProps> = ({
  currentLang,
  onImageSelected,
  isProcessing
}) => {
  const t = translations[currentLang];
  const [selectedType, setSelectedType] = useState<DocumentType>('document');
  const [dragActive, setDragActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const isNative = isNativePlatform();

  const handleCameraClick = async () => {
    if (isNative) {
      try {
        const { blob, previewUrl } = await takeNativePhoto();
        onImageSelected(blob, previewUrl, selectedType);
      } catch (err) {
        console.error('Kamera otkazana ili greška:', err);
      }
    } else {
      startWebCamera();
    }
  };

  const handleGalleryClick = async () => {
    if (isNative) {
      try {
        const { blob, previewUrl } = await pickGalleryPhoto();
        onImageSelected(blob, previewUrl, selectedType);
      } catch (err) {
        console.error('Galerija otkazana ili greška:', err);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const startWebCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      alert('Nije moguće pristupiti kameri. Molimo proverite dozvole u vašem browseru.');
    }
  };

  const stopWebCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const captureWebPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob(blob => {
        if (blob) {
          const preview = URL.createObjectURL(blob);
          stopWebCamera();
          onImageSelected(blob, preview, selectedType);
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      const preview = URL.createObjectURL(file);
      onImageSelected(file, preview, selectedType);
    }
  };

  const docTypesList: { id: DocumentType; label: string }[] = [
    { id: 'document', label: t.docTypes.document },
    { id: 'handwriting', label: t.docTypes.handwriting },
    { id: 'receipt', label: t.docTypes.receipt },
    { id: 'form', label: t.docTypes.form },
    { id: 'table', label: t.docTypes.table },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Tipovi dokumenta */}
      <div className="mb-6">
        <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2.5">
          {t.docTypeSelectLabel}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {docTypesList.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedType(item.id)}
              className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-xl border text-center transition-all ${
                selectedType === item.id
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm ring-2 ring-indigo-200'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kamera interfejs za Web */}
      {cameraActive ? (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] max-h-[500px] flex flex-col items-center justify-center shadow-lg border border-slate-700">
          <video
            ref={el => {
              videoRef.current = el;
              if (el && stream) el.srcObject = stream;
            }}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
            <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
              Postavite papir unutar okvira
            </span>
          </div>
          
          <div className="absolute bottom-4 flex items-center gap-4">
            <button
              onClick={captureWebPhoto}
              className="bg-white text-slate-900 px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-indigo-50 active:scale-95 transition-all"
            >
              <CameraIcon className="w-5 h-5 text-indigo-600" />
              {t.takePhoto}
            </button>
            <button
              onClick={stopWebCamera}
              className="bg-black/60 text-white p-3 rounded-full hover:bg-black/80 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        /* Upload i Skeniranje oblast */
        <div
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
          onDrop={e => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-3xl p-6 sm:p-10 text-center transition-all bg-white shadow-sm ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-indigo-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />

          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600 mb-4 shadow-sm">
            <Upload className="w-8 h-8" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">
            {t.uploadArea}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
            {t.uploadHint}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleCameraClick}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <CameraIcon className="w-4 h-4" />
              {t.scanButton}
            </button>

            <button
              type="button"
              onClick={handleGalleryClick}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2 border border-slate-200"
            >
              <FolderOpen className="w-4 h-4 text-slate-600" />
              {currentLang === 'sr' ? 'Izaberi iz galerije' : 'Choose from gallery'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span>{t.privacyNotice}</span>
      </div>
    </div>
  );
};
