# CostPulse — Benchmark Pertanyaan LLM vs MongoDB
## Validasi Akurasi Jawaban RAG System

Dokumen ini berisi 10 pertanyaan unik beserta:
- **Jawaban yang seharusnya** (dihitung dari data JSON asli)
- **MongoDB Compass query** untuk memverifikasi
- **Koleksi yang perlu diimport** ke MongoDB

---

## Setup MongoDB Compass

Import 7 file JSON ke database `costpulse`:
```
costpulse.cost_obat          ← hospital_db_obat.json
costpulse.cost_alat_medis    ← hospital_db_alat_medis.json
costpulse.cost_lab           ← hospital_db_lab.json
costpulse.cost_sdm           ← hospital_db_sdm.json
costpulse.cost_utilitas      ← hospital_db_utilitas.json
costpulse.cost_departments   ← hospital_db_departments.json
costpulse.cost_monthly       ← hospital_db_monthly_cost.json
```

---

## Q1 — Total Biaya Kompensasi Seluruh SDM

**Pertanyaan ke LLM:**
> "Berapa total biaya kompensasi seluruh karyawan rumah sakit per bulan?"

**Jawaban yang seharusnya:**
```
Total kompensasi bulanan: Rp 22.647.153.338
(1.000 karyawan aktif)
```

**MongoDB Compass — Collection: `cost_sdm`**
Tab **"Aggregations"**, masukkan pipeline:
```json
[
  {
    "$group": {
      "_id": null,
      "total_kompensasi": { "$sum": "$total_kompensasi_bulanan" },
      "jumlah_karyawan":  { "$sum": 1 }
    }
  }
]
```
✅ Hasil: `total_kompensasi: 22647153338`, `jumlah_karyawan: 1000`

---

## Q2 — Jabatan dengan Rata-Rata Gaji Tertinggi

**Pertanyaan ke LLM:**
> "Jabatan apa yang memiliki rata-rata gaji pokok tertinggi di rumah sakit?"

**Jawaban yang seharusnya:**
```
1. Dokter Sub-Spesialis  : Rp 83.139.385/bulan (rata-rata)
2. Dokter Spesialis      : Rp 58.873.086/bulan (rata-rata)
3. Dokter Umum           : Rp 20.390.237/bulan (rata-rata)
```

**MongoDB Compass — Collection: `cost_sdm`**
```json
[
  {
    "$group": {
      "_id": "$jabatan",
      "rata_gaji_pokok": { "$avg": "$gaji_pokok" },
      "jumlah":          { "$sum": 1 }
    }
  },
  { "$sort": { "rata_gaji_pokok": -1 } },
  { "$limit": 5 }
]
```
✅ Top 3: Dokter Sub-Spesialis → Dokter Spesialis → Dokter Umum

---

## Q3 — Kategori Obat dengan Biaya Pemakaian Tertinggi

**Pertanyaan ke LLM:**
> "Kategori obat mana yang paling besar biaya pemakaiannya bulan ini?"

**Jawaban yang seharusnya:**
```
1. Kortikosteroid   : Rp 39.330.031.186
2. Vitamin & Mineral: Rp 38.163.253.953
3. Respiratory      : Rp 38.123.396.658
```

**MongoDB Compass — Collection: `cost_obat`**
```json
[
  {
    "$group": {
      "_id": "$kategori_obat",
      "total_biaya_pemakaian": { "$sum": "$biaya_pemakaian_bulan" },
      "jumlah_item":           { "$sum": 1 }
    }
  },
  { "$sort": { "total_biaya_pemakaian": -1 } },
  { "$limit": 5 }
]
```
✅ Top 3: Kortikosteroid → Vitamin & Mineral → Respiratory

---

## Q4 — Alat Medis Kondisi Rusak

**Pertanyaan ke LLM:**
> "Berapa jumlah alat medis yang kondisinya rusak dan berapa total biaya servisnya?"

**Jawaban yang seharusnya:**
```
Alat kondisi "Rusak" : 53 unit
Total biaya servis   : Rp 7.866.939.451/tahun
```

**MongoDB Compass — Collection: `cost_alat_medis`**

Filter (tab Filter):
```json
{ "kondisi": "Rusak" }
```
Lalu Aggregation untuk total servis:
```json
[
  { "$match": { "kondisi": "Rusak" } },
  {
    "$group": {
      "_id": null,
      "jumlah_unit":        { "$sum": 1 },
      "total_biaya_servis": { "$sum": "$biaya_servis_tahunan" }
    }
  }
]
```
✅ Hasil: `jumlah_unit: 53`, `total_biaya_servis: 7866939451`

---

## Q5 — Departemen dengan Biaya Operasional Tertinggi

**Pertanyaan ke LLM:**
> "Departemen mana yang memiliki total biaya operasional paling besar?"

**Jawaban yang seharusnya:**
```
1. ICU & Rawat Intensif : Rp 63.039.202.234
2. Bedah Umum           : Rp 54.777.302.341
3. Kardiologi           : Rp 37.533.244.803
```

**MongoDB Compass — Collection: `cost_monthly`**
```json
[
  {
    "$group": {
      "_id": "$nama_departemen",
      "total_biaya": { "$sum": "$total_biaya_operasional" }
    }
  },
  { "$sort": { "total_biaya": -1 } },
  { "$limit": 5 }
]
```
✅ Top 3: ICU → Bedah Umum → Kardiologi

---

## Q6 — Total Biaya Utilitas Listrik

**Pertanyaan ke LLM:**
> "Berapa total biaya listrik rumah sakit dari seluruh departemen?"

**Jawaban yang seharusnya:**
```
Total biaya listrik: Rp 12.117.931.203
(dari 360 transaksi, semua periode 2023–2025)
```

**MongoDB Compass — Collection: `cost_utilitas`**
```json
[
  { "$match": { "jenis_utilitas": "Listrik" } },
  {
    "$group": {
      "_id": null,
      "total_biaya_listrik": { "$sum": "$total_biaya" },
      "jumlah_transaksi":    { "$sum": 1 }
    }
  }
]
```
✅ Hasil: `total_biaya_listrik: 12117931203`, `jumlah_transaksi: 360`

---

## Q7 — Jenis Pemeriksaan Lab dengan Margin Kotor Tertinggi

**Pertanyaan ke LLM:**
> "Jenis pemeriksaan laboratorium mana yang menghasilkan margin kotor terbesar?"

**Jawaban yang seharusnya:**
```
1. Endokrinologi : Rp 29.075.421.675
2. Urinalisis    : Rp 24.992.605.934
3. Sitologi      : Rp 24.048.533.956
```

**MongoDB Compass — Collection: `cost_lab`**
```json
[
  {
    "$group": {
      "_id": "$jenis_pemeriksaan",
      "total_margin":  { "$sum": "$margin_kotor_bulan" },
      "total_volume":  { "$sum": "$volume_pemeriksaan_bulan" }
    }
  },
  { "$sort": { "total_margin": -1 } },
  { "$limit": 5 }
]
```
✅ Top 3: Endokrinologi → Urinalisis → Sitologi

---

## Q8 — Vendor Alat Medis dengan Nilai Aset Terbesar

**Pertanyaan ke LLM:**
> "Vendor alat medis mana yang nilai total asetnya paling besar di rumah sakit?"

**Jawaban yang seharusnya:**
```
1. Nihon Kohden : Rp 308.985.472.883
2. Mindray      : Rp 281.688.289.892
3. B. Braun     : Rp 270.710.851.524
```

**MongoDB Compass — Collection: `cost_alat_medis`**
```json
[
  {
    "$group": {
      "_id": "$vendor",
      "total_nilai_aset":  { "$sum": "$harga_beli" },
      "jumlah_unit":       { "$sum": 1 }
    }
  },
  { "$sort": { "total_nilai_aset": -1 } },
  { "$limit": 5 }
]
```
✅ Top 3: Nihon Kohden → Mindray → B. Braun

---

## Q9 — Komposisi Status Kepegawaian

**Pertanyaan ke LLM:**
> "Berapa persentase karyawan tetap, kontrak, dan magang di rumah sakit?"

**Jawaban yang seharusnya:**
```
Tetap   : 903 orang (90.3%)
Kontrak : 50 orang  (5.0%)
Magang  : 47 orang  (4.7%)
Total   : 1.000 karyawan
```

**MongoDB Compass — Collection: `cost_sdm`**
```json
[
  {
    "$group": {
      "_id": "$status_karyawan",
      "jumlah": { "$sum": 1 }
    }
  },
  { "$sort": { "jumlah": -1 } }
]
```
Lalu hitung persentase manual: jumlah / 1000 × 100

✅ Hasil: Tetap 903 → Kontrak 50 → Magang 47

---

## Q10 — Bulan dengan Biaya Operasional Tertinggi (2024)

**Pertanyaan ke LLM:**
> "Pada bulan apa tahun 2024 biaya operasional rumah sakit paling tinggi?"

**Jawaban yang seharusnya:**
```
1. November 2024 : Rp 9.755.965.490
2. April 2024    : Rp 9.754.103.073
3. Mei 2024      : Rp 9.715.632.916
```

**MongoDB Compass — Collection: `cost_monthly`**
```json
[
  { "$match": { "tahun": 2024 } },
  {
    "$group": {
      "_id": "$bulan",
      "total_biaya": { "$sum": "$total_biaya_operasional" }
    }
  },
  { "$sort": { "total_biaya": -1 } },
  { "$limit": 3 }
]
```
✅ Top 3: bulan 11 (Nov) → bulan 4 (Apr) → bulan 5 (Mei)

---

## Cara Pakai di MongoDB Compass

1. Buka Compass → connect ke MongoDB lokal
2. Buat database `costpulse`
3. Import tiap JSON via **"Add Data" → "Import File"** ke collection yang sesuai
4. Untuk menjalankan aggregation: klik collection → tab **"Aggregations"** → paste pipeline JSON → klik **"Run"**
5. Untuk filter sederhana: tab **"Documents"** → masukkan filter di kolom atas → klik **"Apply"**

---

## Ringkasan Jawaban (Cheat Sheet)

| # | Pertanyaan Singkat | Jawaban Kunci |
|---|-------------------|---------------|
| Q1 | Total kompensasi SDM | Rp 22,65 M/bulan |
| Q2 | Jabatan gaji tertinggi | Dokter Sub-Sp (Rp 83,1 jt avg) |
| Q3 | Kategori obat termahal | Kortikosteroid (Rp 39,3 M) |
| Q4 | Alat kondisi rusak | 53 unit, servis Rp 7,87 M/tahun |
| Q5 | Dept biaya tertinggi | ICU (Rp 63,04 M) |
| Q6 | Total biaya listrik | Rp 12,12 M |
| Q7 | Lab margin terbesar | Endokrinologi (Rp 29,1 M) |
| Q8 | Vendor nilai aset terbesar | Nihon Kohden (Rp 309 M) |
| Q9 | % karyawan tetap | 90,3% (903 dari 1.000) |
| Q10 | Bulan termahal 2024 | November (Rp 9,76 M) |
