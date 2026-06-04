import os
import re
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from opensearchpy import OpenSearch
from groq import Groq

app = FastAPI(title="Hospital QA API", version="1.0.0")

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
    "hospital_patients", "hospital_doctors", "hospital_departments",
    "hospital_teams", "hospital_services", "hospital_bills",
    "hospital_payments", "hospital_tim_dokter",
]

# ── Models ─────────────────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str
    max_results: Optional[int] = 8

class AskResponse(BaseModel):
    answer: str
    sources: list

# ── Strip markdown ─────────────────────────────────────────────────────────────
def strip_markdown(text: str) -> str:
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"_{1,3}(.+?)_{1,3}", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)
    text = re.sub(r"^[\*\+]\s+", "- ", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# ── Intent detection ───────────────────────────────────────────────────────────
def detect_intent(question: str) -> str:
    """
    Deteksi jenis pertanyaan:
    - 'count'    : berapa jumlah / total / keseluruhan
    - 'sum'      : total nilai / jumlah uang
    - 'group'    : per kategori / breakdown
    - 'list'     : tampilkan daftar / apa saja
    - 'general'  : lainnya
    """
    q = question.lower()
    if any(k in q for k in ["berapa jumlah","berapa banyak","total pasien","total dokter",
                              "keseluruhan","semua pasien","semua dokter","berapa orang",
                              "berapa total","jumlah keseluruhan"]):
        return "count"
    if any(k in q for k in ["total tagihan","total pembayaran","total biaya","jumlah tagihan",
                              "total nilai","berapa total tagihan","berapa total pembayaran"]):
        return "sum"
    if any(k in q for k in ["per tipe","per jenis","per spesialisasi","breakdown",
                              "berapa bpjs","berapa umum","berapa asuransi"]):
        return "group"
    if any(k in q for k in ["apa saja","daftar","tampilkan","sebutkan","list"]):
        return "list"
    return "general"

# ── Keyword routing ────────────────────────────────────────────────────────────
def get_relevant_indices(question: str) -> list:
    q = question.lower()
    mapping = {
        "hospital_doctors":     ["dokter","spesialis","neurologi","kardiologi","ortopedi",
                                  "pediatri","radiologi","bedah","penyakit dalam","mata","tht","gigi"],
        "hospital_departments": ["departemen","dept","bagian","divisi","poli"],
        "hospital_patients":    ["pasien","bpjs","umum","asuransi","rekam medis"],
        "hospital_services":    ["layanan","service","rawat","operasi","laboratorium",
                                  "tarif","biaya layanan","jenis layanan"],
        "hospital_bills":       ["tagihan","bill","biaya","lunas","belum lunas","diproses"],
        "hospital_payments":    ["pembayaran","bayar","metode","tunai","transfer","kredit","qris"],
        "hospital_teams":       ["tim","team","kelompok"],
        "hospital_tim_dokter":  ["tim dokter","penugasan dokter"],
    }
    selected = []
    for index, keywords in mapping.items():
        if any(kw in q for kw in keywords):
            selected.append(index)
    return selected if selected else INDICES

# ── Aggregation context — untuk pertanyaan counting/sum/group ──────────────────
def build_agg_context(question: str) -> str:
    """
    Untuk pertanyaan agregasi, ambil statistik nyata dari OpenSearch
    (count, sum, terms aggregation) dan jadikan konteks faktual.
    """
    client = get_os_client()
    q = question.lower()
    parts = []

    try:
        # ── Total count per index yang relevan ─────────────────────────────────
        relevant = get_relevant_indices(question)
        for index in relevant:
            try:
                total = client.count(index=index)["count"]
                name = index.replace("hospital_", "")
                parts.append(f"Total dokumen di index {name}: {total:,}")
            except Exception:
                pass

        # ── Pasien: count per tipe_pasien ──────────────────────────────────────
        if "hospital_patients" in relevant or "pasien" in q or "bpjs" in q:
            try:
                r = client.search(index="hospital_patients", body={
                    "size": 0,
                    "aggs": {
                        "per_tipe": {
                            "terms": {"field": "tipe_pasien", "size": 10}
                        }
                    }
                })
                buckets = r["aggregations"]["per_tipe"]["buckets"]
                parts.append("Rincian pasien per tipe:")
                for b in buckets:
                    parts.append(f"  - {b['key']}: {b['doc_count']:,} pasien")
            except Exception:
                pass

        # ── Dokter: count per spesialisasi ─────────────────────────────────────
        if "hospital_doctors" in relevant or "dokter" in q or "spesialis" in q:
            try:
                r = client.search(index="hospital_doctors", body={
                    "size": 0,
                    "aggs": {
                        "per_spesialisasi": {
                            "terms": {"field": "spesialisasi", "size": 20}
                        }
                    }
                })
                buckets = r["aggregations"]["per_spesialisasi"]["buckets"]
                parts.append("Rincian dokter per spesialisasi:")
                for b in buckets:
                    parts.append(f"  - {b['key']}: {b['doc_count']:,} dokter")
            except Exception:
                pass

        # ── Tagihan: count per status + total nilai ────────────────────────────
        if "hospital_bills" in relevant or "tagihan" in q or "lunas" in q:
            try:
                r = client.search(index="hospital_bills", body={
                    "size": 0,
                    "aggs": {
                        "per_status": {
                            "terms": {"field": "status_tagihan", "size": 10}
                        },
                        "total_biaya": {
                            "sum": {"field": "total_biaya"}
                        },
                        "per_status_dengan_nilai": {
                            "terms": {"field": "status_tagihan", "size": 10},
                            "aggs": {
                                "nilai": {"sum": {"field": "total_biaya"}}
                            }
                        }
                    }
                })
                total_biaya = r["aggregations"]["total_biaya"]["value"]
                parts.append(f"Total nilai semua tagihan: Rp {total_biaya:,.0f}")
                parts.append("Rincian tagihan per status:")
                for b in r["aggregations"]["per_status_dengan_nilai"]["buckets"]:
                    parts.append(f"  - {b['key']}: {b['doc_count']:,} tagihan, total Rp {b['nilai']['value']:,.0f}")
            except Exception:
                pass

        # ── Pembayaran: count per metode + total nilai ─────────────────────────
        if "hospital_payments" in relevant or "pembayaran" in q or "bayar" in q:
            try:
                r = client.search(index="hospital_payments", body={
                    "size": 0,
                    "aggs": {
                        "per_metode": {
                            "terms": {"field": "metode_pembayaran", "size": 10}
                        },
                        "per_status": {
                            "terms": {"field": "status_pembayaran", "size": 10}
                        },
                        "total_bayar": {
                            "sum": {"field": "jumlah_bayar"}
                        }
                    }
                })
                total_bayar = r["aggregations"]["total_bayar"]["value"]
                parts.append(f"Total nilai semua pembayaran: Rp {total_bayar:,.0f}")
                parts.append("Rincian pembayaran per metode:")
                for b in r["aggregations"]["per_metode"]["buckets"]:
                    parts.append(f"  - {b['key']}: {b['doc_count']:,} transaksi")
                parts.append("Rincian pembayaran per status:")
                for b in r["aggregations"]["per_status"]["buckets"]:
                    parts.append(f"  - {b['key']}: {b['doc_count']:,} transaksi")
            except Exception:
                pass

        # ── Layanan: count per jenis ───────────────────────────────────────────
        if "hospital_services" in relevant or "layanan" in q or "rawat" in q:
            try:
                r = client.search(index="hospital_services", body={
                    "size": 0,
                    "aggs": {
                        "per_jenis": {
                            "terms": {"field": "jenis_layanan", "size": 10}
                        },
                        "tarif_max": {"max": {"field": "tarif_dasar"}},
                        "tarif_min": {"min": {"field": "tarif_dasar"}},
                        "tarif_avg": {"avg": {"field": "tarif_dasar"}},
                    }
                })
                agg = r["aggregations"]
                parts.append(f"Tarif layanan: min Rp {agg['tarif_min']['value']:,.0f}, "
                              f"max Rp {agg['tarif_max']['value']:,.0f}, "
                              f"rata-rata Rp {agg['tarif_avg']['value']:,.0f}")
                parts.append("Rincian layanan per jenis:")
                for b in agg["per_jenis"]["buckets"]:
                    parts.append(f"  - {b['key']}: {b['doc_count']:,} layanan")
            except Exception:
                pass

        # ── Departemen: list semua ─────────────────────────────────────────────
        if "hospital_departments" in relevant or "departemen" in q:
            try:
                r = client.search(index="hospital_departments", body={
                    "query": {"match_all": {}},
                    "size": 50,
                    "_source": ["nama_departemen"]
                })
                depts = [h["_source"]["nama_departemen"] for h in r["hits"]["hits"]]
                parts.append(f"Daftar departemen ({len(depts)} total):")
                for d in depts:
                    parts.append(f"  - {d}")
            except Exception:
                pass

    except Exception as e:
        print(f"Agg context error: {e}")

    return "\n".join(parts) if parts else ""

# ── Search OpenSearch — sample dokumen ────────────────────────────────────────
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
                resp = client.search(index=index,
                                     body={"query": {"match_all": {}}, "size": size})
                hits = resp["hits"]["hits"]

            for hit in hits:
                results.append({
                    "index": index,
                    "score": hit.get("_score") or 1.0,
                    "data": hit["_source"],
                })
        except Exception as e:
            print(f"Search error {index}: {e}")
            continue

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:size * 3]

# ── Build context ──────────────────────────────────────────────────────────────
def build_context(question: str, results: list) -> str:
    parts = []

    # Selalu tambahkan aggregation context (angka nyata dari OpenSearch)
    agg = build_agg_context(question)
    if agg:
        parts.append("=== STATISTIK NYATA DARI OPENSEARCH ===")
        parts.append(agg)
        parts.append("")

    # Tambahkan sample dokumen sebagai konteks tambahan
    if results:
        parts.append("=== SAMPLE DOKUMEN ===")
        for r in results[:12]:
            idx = r["index"].replace("hospital_", "").upper()
            parts.append(f"[{idx}] {json.dumps(r['data'], ensure_ascii=False)}")

    return "\n".join(parts) if parts else "Tidak ada data relevan ditemukan."

# ── Ask Groq ───────────────────────────────────────────────────────────────────
def ask_groq(question: str, context: str) -> str:
    system = """Kamu adalah asisten QA untuk Rumah Sakit Sehat Selalu.
Jawab pertanyaan berdasarkan data yang diberikan dari database rumah sakit.
Gunakan Bahasa Indonesia yang jelas dan profesional.

PENTING:
- Bagian "STATISTIK NYATA DARI OPENSEARCH" berisi angka yang AKURAT dari seluruh database.
- Gunakan angka dari statistik tersebut untuk menjawab pertanyaan tentang total/jumlah/count.
- Jangan menghitung sendiri dari sample dokumen untuk pertanyaan agregasi.

ATURAN FORMAT:
- Gunakan teks biasa tanpa markdown
- Gunakan tanda hubung (-) untuk daftar
- Jangan gunakan simbol **, *, #, >, ---, atau backtick
- Pisahkan bagian dengan baris kosong saja
- Tulis angka dengan format: 1.000 (ribuan) atau Rp 1.234.567 (uang)
- Jika data tidak cukup, katakan dengan jelas"""

    chat = get_groq_client().chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        max_tokens=1024,
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
    return {"status": "ok", "service": "Hospital QA API"}

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
        results   = search_opensearch(req.question, size=req.max_results)
        context   = build_context(req.question, results)
        answer    = ask_groq(req.question, context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    sources = []
    seen = set()
    for r in results[:5]:
        name = r["index"].replace("hospital_", "")
        if name not in seen:
            seen.add(name)
            sources.append({"index": name, "score": round(r["score"], 3)})

    return AskResponse(answer=answer, sources=sources)

@app.get("/stats")
def stats():
    data = {}
    for index in INDICES:
        try:
            data[index.replace("hospital_", "")] = get_os_client().count(index=index)["count"]
        except Exception:
            data[index.replace("hospital_", "")] = 0
    return {"indices": data}

@app.get("/debug")
def debug():
    result = {}
    client = get_os_client()
    counts = {}
    for index in INDICES:
        try:
            r = client.search(index=index, body={"query":{"match_all":{}},"size":1})
            counts[index] = r["hits"]["total"]["value"]
        except Exception as e:
            counts[index] = f"ERROR: {e}"
    result["indices"] = counts
    # Test agg
    try:
        r = client.search(index="hospital_patients", body={
            "size": 0,
            "aggs": {"per_tipe": {"terms": {"field": "tipe_pasien", "size": 5}}}
        })
        result["agg_test"] = r["aggregations"]["per_tipe"]["buckets"]
    except Exception as e:
        result["agg_test"] = f"ERROR: {e}"
    try:
        get_groq_client().chat.completions.create(
            model=os.getenv("GROQ_MODEL","llama-3.1-8b-instant"),
            max_tokens=5,
            messages=[{"role":"user","content":"hi"}],
        )
        result["groq"] = "ok"
    except Exception as e:
        result["groq"] = str(e)
    return result
