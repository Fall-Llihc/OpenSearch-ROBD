# 🏥 Hospital QA System — Rumah Sakit Sehat Selalu

> **Retrieval-Augmented Generation (RAG) Question & Answer System** berbasis OpenSearch dan Groq LLM untuk data operasional Rumah Sakit Sehat Selalu.

[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Frontend](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Search](https://img.shields.io/badge/Search-OpenSearch_2.13-005EB8?style=flat-square&logo=opensearch)](https://opensearch.org)
[![LLM](https://img.shields.io/badge/LLM-Groq_Llama_3.1-F55036?style=flat-square)](https://groq.com)
[![Deploy](https://img.shields.io/badge/Deploy-Railway_+_Vercel-black?style=flat-square)](https://railway.app)

---

## 📋 Deskripsi Proyek

Proyek ini merupakan Tugas Akhir Mata Kuliah **Basis Data Tidak Relasional** yang mengimplementasikan sistem QA berbasis RAG di atas **OpenSearch** sebagai vector/search database. Sistem mampu menjawab pertanyaan dalam Bahasa Indonesia mengenai data operasional rumah sakit secara real-time dengan jawaban yang akurat berdasarkan data nyata.

### Pilihan Pendekatan

Dari dua pilihan yang tersedia, kelompok memilih **Pilihan 1**: mentransformasi seluruh data MongoDB ke OpenSearch dan membangun QA module langsung di atasnya.

**Alasan:**
- Data tersedia dalam format MongoDB Extended JSON sehingga mudah di-ETL
- OpenSearch mendukung full-text search, fuzzy matching, dan aggregation query secara native
- Kontrol penuh atas mapping, tokenisasi, dan relevansi pencarian
- Groq API (Llama 3.1) dipilih karena gratis, cepat, dan tidak memerlukan kartu kredit

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Frontend — React 18 + Vite (Vercel)                │
│   Chat UI · Sidebar Stats · Aurora WebGL Background             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /ask
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend — FastAPI Python (Railway)                  │
│                                                                  │
│  1. Keyword Routing  →  pilih index relevan                      │
│  2. Aggregation Query →  count/sum/terms dari OpenSearch         │
│  3. Document Search  →  sample dokumen relevan                   │
│  4. Build Context    →  gabung statistik + sample                │
│  5. Groq LLM         →  generate jawaban Bahasa Indonesia        │
│  6. Strip Markdown   →  pastikan output plain text               │
└──────────┬────────────────────────────────────────┬─────────────┘
           │ Search + Aggregation                    │ Chat Completion
           ▼                                         ▼
┌──────────────────────────┐             ┌───────────────────────┐
│  OpenSearch (Bonsai.io)  │             │  Groq API             │
│  8 indices · 8.000 docs  │             │  llama-3.3-70b /      │
│  Full-text + Aggregation │             │  llama-3.1-8b-instant │
└──────────────────────────┘             └───────────────────────┘
```

### Alur RAG (Retrieval-Augmented Generation)

| Step | Komponen | Aksi |
|------|----------|------|
| 1 | Frontend | User mengirim pertanyaan via chat UI |
| 2 | Backend | Keyword routing → identifikasi index relevan |
| 3 | OpenSearch | Aggregation query → statistik akurat (count, sum, terms) |
| 4 | OpenSearch | Document search → sample dokumen relevan |
| 5 | Backend | Gabungkan statistik + sample menjadi konteks |
| 6 | Groq LLM | Generate jawaban Bahasa Indonesia berdasarkan konteks |
| 7 | Backend | Strip markdown → pastikan output plain text |
| 8 | Frontend | Tampilkan jawaban + source chips di chat bubble |

---

## 🗄️ Dataset

Dataset berasal dari sistem MongoDB **Rumah Sakit Sehat Selalu** dengan 8 collection, total **8.000 dokumen**.

### Struktur Collection

| Collection | Dokumen | Field Utama | Nilai / Keterangan |
|------------|---------|-------------|-------------------|
| `hospital_patients` | 1.000 | `patient_id`, `nama_pasien`, `tipe_pasien`, `team_id` | BPJS (334), Asuransi (333), Umum (333) |
| `hospital_doctors` | 1.000 | `doctor_id`, `nama_dokter`, `spesialisasi`, `dept_id` | 10 spesialisasi, 100 dokter/spesialisasi |
| `hospital_departments` | 1.000 | `dept_id`, `nama_departemen` | Neurologi, Kardiologi, Ortopedi, Pediatri, dll |
| `hospital_teams` | 1.000 | `team_id`, `nama_tim` | Tim Medis 1–1000 |
| `hospital_services` | 1.000 | `service_id`, `nama_layanan`, `jenis_layanan`, `tarif_dasar` | Rawat Inap, Rawat Jalan, Operasi, Radiologi, Lab |
| `hospital_bills` | 1.000 | `bill_id`, `total_biaya`, `status_tagihan`, `tanggal_tagihan` | Belum Lunas (334), total Rp 1,69 M |
| `hospital_payments` | 1.000 | `payment_id`, `metode_pembayaran`, `jumlah_bayar`, `status_pembayaran` | Tunai, Transfer, BPJS, Kartu Kredit, QRIS |
| `hospital_tim_dokter` | 1.000 | `doctor_id`, `team_id` | Relasi dokter ↔ tim medis |

### Spesialisasi Dokter
Spesialis Neurologi · Kardiologi · Ortopedi · Pediatri · Bedah Umum · Penyakit Dalam · Mata · THT · Gigi · Radiologi

### Status & Metode
- **Status tagihan:** Lunas · Belum Lunas · Diproses
- **Metode pembayaran:** Tunai · Transfer Bank · BPJS · Kartu Kredit · QRIS
- **Status pembayaran:** Berhasil · Pending · Gagal

---

## 🔧 Tech Stack

| Layer | Teknologi | Versi | Keterangan |
|-------|-----------|-------|------------|
| **Search DB** | OpenSearch | 2.13 / 2.19 | Full-text search + aggregation |
| **Search Hosting** | Bonsai.io | — | OpenSearch cloud (free tier) |
| **Backend** | FastAPI | 0.111 | REST API, RAG orchestration |
| **Runtime** | Python | 3.11 | |
| **LLM** | Groq (Llama 3.1/3.3) | — | Generator jawaban, gratis |
| **Frontend** | React | 18.3 | Chat UI |
| **Build Tool** | Vite | 5.4 | |
| **Styling** | CSS Custom | — | Dark clinical theme, CSS vars |
| **WebGL** | ogl | 1.0.11 | Aurora animated background |
| **ETL** | Python | — | `scripts/load_data.py` |
| **Container** | Docker + Compose | — | Local development |
| **Deploy Backend** | Railway | — | Docker-based deployment |
| **Deploy Frontend** | Vercel | — | Vite static deployment |

---

## 📁 Struktur Proyek

```
hospital-qa/
│
├── backend/
│   ├── main.py              # FastAPI app: /ask /health /stats /debug
│   ├── requirements.txt     # fastapi uvicorn opensearch-py groq httpx
│   └── Dockerfile           # Python 3.11 slim image
│
├── frontend/
│   ├── index.html           # Entry HTML, load Google Fonts
│   ├── package.json         # React 18, Vite, ogl
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── App.jsx          # Main component: chat, sidebar, aurora
│       ├── aurora.js        # WebGL aurora background (ogl)
│       ├── main.jsx         # React root
│       └── index.css        # Full custom CSS, dark clinical theme
│
├── scripts/
│   └── load_data.py         # ETL: MongoDB JSON → OpenSearch 8 indices
│
├── data/                    # 8 file JSON dari MongoDB (tidak di-commit)
│   ├── hospital_db_patients.json
│   ├── hospital_db_doctors.json
│   ├── hospital_db_departments.json
│   ├── hospital_db_teams.json
│   ├── hospital_db_services.json
│   ├── hospital_db_bills.json
│   ├── hospital_db_payments.json
│   └── hospital_db_tim_dokter.json
│
├── docker-compose.yml       # Stack lokal: OpenSearch + Dashboards + Backend
├── railway.toml             # Railway deployment config
├── vercel.json              # Vercel SPA routing config
├── .env.example             # Template environment variables
├── .gitignore
└── README.md
```

---

## ⚙️ Environment Variables

### Backend (Railway)

| Variable | Contoh | Keterangan |
|----------|--------|------------|
| `GROQ_API_KEY` | `gsk_xxx...` | API key dari console.groq.com |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Model Groq yang digunakan |
| `OPENSEARCH_URL` | `https://user:pass@host:port` | URL Bonsai/Aiven (jika pakai cloud) |
| `OPENSEARCH_HOST` | `localhost` | Host OpenSearch (jika self-hosted) |
| `OPENSEARCH_PORT` | `9200` | Port OpenSearch |
| `OPENSEARCH_USER` | `admin` | Username OpenSearch |
| `OPENSEARCH_PASS` | `admin` | Password OpenSearch |

### Frontend (Vercel)

| Variable | Contoh | Keterangan |
|----------|--------|------------|
| `VITE_API_URL` | `https://xxx.up.railway.app` | URL backend Railway (tanpa trailing slash) |

> ⚠️ `VITE_API_URL` di-embed saat **build time** — wajib redeploy Vercel setelah mengubah nilai ini.

---

## 🚀 Cara Menjalankan

### A. Lokal dengan Docker Compose

```bash
# 1. Clone repository
git clone https://github.com/Fall-Llihc/OpenSearch-ROBD.git
cd OpenSearch-ROBD

# 2. Salin dan isi environment variable
cp .env.example .env
# Edit .env → isi GROQ_API_KEY

# 3. Jalankan stack
docker compose up -d

# 4. Tunggu OpenSearch siap (~30 detik), lalu load data
pip install opensearch-py
python scripts/load_data.py --data-dir ./data

# 5. Jalankan frontend
cd frontend
npm install
npm run dev

# 6. Akses aplikasi
# Frontend : http://localhost:3000
# Backend  : http://localhost:8000
# API Docs : http://localhost:8000/docs
# Dashboards: http://localhost:5601
```

### B. Load Data ke OpenSearch Cloud (Bonsai / Aiven)

```bash
pip install opensearch-py

# Bonsai
python scripts/load_data.py \
  --host <your-host>.bonsaisearch.net \
  --port 443 \
  --user <username> \
  --password <password> \
  --data-dir ./data

# Port bukan 9200 → SSL otomatis aktif
```

---

## 🌐 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/` | Health check dasar |
| `GET` | `/health` | Status backend + OpenSearch version |
| `POST` | `/ask` | Submit pertanyaan, terima jawaban RAG |
| `GET` | `/stats` | Jumlah dokumen per index |
| `GET` | `/debug` | Debug: koneksi, aggregation test, Groq test |
| `GET` | `/docs` | Swagger UI (auto-generated) |

### Contoh Request `/ask`

```bash
curl -X POST https://your-backend.up.railway.app/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Berapa total pasien BPJS?"}'
```

```json
{
  "answer": "Total pasien BPJS di Rumah Sakit Sehat Selalu adalah 334 pasien...",
  "sources": [
    { "index": "patients", "score": 1.0 }
  ]
}
```

---

## 🔍 Implementasi OpenSearch

### 1. Indexing (ETL)

File `scripts/load_data.py` melakukan transformasi dan indexing:

```python
# Transformasi format MongoDB → OpenSearch
def clean_record(record):
    for k, v in record.items():
        if k == "_id": continue              # hapus MongoDB _id
        if "$date" in v:                     # normalisasi tanggal
            out[k] = datetime.fromisoformat(v["$date"]).strftime("%Y-%m-%d")

# Bulk indexing dengan chunk 500 dokumen
helpers.bulk(client, generate_actions(index_name, records), chunk_size=500)
```

### 2. Index Mapping

Setiap index memiliki mapping eksplisit. Contoh `hospital_doctors`:

```json
{
  "mappings": {
    "properties": {
      "doctor_id":    { "type": "integer" },
      "nama_dokter":  { "type": "text", "analyzer": "standard" },
      "spesialisasi": { "type": "keyword" },
      "dept_id":      { "type": "integer" }
    }
  }
}
```

### 3. Aggregation Query (untuk pertanyaan count/sum)

Untuk pertanyaan seperti "berapa total pasien?", sistem menggunakan OpenSearch Aggregation API — bukan sample dokumen:

```python
# Terms aggregation → count per kategori
client.search(index="hospital_patients", body={
    "size": 0,
    "aggs": {
        "per_tipe": { "terms": { "field": "tipe_pasien", "size": 10 } }
    }
})
# → { "BPJS": 334, "Asuransi": 333, "Umum": 333 }

# Sum aggregation → total nilai tagihan
client.search(index="hospital_bills", body={
    "size": 0,
    "aggs": {
        "total_biaya": { "sum": { "field": "total_biaya" } }
    }
})
# → Rp 5.123.456.789
```

### 4. Search Query (untuk pertanyaan deskriptif)

```python
client.search(index=index, body={
    "query": {
        "multi_match": {
            "query": question,
            "fields": ["*"],
            "type": "best_fields"
        }
    },
    "size": 8
})
```

---

## 📦 Deployment

### Railway (Backend)

```toml
# railway.toml
[build]
builder       = "DOCKERFILE"
dockerfilePath = "backend/Dockerfile"
buildContext   = "backend"

[deploy]
healthcheckPath    = "/"
healthcheckTimeout = 120
restartPolicyType  = "ON_FAILURE"
```

### Vercel (Frontend)

Konfigurasi di **Vercel Dashboard → Settings**:

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

---

## 💬 Contoh Pertanyaan

| Pertanyaan | Jenis |
|------------|-------|
| Berapa total pasien keseluruhan? | Count |
| Berapa jumlah dokter spesialis neurologi? | Count + Filter |
| Berapa total tagihan yang belum lunas? | Count + Sum |
| Apa saja departemen yang ada di rumah sakit? | List |
| Metode pembayaran apa saja yang tersedia? | List |
| Berapa tarif layanan radiologi? | Agregasi + Filter |
| Dokter spesialisasi apa saja yang ada? | Group by |

---

## 👥 Tim Pengembang

| Nama | NIM | Peran |
|------|-----|-------|
| Anggota 1 | 1301210001 | Project Manager · Backend Lead · RAG Pipeline |
| Anggota 2 | 1301210002 | Data Engineer · ETL · OpenSearch Mapping |
| Anggota 3 | 1301210003 | Frontend Developer · UI/UX · Vercel Deploy |
| Anggota 4 | 1301210004 | QA Testing · Railway Deploy · Dokumentasi |

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan akademis — Tugas Akhir Mata Kuliah Basis Data Tidak Relasional, Universitas Telkom, 2026.

---

<div align="center">
  <sub>Built with OpenSearch · FastAPI · React · Groq LLM</sub>
</div>
