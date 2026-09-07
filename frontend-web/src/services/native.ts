import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const takeNativePhoto = async (): Promise<{ blob: Blob; previewUrl: string }> => {
  const image = await Camera.getPhoto({
    quality: 95,
    allowEditing: true,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
  });

  if (!image.webPath) {
    throw new Error('Fotografija nije uspešno snimljena.');
  }

  const response = await fetch(image.webPath);
  const blob = await response.blob();
  return {
    blob,
    previewUrl: image.webPath,
  };
};

export const pickGalleryPhoto = async (): Promise<{ blob: Blob; previewUrl: string }> => {
  const image = await Camera.getPhoto({
    quality: 95,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Photos,
  });

  if (!image.webPath) {
    throw new Error('Slika nije izabrana.');
  }

  const response = await fetch(image.webPath);
  const blob = await response.blob();
  return {
    blob,
    previewUrl: image.webPath,
  };
};

export const shareNativeDocument = async (title: string, text: string, url?: string) => {
  if (isNativePlatform()) {
    await Share.share({
      title,
      text,
      url,
      dialogTitle: 'Podeli digitalizovani dokument',
    });
  } else if (navigator.share) {
    await navigator.share({
      title,
      text,
      url: url || window.location.href,
    });
  } else {
    // Fallback: kopiraj u clipboard
    await navigator.clipboard.writeText(text);
    alert('Sadržaj dokumenta je kopiran u clipboard.');
  }
};
