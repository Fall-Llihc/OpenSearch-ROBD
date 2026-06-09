# CostPulse — Analisis Biaya Operasional RS Sehat Selalu

RAG-based cost analytics dashboard. OpenSearch sebagai retriever, Groq LLM sebagai generator.

## Stack
- **Backend**: FastAPI + OpenSearch + Groq LLM → deploy ke Railway
- **Frontend**: React 18 via CDN + Babel (tanpa bundler) → deploy ke Vercel
- **Data**: 7 OpenSearch indices, 6.890 total dokumen

## Struktur Project
```
CostPulse/
├── backend/
│   ├── main.py            ← FastAPI app (RAG pipeline)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html         ← Entry point (buka langsung di browser)
│   ├── styles.css
│   ├── aurora.js
│   ├── icons.jsx
│   ├── data.jsx           ← Fetch ke API backend
│   ├── dashboard.jsx      ← Sidebar + charts
│   ├── chat.jsx           ← Chat components
│   └── app.jsx            ← Orchestration
├── data/                  ← 7 JSON dataset (load ke OpenSearch)
├── scripts/
│   └── load_data.py       ← ETL script
├── railway.toml
├── vercel.json
└── .env.example
```

## Setup Lokal

### 1. OpenSearch
```bash
docker-compose up -d   # jalankan OpenSearch lokal
```

### 2. Load Data
```bash
pip install opensearch-py
python scripts/load_data.py --host localhost --port 9200 --data-dir ./data
```

### 3. Backend
```bash
cd backend
pip install -r requirements.txt
# buat .env dari .env.example lalu isi GROQ_API_KEY
uvicorn main:app --reload --port 8000
```

### 4. Frontend
Buka `frontend/index.html` langsung di browser.
Tidak butuh npm/node — langsung buka file HTML.

> Untuk local dev, pastikan `window.COSTPULSE_API = "http://localhost:8000"`
> sudah benar di `frontend/index.html` (sudah di-set otomatis sebagai default).

---

## Deploy ke Railway + Vercel

### Railway (Backend)
1. Push ke GitHub
2. Buat project baru di railway.app
3. Connect repo → Railway otomatis detect `railway.toml` dan build `backend/Dockerfile`
4. Set environment variables:
   - `OPENSEARCH_URL`
   - `GROQ_API_KEY`
   - `GROQ_MODEL` = `llama-3.1-8b-instant`
5. Catat URL Railway (misal: `https://costpulse-abc.up.railway.app`)

### Load Data ke OpenSearch Cloud
```bash
python scripts/load_data.py \
  --host your-cluster.bonsaisearch.net \
  --port 443 \
  --user USER \
  --password PASS \
  --ssl \
  --data-dir ./data
```

### Vercel (Frontend)
1. Di `frontend/index.html`, ganti URL API:
   ```html
   <script>
     window.COSTPULSE_API = "https://costpulse-abc.up.railway.app";
   </script>
   ```
2. Buat project baru di vercel.com
3. Import GitHub repo
4. **Root Directory**: `frontend`
5. **Framework**: Other (static)
6. **Build Command**: _(kosongkan)_
7. **Output Directory**: `.` (titik)
8. Deploy

### Checklist Sebelum Deploy
- [ ] OpenSearch bisa diakses dari Railway
- [ ] Semua 7 index sudah ter-load (cek `/debug`)
- [ ] GROQ_API_KEY valid
- [ ] `window.COSTPULSE_API` di `index.html` sudah mengarah ke Railway URL
- [ ] `/health` endpoint return `{"status":"healthy"}`
- [ ] `/cost-summary` return data (bukan semua 0)

---

## Dataset
| Index | Records | Isi |
|-------|---------|-----|
| cost_obat | 1.000 | Obat, harga, stok, pemakaian |
| cost_alat_medis | 1.000 | Peralatan, depresiasi, servis |
| cost_lab | 1.000 | Pemeriksaan, reagent, volume |
| cost_sdm | 1.000 | Karyawan, gaji, BPJS, lembur |
| cost_utilitas | 2.520 | Listrik, air, gas — per dept per bulan |
| cost_departments | 10 | Master departemen |
| cost_monthly | 360 | Time-series 3 tahun per dept |
| **Total** | **6.890** | |
