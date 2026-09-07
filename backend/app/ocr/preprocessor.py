import cv2
import numpy as np
from PIL import Image
import io

class ImagePreprocessor:
    @staticmethod
    def bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img

    @staticmethod
    def cv2_to_bytes(img: np.ndarray, format: str = ".png") -> bytes:
        success, encoded = cv2.imencode(format, img)
        if not success:
            raise ValueError("Greška pri enkodovanju slike.")
        return encoded.tobytes()

    @staticmethod
    def deskew(img: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        # Invertuj boje za pronalaženje teksta
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) < 50:
            return img
        
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        else:
            angle = -angle

        # Samo ako je ugao umeren (-30 do 30 stepeni)
        if abs(angle) > 0.5 and abs(angle) < 30:
            (h, w) = img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                img, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
            return rotated
        return img

    @staticmethod
    def enhance_contrast(img: np.ndarray) -> np.ndarray:
        if len(img.shape) == 3:
            # Konvertuj u LAB i primeni CLAHE na L kanal
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            limg = cv2.merge((cl, a, b))
            enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
            return enhanced
        else:
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
            return clahe.apply(img)

    @staticmethod
    def clean_paper(img: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        # Uklanjanje šuma
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
        # Adaptivni prag za ujednačenu svetlost na papiru
        binary = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 21, 11
        )
        return binary

    @classmethod
    def preprocess_pipeline(cls, image_bytes: bytes, deskew: bool = True, enhance: bool = True) -> np.ndarray:
        img = cls.bytes_to_cv2(image_bytes)
        if img is None:
            raise ValueError("Neispravan format slike.")
        if deskew:
            img = cls.deskew(img)
        if enhance:
            img = cls.enhance_contrast(img)
        return img
