"""
main.py — Hospital Operational Cost Analytics API
Analisis Biaya Operasional: Obat, Alat Medis, Lab, SDM, Utilitas
RAG Pipeline: OpenSearch (retriever) + Groq LLM (generator)
"""

import os
import re
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from opensearchpy import OpenSearch
from groq import Groq

app = FastAPI(title="Hospital Cost Analytics API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Clients ────────────────────────────────────────────────────────────────────
def get_os_client():
    url = os.getenv("OPENSEARCH_URL", "")
    if url:
        return OpenSearch(
            hosts=[url],
            http_compress=True,
            use_ssl=url.startswith("https"),
            verify_certs=False,
            ssl_show_warn=False,
        )
    use_ssl = os.getenv("OPENSEARCH_USE_SSL", "false").lower() == "true"
    return OpenSearch(
        hosts=[{"host": os.getenv("OPENSEARCH_HOST", "localhost"),
                "port": int(os.getenv("OPENSEARCH_PORT", "9200"))}],
        http_auth=(os.getenv("OPENSEARCH_USER", "admin"),
                   os.getenv("OPENSEARCH_PASS", "admin")),
        use_ssl=use_ssl,
        verify_certs=False,
        ssl_show_warn=False,
    )

def get_groq_client():
    return Groq(api_key=os.getenv("GROQ_API_KEY", ""))

# ── Index names ────────────────────────────────────────────────────────────────
INDICES = [
    "cost_obat",
    "cost_alat_medis",
    "cost_lab",
    "cost_sdm",
    "cost_utilitas",
    "cost_departments",
    "cost_monthly",
]

COST_CATEGORIES = {
    "obat":        "Biaya Obat & Farmasi",
    "alat_medis":  "Biaya Alat Medis",
    "lab":         "Biaya Laboratorium",
    "sdm":         "Biaya SDM & Tenaga Kerja",
    "utilitas":    "Biaya Utilitas & Overhead",
}

# ── Models ─────────────────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str
    max_results: Optional[int] = 4

class AskResponse(BaseModel):
    answer: str
    sources: list

class CostSummaryResponse(BaseModel):
    by_category: dict
    by_department: list
    trend_monthly: list
    top_items: dict

# ── Strip markdown ─────────────────────────────────────────────────────────────
def strip_markdown(text: str) -> str:
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"_{1,3}(.+?)_{1,3}", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# ── Intent detection ───────────────────────────────────────────────────────────
def detect_intent(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ["berapa total","total biaya","jumlah biaya","total pengeluaran",
                              "berapa pengeluaran","keseluruhan biaya","biaya keseluruhan"]):
        return "sum"
    if any(k in q for k in ["perbandingan","bandingkan","terbesar","terkecil","ranking",
                              "tertinggi","terendah","terbanyak"]):
        return "rank"
    if any(k in q for k in ["tren","trend","per bulan","bulanan","historis","dari waktu"]):
        return "trend"
    if any(k in q for k in ["departemen mana","per departemen","breakdown dept",
                              "departemen apa","setiap departemen"]):
        return "by_dept"
    if any(k in q for k in ["apa saja","daftar","sebutkan","tampilkan","list"]):
        return "list"
    return "general"

# ── Keyword routing ────────────────────────────────────────────────────────────
def get_relevant_indices(question: str) -> list:
    q = question.lower()
    mapping = {
        "cost_obat":        ["obat","farmasi","obat-obatan","apotek","antibiotik","analgesik",
                             "cairan infus","supplier obat","stok obat","kadaluarsa"],
        "cost_alat_medis":  ["alat","alat medis","peralatan","ventilator","mesin","mri","ct scan",
                             "monitor","depresiasi","servis alat","kondisi alat","pemeliharaan"],
        "cost_lab":         ["lab","laboratorium","pemeriksaan","reagen","reagent","tes lab",
                             "uji lab","hematologi","kimia darah","pcr","mikrobiologi"],
        "cost_sdm":         ["sdm","karyawan","pegawai","dokter","perawat","gaji","tunjangan",
                             "insentif","lembur","bpjs","kompensasi","jabatan","tenaga kerja"],
        "cost_utilitas":    ["utilitas","listrik","air","gas","internet","telekomunikasi",
                             "limbah","gedung","hvac","ac","overhead","pln","pdam"],
        "cost_monthly":     ["bulanan","per bulan","tren","trend","historis","anggaran",
                             "realisasi","periode","total operasional","biaya operasional"],
        "cost_departments": ["departemen","dept","bagian","instalasi","unit","divisi"],
    }
    selected = []
    for index, keywords in mapping.items():
        if any(kw in q for kw in keywords):
            selected.append(index)
    return selected if selected else INDICES

# ── Build aggregation context ──────────────────────────────────────────────────
def build_agg_context(question: str) -> str:
    client = get_os_client()
    q = question.lower()
    parts = []
    relevant = get_relevant_indices(question)

    # ── 1. OBAT ───────────────────────────────────────────────────────────────
    if "cost_obat" in relevant or any(k in q for k in ["obat","farmasi","apotek"]):
        try:
            r = client.search(index="cost_obat", body={
                "size": 0,
                "aggs": {
                    "total_pemakaian": {"sum": {"field": "biaya_pemakaian_bulan"}},
                    "per_kategori": {"terms": {"field": "kategori_obat", "size": 10},
                                     "aggs": {"biaya": {"sum": {"field": "biaya_pemakaian_bulan"}}}},
                    "per_supplier": {"terms": {"field": "supplier", "size": 10},
                                     "aggs": {"biaya": {"sum": {"field": "biaya_pemakaian_bulan"}}}},
                    "avg_harga": {"avg": {"field": "harga_satuan"}},
                    "stok_rendah": {"filter": {"range": {"stok_tersedia": {"lte": 50}}}},
                }
            })
            agg = r["aggregations"]
            total_obat = client.count(index="cost_obat")["count"]
            parts.append(f"=== BIAYA OBAT & FARMASI ===")
            parts.append(f"Total item obat terdaftar: {total_obat:,}")
            parts.append(f"Total biaya pemakaian bulan ini: Rp {int(agg['total_pemakaian']['value']):,}")
            parts.append(f"Harga satuan rata-rata: Rp {int(agg['avg_harga']['value']):,}")
            parts.append(f"Obat dengan stok rendah (≤50): {agg['stok_rendah']['doc_count']:,} item")
            parts.append("Rincian biaya per kategori obat:")
            for b in sorted(agg["per_kategori"]["buckets"], key=lambda x: x["biaya"]["value"], reverse=True):
                parts.append(f"  - {b['key']}: Rp {int(b['biaya']['value']):,} ({b['doc_count']} item)")
            parts.append("Rincian biaya per supplier:")
            for b in sorted(agg["per_supplier"]["buckets"], key=lambda x: x["biaya"]["value"], reverse=True):
                parts.append(f"  - {b['key']}: Rp {int(b['biaya']['value']):,}")
        except Exception as e:
            print(f"Obat agg err: {e}")

    # ── 2. ALAT MEDIS ─────────────────────────────────────────────────────────
    if "cost_alat_medis" in relevant or any(k in q for k in ["alat","peralatan","depresiasi"]):
        try:
            r = client.search(index="cost_alat_medis", body={
                "size": 0,
                "aggs": {
                    "total_depresiasi": {"sum": {"field": "biaya_depresiasi_tahunan"}},
                    "total_servis":     {"sum": {"field": "biaya_servis_tahunan"}},
                    "total_operasional":{"sum": {"field": "biaya_operasional_bulan"}},
                    "per_jenis": {"terms": {"field": "jenis_alat", "size": 10},
                                  "aggs": {
                                      "depresiasi": {"sum": {"field": "biaya_depresiasi_tahunan"}},
                                      "nilai_beli":  {"sum": {"field": "harga_beli"}},
                                  }},
                    "per_kondisi": {"terms": {"field": "kondisi", "size": 5},
                                    "aggs": {"servis_cost": {"sum": {"field": "biaya_servis_tahunan"}}}},
                    "per_vendor": {"terms": {"field": "vendor", "size": 5},
                                   "aggs": {"nilai": {"sum": {"field": "harga_beli"}}}},
                }
            })
            agg = r["aggregations"]
            total_alat = client.count(index="cost_alat_medis")["count"]
            parts.append(f"\n=== BIAYA ALAT MEDIS ===")
            parts.append(f"Total item alat medis: {total_alat:,}")
            parts.append(f"Total biaya depresiasi tahunan: Rp {int(agg['total_depresiasi']['value']):,}")
            parts.append(f"Total biaya servis tahunan: Rp {int(agg['total_servis']['value']):,}")
            parts.append(f"Total biaya operasional/bulan: Rp {int(agg['total_operasional']['value']):,}")
            parts.append("Rincian per jenis alat:")
            for b in sorted(agg["per_jenis"]["buckets"], key=lambda x: x["depresiasi"]["value"], reverse=True):
                parts.append(f"  - {b['key']}: depresiasi Rp {int(b['depresiasi']['value']):,}/th | nilai Rp {int(b['nilai_beli']['value']):,}")
            parts.append("Kondisi alat & biaya servis:")
            for b in agg["per_kondisi"]["buckets"]:
                parts.append(f"  - {b['key']}: {b['doc_count']} unit | servis Rp {int(b['servis_cost']['value']):,}")
            parts.append("Rincian per vendor:")
            for b in sorted(agg["per_vendor"]["buckets"], key=lambda x: x["nilai"]["value"], reverse=True):
                parts.append(f"  - {b['key']}: nilai aset Rp {int(b['nilai']['value']):,}")
        except Exception as e:
            print(f"Alat agg err: {e}")

    # ── 3. LAB ────────────────────────────────────────────────────────────────
    if "cost_lab" in relevant or any(k in q for k in ["lab","laboratorium","reagen","reagent"]):
        try:
            r = client.search(index="cost_lab", body={
                "size": 0,
                "aggs": {
                    "total_pendapatan": {"sum": {"field": "total_pendapatan_bulan"}},
                    "total_reagent":    {"sum": {"field": "total_biaya_reagent_bulan"}},
                    "total_volume":     {"sum": {"field": "volume_pemeriksaan_bulan"}},
                    "per_jenis": {"terms": {"field": "jenis_pemeriksaan", "size": 10},
                                  "aggs": {
                                      "pendapatan": {"sum": {"field": "total_pendapatan_bulan"}},
                                      "reagent":    {"sum": {"field": "total_biaya_reagent_bulan"}},
                                      "volume":     {"sum": {"field": "volume_pemeriksaan_bulan"}},
                                  }},
                    "avg_tarif": {"avg": {"field": "tarif_pemeriksaan"}},
                }
            })
            agg = r["aggregations"]
            total_test = client.count(index="cost_lab")["count"]
            total_pend = int(agg["total_pendapatan"]["value"])
            total_reag = int(agg["total_reagent"]["value"])
            margin = total_pend - total_reag
            parts.append(f"\n=== BIAYA LABORATORIUM ===")
            parts.append(f"Total jenis pemeriksaan: {total_test:,}")
            parts.append(f"Total volume pemeriksaan bulan ini: {int(agg['total_volume']['value']):,} tes")
            parts.append(f"Total pendapatan lab bulan ini: Rp {total_pend:,}")
            parts.append(f"Total biaya reagent bulan ini: Rp {total_reag:,}")
            parts.append(f"Margin kotor lab: Rp {margin:,}")
            parts.append(f"Tarif pemeriksaan rata-rata: Rp {int(agg['avg_tarif']['value']):,}")
            parts.append("Rincian per jenis pemeriksaan:")
            for b in sorted(agg["per_jenis"]["buckets"], key=lambda x: x["pendapatan"]["value"], reverse=True):
                pend = int(b["pendapatan"]["value"])
                reag = int(b["reagent"]["value"])
                parts.append(
                    f"  - {b['key']}: pendapatan Rp {pend:,} | reagent Rp {reag:,} | "
                    f"volume {int(b['volume']['value']):,}"
                )
        except Exception as e:
            print(f"Lab agg err: {e}")

    # ── 4. SDM ────────────────────────────────────────────────────────────────
    if "cost_sdm" in relevant or any(k in q for k in ["sdm","karyawan","gaji","kompensasi"]):
        try:
            r = client.search(index="cost_sdm", body={
                "size": 0,
                "aggs": {
                    "total_kompensasi": {"sum": {"field": "total_kompensasi_bulanan"}},
                    "total_lembur":     {"sum": {"field": "biaya_lembur"}},
                    "total_bpjs_kes":   {"sum": {"field": "bpjs_kesehatan"}},
                    "total_bpjs_tk":    {"sum": {"field": "bpjs_ketenagakerjaan"}},
                    "per_jabatan": {"terms": {"field": "jabatan", "size": 15},
                                   "aggs": {
                                       "kompensasi": {"sum": {"field": "total_kompensasi_bulanan"}},
                                       "avg_gaji":   {"avg": {"field": "gaji_pokok"}},
                                   }},
                    "per_status": {"terms": {"field": "status_karyawan", "size": 5},
                                   "aggs": {"kompensasi": {"sum": {"field": "total_kompensasi_bulanan"}}}},
                    "per_dept": {"terms": {"field": "dept_id", "size": 10},
                                 "aggs": {"kompensasi": {"sum": {"field": "total_kompensasi_bulanan"}}}},
                }
            })
            agg = r["aggregations"]
            total_sdm = client.count(index="cost_sdm")["count"]
            total_komp = int(agg["total_kompensasi"]["value"])
            parts.append(f"\n=== BIAYA SDM & TENAGA KERJA ===")
            parts.append(f"Total karyawan: {total_sdm:,}")
            parts.append(f"Total biaya kompensasi/bulan: Rp {total_komp:,}")
            parts.append(f"Total biaya lembur/bulan: Rp {int(agg['total_lembur']['value']):,}")
            parts.append(f"Total BPJS Kesehatan: Rp {int(agg['total_bpjs_kes']['value']):,}")
            parts.append(f"Total BPJS Ketenagakerjaan: Rp {int(agg['total_bpjs_tk']['value']):,}")
            parts.append("Rincian biaya per jabatan:")
            for b in sorted(agg["per_jabatan"]["buckets"], key=lambda x: x["kompensasi"]["value"], reverse=True):
                parts.append(
                    f"  - {b['key']} ({b['doc_count']} orang): "
                    f"total Rp {int(b['kompensasi']['value']):,} | avg gaji Rp {int(b['avg_gaji']['value']):,}"
                )
            parts.append("Rincian per status karyawan:")
            for b in agg["per_status"]["buckets"]:
                parts.append(f"  - {b['key']}: {b['doc_count']} orang | Rp {int(b['kompensasi']['value']):,}")
        except Exception as e:
            print(f"SDM agg err: {e}")

    # ── 5. UTILITAS ───────────────────────────────────────────────────────────
    if "cost_utilitas" in relevant or any(k in q for k in ["utilitas","listrik","air","gas","limbah","overhead"]):
        try:
            r = client.search(index="cost_utilitas", body={
                "size": 0,
                "aggs": {
                    "total_biaya":   {"sum": {"field": "total_biaya"}},
                    "per_jenis": {"terms": {"field": "jenis_utilitas", "size": 10},
                                  "aggs": {"biaya": {"sum": {"field": "total_biaya"}}}},
                    "per_dept": {"terms": {"field": "dept_id", "size": 10},
                                 "aggs": {"biaya": {"sum": {"field": "total_biaya"}}}},
                    "pending": {"filter": {"term": {"status_pembayaran": "Pending"}}},
                }
            })
            agg = r["aggregations"]
            total_util = client.count(index="cost_utilitas")["count"]
            parts.append(f"\n=== BIAYA UTILITAS & OVERHEAD ===")
            parts.append(f"Total record utilitas: {total_util:,}")
            parts.append(f"Total biaya utilitas keseluruhan: Rp {int(agg['total_biaya']['value']):,}")
            parts.append(f"Tagihan utilitas pending: {agg['pending']['doc_count']:,} transaksi")
            parts.append("Rincian biaya per jenis utilitas:")
            for b in sorted(agg["per_jenis"]["buckets"], key=lambda x: x["biaya"]["value"], reverse=True):
                parts.append(f"  - {b['key']}: Rp {int(b['biaya']['value']):,}")
        except Exception as e:
            print(f"Utilitas agg err: {e}")

    # ── 6. MONTHLY COST TREND ─────────────────────────────────────────────────
    if "cost_monthly" in relevant or any(k in q for k in ["bulanan","tren","anggaran","realisasi","per bulan"]):
        try:
            r = client.search(index="cost_monthly", body={
                "size": 0,
                "aggs": {
                    "total_obat_all":    {"sum": {"field": "biaya_obat"}},
                    "total_alat_all":    {"sum": {"field": "biaya_alat_medis"}},
                    "total_lab_all":     {"sum": {"field": "biaya_lab"}},
                    "total_sdm_all":     {"sum": {"field": "biaya_sdm"}},
                    "total_utilitas_all":{"sum": {"field": "biaya_utilitas"}},
                    "grand_total":       {"sum": {"field": "total_biaya_operasional"}},
                    "per_tahun": {
                        "terms": {"field": "tahun", "size": 5},
                        "aggs": {
                            "total": {"sum": {"field": "total_biaya_operasional"}},
                            "obat":  {"sum": {"field": "biaya_obat"}},
                            "sdm":   {"sum": {"field": "biaya_sdm"}},
                        }
                    },
                }
            })
            agg = r["aggregations"]
            grand = int(agg["grand_total"]["value"])
            parts.append(f"\n=== RINGKASAN BIAYA OPERASIONAL KESELURUHAN ===")
            parts.append(f"GRAND TOTAL biaya operasional: Rp {grand:,}")
            obat_t = int(agg["total_obat_all"]["value"])
            alat_t = int(agg["total_alat_all"]["value"])
            lab_t  = int(agg["total_lab_all"]["value"])
            sdm_t  = int(agg["total_sdm_all"]["value"])
            util_t = int(agg["total_utilitas_all"]["value"])
            parts.append("Komposisi biaya:")
            parts.append(f"  - Biaya Obat:       Rp {obat_t:,} ({obat_t/grand*100:.1f}%)")
            parts.append(f"  - Biaya Alat Medis: Rp {alat_t:,} ({alat_t/grand*100:.1f}%)")
            parts.append(f"  - Biaya Lab:        Rp {lab_t:,} ({lab_t/grand*100:.1f}%)")
            parts.append(f"  - Biaya SDM:        Rp {sdm_t:,} ({sdm_t/grand*100:.1f}%)")
            parts.append(f"  - Biaya Utilitas:   Rp {util_t:,} ({util_t/grand*100:.1f}%)")
            parts.append("Rincian per tahun:")
            for b in sorted(agg["per_tahun"]["buckets"], key=lambda x: x["key"]):
                parts.append(
                    f"  - {b['key']}: total Rp {int(b['total']['value']):,} | "
                    f"obat Rp {int(b['obat']['value']):,} | SDM Rp {int(b['sdm']['value']):,}"
                )
        except Exception as e:
            print(f"Monthly agg err: {e}")

    return "\n".join(parts) if parts else ""


# ── Search OpenSearch ──────────────────────────────────────────────────────────
def search_opensearch(question: str, size: int = 8) -> list:
    client = get_os_client()
    results = []
    relevant = get_relevant_indices(question)

    for index in relevant:
        try:
            resp = client.search(
                index=index,
                body={
                    "query": {"multi_match": {
                        "query": question,
                        "fields": ["*"],
                        "type": "best_fields",
                    }},
                    "size": size,
                },
            )
            hits = resp["hits"]["hits"]
            if not hits:
                resp = client.search(index=index, body={"query": {"match_all": {}}, "size": size})
                hits = resp["hits"]["hits"]
            for hit in hits:
                results.append({
                    "index": index,
                    "score": hit.get("_score") or 1.0,
                    "data":  hit["_source"],
                })
        except Exception as e:
            print(f"Search error {index}: {e}")
            continue

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:size]


# ── Build context ──────────────────────────────────────────────────────────────
def build_context(question: str, results: list) -> str:
    parts = []

    agg = build_agg_context(question)
    if agg:
        # Potong aggregation jika terlalu panjang (max ~2000 karakter)
        if len(agg) > 2000:
            agg = agg[:2000] + "\n...(dipotong untuk efisiensi)"
        parts.append("=== STATISTIK BIAYA DARI OPENSEARCH ===")
        parts.append(agg)
        parts.append("")

    if results:
        parts.append("=== SAMPLE DOKUMEN TERKAIT ===")
        for r in results[:3]:
            idx = r["index"].replace("cost_", "").upper()
            # Hanya tampilkan field kunci, bukan seluruh dokumen
            d = r["data"]
            keys = ["nama_obat","nama_alat","nama_pemeriksaan","jabatan","jenis_utilitas","nama_departemen","periode","total_biaya_operasional","biaya_pemakaian_bulan","biaya_depresiasi_tahunan","total_kompensasi_bulanan","total_biaya","gaji_pokok"]
            slim = {k: d[k] for k in keys if k in d}
            parts.append(f"[{idx}] {json.dumps(slim, ensure_ascii=False)}")

    return "\n".join(parts) if parts else "Tidak ada data relevan ditemukan."


# ── Ask Groq ───────────────────────────────────────────────────────────────────
def ask_groq(question: str, context: str) -> str:
    system = """Kamu adalah analis biaya operasional untuk Rumah Sakit Sehat Selalu.
Tugasmu adalah menjawab pertanyaan tentang biaya operasional rumah sakit berdasarkan data dari database.

KATEGORI BIAYA YANG TERSEDIA:
- Biaya Obat & Farmasi: pengadaan, pemakaian, stok obat
- Biaya Alat Medis: depresiasi, servis, operasional peralatan
- Biaya Laboratorium: reagent, pemeriksaan, pendapatan lab
- Biaya SDM: gaji, tunjangan, insentif, BPJS, lembur
- Biaya Utilitas: listrik, air, gas medis, limbah, gedung

PENTING — ANALISIS BIAYA:
- Bagian "STATISTIK BIAYA" berisi angka AKURAT dari seluruh database. Gunakan untuk angka total/perbandingan.
- Jika ada perbandingan antar kategori, tunjukkan persentasenya.
- Jika ada tren, jelaskan kenaikan/penurunan biaya.
- Berikan insight dan rekomendasi pengendalian biaya jika relevan.

PENTING — MATEMATIKA:
- Selalu tunjukkan perhitungan jika menjumlahkan beberapa kategori.
- Persentase dihitung dari total keseluruhan biaya operasional.
- Jangan mencampur kategori yang berbeda tanpa penjelasan.

ATURAN FORMAT:
- Gunakan teks biasa tanpa markdown
- Gunakan tanda hubung (-) untuk daftar
- Jangan gunakan simbol **, *, #, >, ---, atau backtick
- Pisahkan bagian dengan baris kosong saja
- Tulis angka dengan format: 1.000 (ribuan) atau Rp 1.234.567 (uang)
- Jika data tidak cukup, katakan dengan jelas
- Selalu akhiri dengan catatan singkat tentang implikasi biaya jika relevan"""

    chat = get_groq_client().chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        max_tokens=800,
        temperature=0.1,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",
             "content": "Data dari OpenSearch:\n" + context + "\n\nPertanyaan: " + question},
        ],
    )
    return strip_markdown(chat.choices[0].message.content)


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "Hospital Cost Analytics API", "version": "2.0.0"}

@app.get("/health")
def health():
    try:
        info = get_os_client().info()
        return {"status": "healthy", "opensearch": info["version"]["number"]}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}

@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Pertanyaan tidak boleh kosong.")
    try:
        results = search_opensearch(req.question, size=req.max_results)
        context = build_context(req.question, results)
        answer  = ask_groq(req.question, context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    sources = []
    seen = set()
    for r in results[:5]:
        name = r["index"].replace("cost_", "")
        if name not in seen:
            seen.add(name)
            sources.append({"index": name, "score": round(r["score"], 3)})

    return AskResponse(answer=answer, sources=sources)

@app.get("/stats")
def stats():
    data = {}
    for index in INDICES:
        try:
            data[index.replace("cost_", "")] = get_os_client().count(index=index)["count"]
        except Exception:
            data[index.replace("cost_", "")] = 0
    return {"indices": data}

@app.get("/cost-summary")
def cost_summary():
    """
    Endpoint untuk dashboard: ringkasan biaya per kategori + tren bulanan.
    Dipakai oleh frontend untuk chart & KPI cards.
    """
    client = get_os_client()
    result = {
        "by_category": {},
        "by_department": [],
        "trend_monthly": [],
        "top_obat": [],
        "top_alat": [],
        "top_sdm_jabatan": [],
        "utilitas_breakdown": [],
    }

    # ── Per kategori
    try:
        r = client.search(index="cost_monthly", body={
            "size": 0,
            "aggs": {
                "obat":      {"sum": {"field": "biaya_obat"}},
                "alat":      {"sum": {"field": "biaya_alat_medis"}},
                "lab":       {"sum": {"field": "biaya_lab"}},
                "sdm":       {"sum": {"field": "biaya_sdm"}},
                "utilitas":  {"sum": {"field": "biaya_utilitas"}},
                "total":     {"sum": {"field": "total_biaya_operasional"}},
            }
        })
        agg = r["aggregations"]
        total = agg["total"]["value"]
        result["by_category"] = {
            "total":    int(total),
            "obat":     {"value": int(agg["obat"]["value"]),     "pct": round(agg["obat"]["value"]/total*100, 1)     if total else 0},
            "alat":     {"value": int(agg["alat"]["value"]),     "pct": round(agg["alat"]["value"]/total*100, 1)     if total else 0},
            "lab":      {"value": int(agg["lab"]["value"]),      "pct": round(agg["lab"]["value"]/total*100, 1)      if total else 0},
            "sdm":      {"value": int(agg["sdm"]["value"]),      "pct": round(agg["sdm"]["value"]/total*100, 1)      if total else 0},
            "utilitas": {"value": int(agg["utilitas"]["value"]), "pct": round(agg["utilitas"]["value"]/total*100, 1) if total else 0},
        }
    except Exception as e:
        print(f"Cost summary cat err: {e}")

    # ── Per departemen
    try:
        r = client.search(index="cost_monthly", body={
            "size": 0,
            "aggs": {
                "per_dept": {
                    "terms": {"field": "dept_id", "size": 10},
                    "aggs": {
                        "nama":  {"terms": {"field": "nama_departemen", "size": 1}},
                        "total": {"sum": {"field": "total_biaya_operasional"}},
                        "obat":  {"sum": {"field": "biaya_obat"}},
                        "sdm":   {"sum": {"field": "biaya_sdm"}},
                    }
                }
            }
        })
        for b in r["aggregations"]["per_dept"]["buckets"]:
            dept_name = b["nama"]["buckets"][0]["key"] if b["nama"]["buckets"] else f"Dept {b['key']}"
            result["by_department"].append({
                "dept_id":   b["key"],
                "nama":      dept_name,
                "total":     int(b["total"]["value"]),
                "obat":      int(b["obat"]["value"]),
                "sdm":       int(b["sdm"]["value"]),
            })
        result["by_department"].sort(key=lambda x: x["total"], reverse=True)
    except Exception as e:
        print(f"Cost summary dept err: {e}")

    # ── Tren bulanan (ambil per periode)
    try:
        r = client.search(index="cost_monthly", body={
            "size": 0,
            "aggs": {
                "per_periode": {
                    "terms": {"field": "periode", "size": 24,
                              "order": {"_key": "asc"}},
                    "aggs": {
                        "total":    {"sum": {"field": "total_biaya_operasional"}},
                        "obat":     {"sum": {"field": "biaya_obat"}},
                        "alat":     {"sum": {"field": "biaya_alat_medis"}},
                        "lab":      {"sum": {"field": "biaya_lab"}},
                        "sdm":      {"sum": {"field": "biaya_sdm"}},
                        "utilitas": {"sum": {"field": "biaya_utilitas"}},
                        "anggaran": {"sum": {"field": "anggaran_bulan"}},
                    }
                }
            }
        })
        for b in r["aggregations"]["per_periode"]["buckets"]:
            result["trend_monthly"].append({
                "periode":   b["key"],
                "total":     int(b["total"]["value"]),
                "obat":      int(b["obat"]["value"]),
                "alat":      int(b["alat"]["value"]),
                "lab":       int(b["lab"]["value"]),
                "sdm":       int(b["sdm"]["value"]),
                "utilitas":  int(b["utilitas"]["value"]),
                "anggaran":  int(b["anggaran"]["value"]),
            })
    except Exception as e:
        print(f"Cost trend err: {e}")

    # ── Top 5 obat terpemakai
    try:
        r = client.search(index="cost_obat", body={
            "size": 5,
            "sort": [{"biaya_pemakaian_bulan": {"order": "desc"}}],
            "_source": ["nama_obat", "kategori_obat", "biaya_pemakaian_bulan", "stok_tersedia"],
        })
        result["top_obat"] = [h["_source"] for h in r["hits"]["hits"]]
    except Exception as e:
        print(f"Top obat err: {e}")

    # ── Top 5 alat biaya tertinggi
    try:
        r = client.search(index="cost_alat_medis", body={
            "size": 5,
            "sort": [{"biaya_depresiasi_tahunan": {"order": "desc"}}],
            "_source": ["nama_alat", "jenis_alat", "biaya_depresiasi_tahunan", "kondisi"],
        })
        result["top_alat"] = [h["_source"] for h in r["hits"]["hits"]]
    except Exception as e:
        print(f"Top alat err: {e}")

    # ── SDM per jabatan
    try:
        r = client.search(index="cost_sdm", body={
            "size": 0,
            "aggs": {
                "per_jabatan": {
                    "terms": {"field": "jabatan", "size": 12},
                    "aggs": {
                        "total": {"sum": {"field": "total_kompensasi_bulanan"}},
                        "count": {"value_count": {"field": "sdm_id"}},
                    }
                }
            }
        })
        for b in sorted(r["aggregations"]["per_jabatan"]["buckets"],
                        key=lambda x: x["total"]["value"], reverse=True):
            result["top_sdm_jabatan"].append({
                "jabatan": b["key"],
                "count":   b["doc_count"],
                "total":   int(b["total"]["value"]),
            })
    except Exception as e:
        print(f"SDM jabatan err: {e}")

    # ── Utilitas breakdown
    try:
        r = client.search(index="cost_utilitas", body={
            "size": 0,
            "aggs": {
                "per_jenis": {
                    "terms": {"field": "jenis_utilitas", "size": 10},
                    "aggs": {"biaya": {"sum": {"field": "total_biaya"}}}
                }
            }
        })
        for b in sorted(r["aggregations"]["per_jenis"]["buckets"],
                        key=lambda x: x["biaya"]["value"], reverse=True):
            result["utilitas_breakdown"].append({
                "jenis": b["key"],
                "total": int(b["biaya"]["value"]),
            })
    except Exception as e:
        print(f"Utilitas breakdown err: {e}")

    return result

@app.get("/debug")
def debug():
    result = {}
    client = get_os_client()
    counts = {}
    for index in INDICES:
        try:
            r = client.search(index=index, body={"query": {"match_all": {}}, "size": 1})
            counts[index] = r["hits"]["total"]["value"]
        except Exception as e:
            counts[index] = f"ERROR: {e}"
    result["indices"] = counts
    try:
        get_groq_client().chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            max_tokens=5,
            messages=[{"role": "user", "content": "hi"}],
        )
        result["groq"] = "ok"
    except Exception as e:
        result["groq"] = str(e)
    return result
