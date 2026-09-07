# Universal Paper Converter

Kompletan sistem za pretvaranje papirnih dokumenata (fotografija) u strukturisane, uređive digitalne dokumente (Web + Android + Backend).

## Podržano:
- **Jezici**: Srpski (latinica sa `č, ć, š, ž, đ`), Srpski (ćirilica), Engleski
- **Tipovi dokumenata**: Dokument, Rukopis, Račun, Formular, Tabela
- **Izvoz**: TXT, DOCX, PDF, CSV
- **Mobilne funkcije (Android)**: Kamera, Galerija, Android Share Sheet, zaštita privatnosti

---

## 1. Pokretanje Backenda (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API dokumentacija je dostupna na: `http://localhost:8000/docs`

### API Rute:
- `GET /api/v1/health`
- `POST /api/v1/analysis`
- `GET /api/v1/analysis/{id}/status`
- `GET /api/v1/analysis/{id}/result`
- `GET /api/v1/analysis/{id}/data`
- `GET /api/v1/analysis/{id}/columns`
- `GET /api/v1/analysis/{id}/export/{format}` (pdf, docx, txt, csv)

---

## 2. Pokretanje Web Aplikacije (React + TypeScript + Vite)

```bash
cd frontend-web
npm install
npm run dev
```
Aplikacija se pokreće na `http://localhost:5173`.

---

## 3. Android Aplikacija (Google Play AAB & Debug)

Android projekat se nalazi u `frontend-web/android/`.

### Generisanje AAB (Android App Bundle za Google Play):
1. Otvorite direktorijum `frontend-web/android/` u **Android Studio** ili pokrenite Gradle komandu:
```bash
cd frontend-web/android
./gradlew bundleRelease
```
Generisani `.aab` fajl biće kreiran u:
`frontend-web/android/app/build/outputs/bundle/release/app-release.aab`

### Sinhronizacija izmena sa Android projektom:
```bash
cd frontend-web
npm run build
npx cap sync android
```
