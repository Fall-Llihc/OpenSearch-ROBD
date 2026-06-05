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

# ── Aggregation context — semua jenis pertanyaan yang mungkin ─────────────────
def build_agg_context(question: str) -> str:
    """
    Ambil statistik akurat dari OpenSearch untuk semua jenis pertanyaan:
    count, sum, min, max, avg, top_hits, terms, date_histogram, dll.
    """
    client = get_os_client()
    q = question.lower()
    parts = []
    relevant = get_relevant_indices(question)

    try:
        # ── 1. PASIEN ──────────────────────────────────────────────────────────
        if "hospital_patients" in relevant or any(k in q for k in
                ["pasien","bpjs","umum","asuransi","jumlah pasien","total pasien"]):
            try:
                r = client.search(index="hospital_patients", body={
                    "size": 0,
                    "aggs": {
                        "total": {"value_count": {"field": "patient_id"}},
                        "per_tipe": {"terms": {"field": "tipe_pasien", "size": 10}},
                    }
                })
                agg = r["aggregations"]
                total_p = client.count(index="hospital_patients")["count"]
                parts.append(f"Total pasien keseluruhan: {total_p:,}")
                parts.append("Rincian pasien per tipe:")
                for b in agg["per_tipe"]["buckets"]:
                    parts.append(f"  - {b['key']}: {b['doc_count']:,} pasien")
            except Exception as e:
                print(f"Pasien agg err: {e}")

        # ── 2. DOKTER ──────────────────────────────────────────────────────────
        if "hospital_doctors" in relevant or any(k in q for k in
                ["dokter","spesialis","dokter spesialis","jumlah dokter","total dokter"]):
            try:
                total_d = client.count(index="hospital_doctors")["count"]
                r = client.search(index="hospital_doctors", body={
                    "size": 0,
                    "aggs": {
                        "per_spesialisasi": {
                            "terms": {"field": "spesialisasi", "size": 20},
                            "aggs": {
                                "per_dept": {"terms": {"field": "dept_id", "size": 5}}
                            }
                        }
                    }
                })
                parts.append(f"Total dokter keseluruhan: {total_d:,}")
                parts.append("Rincian dokter per spesialisasi:")
                for b in r["aggregations"]["per_spesialisasi"]["buckets"]:
                    parts.append(f"  - {b['key']}: {b['doc_count']:,} dokter")
            except Exception as e:
                print(f"Dokter agg err: {e}")

        # ── 3. DEPARTEMEN ──────────────────────────────────────────────────────
        if "hospital_departments" in relevant or any(k in q for k in
                ["departemen","dept","bagian","poli","jumlah departemen"]):
            try:
                r = client.search(index="hospital_departments", body={
                    "query": {"match_all": {}},
                    "size": 100,
                    "sort": [{"dept_id": {"order": "asc"}}],
                    "_source": ["dept_id","nama_departemen"]
                })
                depts = [h["_source"] for h in r["hits"]["hits"]]
                total_dept = client.count(index="hospital_departments")["count"]
                parts.append(f"Total departemen: {total_dept:,}")
                parts.append("Daftar departemen:")
                seen_dept = set()
                for d in depts:
                    name = d["nama_departemen"]
                    if name not in seen_dept:
                        seen_dept.add(name)
                        parts.append(f"  - {name} (ID: {d['dept_id']})")
            except Exception as e:
                print(f"Dept agg err: {e}")

        # ── 4. TAGIHAN — lengkap dengan min/max/top per status ─────────────────
        if "hospital_bills" in relevant or any(k in q for k in
                ["tagihan","lunas","belum lunas","diproses","biaya","bill",
                 "terbesar","terkecil","tertinggi","terendah","paling besar",
                 "paling kecil","paling mahal","paling murah","rata-rata tagihan"]):
            try:
                r = client.search(index="hospital_bills", body={
                    "size": 0,
                    "aggs": {
                        "total_nilai":  {"sum": {"field": "total_biaya"}},
                        "max_semua":    {"max": {"field": "total_biaya"}},
                        "min_semua":    {"min": {"field": "total_biaya"}},
                        "avg_semua":    {"avg": {"field": "total_biaya"}},
                        "tagihan_terbesar_ever": {
                            "top_hits": {
                                "size": 1,
                                "sort": [{"total_biaya": {"order": "desc"}}],
                                "_source": ["bill_id","patient_id","total_biaya","status_tagihan","tanggal_tagihan"]
                            }
                        },
                        "tagihan_terkecil_ever": {
                            "top_hits": {
                                "size": 1,
                                "sort": [{"total_biaya": {"order": "asc"}}],
                                "_source": ["bill_id","patient_id","total_biaya","status_tagihan","tanggal_tagihan"]
                            }
                        },
                        "per_status": {
                            "terms": {"field": "status_tagihan", "size": 10},
                            "aggs": {
                                "total":   {"sum": {"field": "total_biaya"}},
                                "maximum": {"max": {"field": "total_biaya"}},
                                "minimum": {"min": {"field": "total_biaya"}},
                                "rata2":   {"avg": {"field": "total_biaya"}},
                                "top3_terbesar": {
                                    "top_hits": {
                                        "size": 3,
                                        "sort": [{"total_biaya": {"order": "desc"}}],
                                        "_source": ["bill_id","patient_id","total_biaya","tanggal_tagihan"]
                                    }
                                },
                                "top3_terkecil": {
                                    "top_hits": {
                                        "size": 3,
                                        "sort": [{"total_biaya": {"order": "asc"}}],
                                        "_source": ["bill_id","patient_id","total_biaya","tanggal_tagihan"]
                                    }
                                }
                            }
                        },
                        "per_bulan": {
                            "date_histogram": {
                                "field": "tanggal_tagihan",
                                "calendar_interval": "month",
                                "format": "yyyy-MM"
                            },
                            "aggs": {"total_bulan": {"sum": {"field": "total_biaya"}}}
                        }
                    }
                })
                agg = r["aggregations"]
                total_t = client.count(index="hospital_bills")["count"]

                parts.append(f"Statistik tagihan (total {total_t:,} tagihan):")
                parts.append(f"  Total nilai keseluruhan : Rp {agg['total_nilai']['value']:,.0f}")
                parts.append(f"  Tagihan terbesar (ever) : Rp {agg['max_semua']['value']:,.0f}")
                parts.append(f"  Tagihan terkecil (ever) : Rp {agg['min_semua']['value']:,.0f}")
                parts.append(f"  Rata-rata tagihan       : Rp {agg['avg_semua']['value']:,.0f}")

                # Tagihan terbesar & terkecil absolut
                tb = agg["tagihan_terbesar_ever"]["hits"]["hits"]
                tk = agg["tagihan_terkecil_ever"]["hits"]["hits"]
                if tb:
                    s = tb[0]["_source"]
                    parts.append(f"  Tagihan terbesar: Bill #{s['bill_id']} Pasien #{s['patient_id']} "
                                  f"Rp {s['total_biaya']:,} ({s['status_tagihan']}) tgl {s.get('tanggal_tagihan','')}")
                if tk:
                    s = tk[0]["_source"]
                    parts.append(f"  Tagihan terkecil: Bill #{s['bill_id']} Pasien #{s['patient_id']} "
                                  f"Rp {s['total_biaya']:,} ({s['status_tagihan']}) tgl {s.get('tanggal_tagihan','')}")

                parts.append("")
                parts.append("Rincian per status tagihan:")
                for b in agg["per_status"]["buckets"]:
                    status = b["key"]
                    parts.append(f"  [{status}] {b['doc_count']:,} tagihan")
                    parts.append(f"    Total nilai : Rp {b['total']['value']:,.0f}")
                    parts.append(f"    Terbesar    : Rp {b['maximum']['value']:,.0f}")
                    parts.append(f"    Terkecil    : Rp {b['minimum']['value']:,.0f}")
                    parts.append(f"    Rata-rata   : Rp {b['rata2']['value']:,.0f}")
                    # 3 terbesar per status
                    hits_b = b["top3_terbesar"]["hits"]["hits"]
                    if hits_b:
                        parts.append(f"    3 terbesar:")
                        for h in hits_b:
                            s = h["_source"]
                            parts.append(f"      Bill #{s['bill_id']} | Pasien #{s['patient_id']} | "
                                          f"Rp {s['total_biaya']:,} | {s.get('tanggal_tagihan','')}")
                    # 3 terkecil per status
                    hits_k = b["top3_terkecil"]["hits"]["hits"]
                    if hits_k:
                        parts.append(f"    3 terkecil:")
                        for h in hits_k:
                            s = h["_source"]
                            parts.append(f"      Bill #{s['bill_id']} | Pasien #{s['patient_id']} | "
                                          f"Rp {s['total_biaya']:,} | {s.get('tanggal_tagihan','')}")

                # Tren bulanan
                monthly = [b for b in agg["per_bulan"]["buckets"] if b["doc_count"] > 0]
                if monthly and any(k in q for k in ["bulan","tren","per bulan","bulanan"]):
                    parts.append("")
                    parts.append("Tagihan per bulan:")
                    for m in monthly[-6:]:
                        parts.append(f"  {m['key_as_string']}: {m['doc_count']:,} tagihan, "
                                      f"Rp {m['total_bulan']['value']:,.0f}")

            except Exception as e:
                print(f"Bills agg err: {e}")

        # ── 5. PEMBAYARAN — lengkap ────────────────────────────────────────────
        if "hospital_payments" in relevant or any(k in q for k in
                ["pembayaran","bayar","metode bayar","transfer","tunai","qris",
                 "kartu kredit","bpjs bayar","berhasil","gagal","pending"]):
            try:
                r = client.search(index="hospital_payments", body={
                    "size": 0,
                    "aggs": {
                        "total_bayar":  {"sum": {"field": "jumlah_bayar"}},
                        "max_bayar":    {"max": {"field": "jumlah_bayar"}},
                        "min_bayar":    {"min": {"field": "jumlah_bayar"}},
                        "avg_bayar":    {"avg": {"field": "jumlah_bayar"}},
                        "per_metode": {
                            "terms": {"field": "metode_pembayaran", "size": 10},
                            "aggs": {
                                "total_m": {"sum": {"field": "jumlah_bayar"}},
                                "avg_m":   {"avg": {"field": "jumlah_bayar"}},
                            }
                        },
                        "per_status": {
                            "terms": {"field": "status_pembayaran", "size": 10},
                            "aggs": {
                                "total_s": {"sum": {"field": "jumlah_bayar"}},
                            }
                        },
                        "per_metode_status": {
                            "terms": {"field": "metode_pembayaran", "size": 10},
                            "aggs": {
                                "per_status_nested": {
                                    "terms": {"field": "status_pembayaran", "size": 5}
                                }
                            }
                        }
                    }
                })
                agg = r["aggregations"]
                total_pay = client.count(index="hospital_payments")["count"]
                parts.append(f"Statistik pembayaran (total {total_pay:,} transaksi):")
                parts.append(f"  Total nilai keseluruhan: Rp {agg['total_bayar']['value']:,.0f}")
                parts.append(f"  Pembayaran terbesar    : Rp {agg['max_bayar']['value']:,.0f}")
                parts.append(f"  Pembayaran terkecil    : Rp {agg['min_bayar']['value']:,.0f}")
                parts.append(f"  Rata-rata pembayaran   : Rp {agg['avg_bayar']['value']:,.0f}")
                parts.append("  Rincian per metode pembayaran:")
                for b in agg["per_metode"]["buckets"]:
                    parts.append(f"    - {b['key']}: {b['doc_count']:,} transaksi | "
                                  f"Total Rp {b['total_m']['value']:,.0f} | "
                                  f"Avg Rp {b['avg_m']['value']:,.0f}")
                parts.append("  Rincian per status pembayaran:")
                for b in agg["per_status"]["buckets"]:
                    parts.append(f"    - {b['key']}: {b['doc_count']:,} transaksi | "
                                  f"Total Rp {b['total_s']['value']:,.0f}")
                # Breakdown metode x status
                if any(k in q for k in ["berhasil","gagal","pending","sukses"]):
                    parts.append("  Breakdown metode x status:")
                    for b in agg["per_metode_status"]["buckets"]:
                        for s in b["per_status_nested"]["buckets"]:
                            parts.append(f"    {b['key']} - {s['key']}: {s['doc_count']:,}")
            except Exception as e:
                print(f"Payments agg err: {e}")

        # ── 6. LAYANAN — lengkap ───────────────────────────────────────────────
        if "hospital_services" in relevant or any(k in q for k in
                ["layanan","rawat inap","rawat jalan","operasi","laboratorium","radiologi",
                 "tarif","harga","biaya layanan","termahal","termurah","terjangkau"]):
            try:
                r = client.search(index="hospital_services", body={
                    "size": 0,
                    "aggs": {
                        "total_layanan": {"value_count": {"field": "service_id"}},
                        "tarif_max":  {"max": {"field": "tarif_dasar"}},
                        "tarif_min":  {"min": {"field": "tarif_dasar"}},
                        "tarif_avg":  {"avg": {"field": "tarif_dasar"}},
                        "tarif_sum":  {"sum": {"field": "tarif_dasar"}},
                        "per_jenis": {
                            "terms": {"field": "jenis_layanan", "size": 10},
                            "aggs": {
                                "max_j": {"max": {"field": "tarif_dasar"}},
                                "min_j": {"min": {"field": "tarif_dasar"}},
                                "avg_j": {"avg": {"field": "tarif_dasar"}},
                                "layanan_termahal": {
                                    "top_hits": {
                                        "size": 3,
                                        "sort": [{"tarif_dasar": {"order": "desc"}}],
                                        "_source": ["service_id","nama_layanan","jenis_layanan","tarif_dasar"]
                                    }
                                },
                                "layanan_termurah": {
                                    "top_hits": {
                                        "size": 3,
                                        "sort": [{"tarif_dasar": {"order": "asc"}}],
                                        "_source": ["service_id","nama_layanan","jenis_layanan","tarif_dasar"]
                                    }
                                }
                            }
                        },
                        "layanan_termahal_ever": {
                            "top_hits": {
                                "size": 3,
                                "sort": [{"tarif_dasar": {"order": "desc"}}],
                                "_source": ["service_id","nama_layanan","jenis_layanan","tarif_dasar"]
                            }
                        },
                        "layanan_termurah_ever": {
                            "top_hits": {
                                "size": 3,
                                "sort": [{"tarif_dasar": {"order": "asc"}}],
                                "_source": ["service_id","nama_layanan","jenis_layanan","tarif_dasar"]
                            }
                        }
                    }
                })
                agg = r["aggregations"]
                total_svc = client.count(index="hospital_services")["count"]
                parts.append(f"Statistik layanan (total {total_svc:,} layanan):")
                parts.append(f"  Tarif tertinggi: Rp {agg['tarif_max']['value']:,.0f}")
                parts.append(f"  Tarif terendah : Rp {agg['tarif_min']['value']:,.0f}")
                parts.append(f"  Rata-rata tarif: Rp {agg['tarif_avg']['value']:,.0f}")

                # Layanan termahal & termurah absolut
                tmahal = agg["layanan_termahal_ever"]["hits"]["hits"]
                tmurah = agg["layanan_termurah_ever"]["hits"]["hits"]
                if tmahal:
                    parts.append("  3 layanan termahal:")
                    for h in tmahal:
                        s = h["_source"]
                        parts.append(f"    - {s['nama_layanan']} ({s['jenis_layanan']}): Rp {s['tarif_dasar']:,}")
                if tmurah:
                    parts.append("  3 layanan termurah:")
                    for h in tmurah:
                        s = h["_source"]
                        parts.append(f"    - {s['nama_layanan']} ({s['jenis_layanan']}): Rp {s['tarif_dasar']:,}")

                parts.append("  Rincian per jenis layanan:")
                for b in agg["per_jenis"]["buckets"]:
                    parts.append(f"    [{b['key']}] {b['doc_count']:,} layanan | "
                                  f"Tarif: min Rp {b['min_j']['value']:,.0f} | "
                                  f"max Rp {b['max_j']['value']:,.0f} | "
                                  f"avg Rp {b['avg_j']['value']:,.0f}")
                    for h in b["layanan_termahal"]["hits"]["hits"][:1]:
                        s = h["_source"]
                        parts.append(f"      Termahal: {s['nama_layanan']} Rp {s['tarif_dasar']:,}")
                    for h in b["layanan_termurah"]["hits"]["hits"][:1]:
                        s = h["_source"]
                        parts.append(f"      Termurah: {s['nama_layanan']} Rp {s['tarif_dasar']:,}")
            except Exception as e:
                print(f"Services agg err: {e}")

        # ── 7. TIM & TIM DOKTER ────────────────────────────────────────────────
        if "hospital_teams" in relevant or any(k in q for k in
                ["tim","team","jumlah tim","berapa tim"]):
            try:
                total_tim = client.count(index="hospital_teams")["count"]
                parts.append(f"Total tim medis: {total_tim:,}")
            except Exception as e:
                print(f"Teams agg err: {e}")

        # ── 8. RINGKASAN UMUM — jika pertanyaan tentang keseluruhan rumah sakit ─
        if any(k in q for k in ["ringkasan","overview","gambaran","keseluruhan","semua data",
                                  "total keseluruhan","statistik rumah sakit"]):
            try:
                parts.append("=== RINGKASAN RUMAH SAKIT SEHAT SELALU ===")
                for index in INDICES:
                    count = client.count(index=index)["count"]
                    name = index.replace("hospital_", "")
                    parts.append(f"  {name}: {count:,} dokumen")
            except Exception as e:
                print(f"Summary agg err: {e}")

    except Exception as e:
        print(f"Agg context error (outer): {e}")

    return "\n".join(parts) if parts else ""

# ── Join Engine — resolve relasi antar collection di OpenSearch ────────────────
def build_join_context(question: str) -> str:
    """
    Untuk pertanyaan relasional (dokter-pasien, pasien-tagihan, dll),
    lakukan join manual antar index OpenSearch.

    Relasi data:
    doctors ──(doctor_id)──> tim_dokter ──(team_id)──> teams
                                                          │
                                                       (team_id)
                                                          ▼
    services <──(service_id)── bills <──(patient_id)── patients
                                  │
                               (bill_id)
                                  ▼
                              payments
    """
    client = get_os_client()
    q = question.lower()
    parts = []

    # ── Deteksi pola: pasien siapa yang ditangani dokter X ─────────────────────
    doc_patient_patterns = [
        "pasien.*dokter", "dokter.*pasien", "ditangani dokter",
        "pasien dari dokter", "pasien dokter", "dokter menangani"
    ]
    import re as _re
    is_doc_patient = any(_re.search(p, q) for p in doc_patient_patterns)

    if is_doc_patient or ("dokter" in q and "pasien" in q):
        try:
            # Cari dokter yang disebutkan di pertanyaan
            resp = client.search(index="hospital_doctors", body={
                "query": {"multi_match": {"query": question, "fields": ["nama_dokter", "spesialisasi"]}},
                "size": 5,
            })
            matched_doctors = [h["_source"] for h in resp["hits"]["hits"]]

            if not matched_doctors:
                # Fallback: cari berdasarkan ID jika ada angka di pertanyaan
                numbers = _re.findall(r'\b(\d+)\b', question)
                if numbers:
                    for num in numbers[:3]:
                        r2 = client.search(index="hospital_doctors", body={
                            "query": {"term": {"doctor_id": int(num)}}, "size": 1
                        })
                        matched_doctors += [h["_source"] for h in r2["hits"]["hits"]]

            for doctor in matched_doctors[:3]:
                doc_id = doctor["doctor_id"]
                doc_name = doctor["nama_dokter"]
                spec = doctor["spesialisasi"]

                # Step 1: doctor_id → team_id via tim_dokter
                tim_resp = client.search(index="hospital_tim_dokter", body={
                    "query": {"term": {"doctor_id": doc_id}}, "size": 50
                })
                team_ids = [h["_source"]["team_id"] for h in tim_resp["hits"]["hits"]]

                if not team_ids:
                    parts.append(f"Dokter {doc_name} (ID:{doc_id}) belum ditugaskan ke tim manapun.")
                    continue

                # Step 2: team_id → patients
                patient_resp = client.search(index="hospital_patients", body={
                    "query": {"terms": {"team_id": team_ids}}, "size": 100
                })
                patients_data = [h["_source"] for h in patient_resp["hits"]["hits"]]

                parts.append(f"Dokter: {doc_name} (ID:{doc_id}) | {spec}")
                parts.append(f"Tim yang ditangani: {team_ids}")
                parts.append(f"Jumlah pasien: {len(patients_data)}")

                if patients_data:
                    parts.append("Daftar pasien:")
                    for p in patients_data:
                        # Step 3: patient_id → bills
                        bill_resp = client.search(index="hospital_bills", body={
                            "query": {"term": {"patient_id": p["patient_id"]}}, "size": 10
                        })
                        bills_data = [h["_source"] for h in bill_resp["hits"]["hits"]]
                        bill_info = ""
                        if bills_data:
                            b = bills_data[0]
                            bill_info = f" | Tagihan: Rp {b['total_biaya']:,} ({b['status_tagihan']})"
                        parts.append(
                            f"  - {p['nama_pasien']} (ID:{p['patient_id']}) | "
                            f"Tipe: {p['tipe_pasien']}{bill_info}"
                        )
        except Exception as e:
            print(f"Join doctor-patient error: {e}")

    # ── Deteksi pola: tagihan / riwayat pasien X ───────────────────────────────
    patient_bill_patterns = ["tagihan.*pasien", "pasien.*tagihan", "riwayat pasien",
                              "bayaran pasien", "biaya pasien"]
    is_patient_bill = any(_re.search(p, q) for p in patient_bill_patterns)

    if is_patient_bill or ("pasien" in q and ("tagihan" in q or "biaya" in q or "bayar" in q)):
        try:
            resp = client.search(index="hospital_patients", body={
                "query": {"multi_match": {"query": question, "fields": ["nama_pasien", "tipe_pasien"]}},
                "size": 5,
            })
            matched_patients = [h["_source"] for h in resp["hits"]["hits"]]

            # Coba cari berdasarkan ID juga
            numbers = _re.findall(r'\b(\d+)\b', question)
            if numbers and not matched_patients:
                for num in numbers[:2]:
                    r2 = client.search(index="hospital_patients", body={
                        "query": {"term": {"patient_id": int(num)}}, "size": 1
                    })
                    matched_patients += [h["_source"] for h in r2["hits"]["hits"]]

            for patient in matched_patients[:3]:
                pid = patient["patient_id"]
                # bills
                bill_resp = client.search(index="hospital_bills", body={
                    "query": {"term": {"patient_id": pid}}, "size": 20
                })
                bills_data = [h["_source"] for h in bill_resp["hits"]["hits"]]

                parts.append(f"Pasien: {patient['nama_pasien']} (ID:{pid}) | Tipe: {patient['tipe_pasien']}")
                parts.append(f"Jumlah tagihan: {len(bills_data)}")
                for b in bills_data:
                    # payments for this bill
                    pay_resp = client.search(index="hospital_payments", body={
                        "query": {"term": {"bill_id": b["bill_id"]}}, "size": 5
                    })
                    pays = [h["_source"] for h in pay_resp["hits"]["hits"]]
                    pay_info = ""
                    if pays:
                        pay_info = f" | Bayar: Rp {pays[0]['jumlah_bayar']:,} ({pays[0]['metode_pembayaran']}, {pays[0]['status_pembayaran']})"
                    parts.append(
                        f"  - Bill #{b['bill_id']}: Rp {b['total_biaya']:,} "
                        f"({b['status_tagihan']}) tgl {b.get('tanggal_tagihan','?')}{pay_info}"
                    )
        except Exception as e:
            print(f"Join patient-bill error: {e}")

    # ── Deteksi pola: detail bill tertentu (bill #N / bill N) ─────────────────
    import re as _re2
    bill_id_patterns = [
        r'\bbill\s*#?\s*(\d+)\b',
        r'\btagihan\s*#?\s*(\d+)\b',
        r'\btagihan\s+ke[- ]?(\d+)\b',
        r'\bfaktur\s*#?\s*(\d+)\b',
    ]
    bill_ids_mentioned = []
    for pat in bill_id_patterns:
        bill_ids_mentioned += [int(m) for m in _re2.findall(pat, q)]
    bill_ids_mentioned = list(set(bill_ids_mentioned))

    if bill_ids_mentioned:
        try:
            for bid in bill_ids_mentioned[:3]:
                # Step 1: ambil bill exact by bill_id
                b_resp = client.search(index="hospital_bills", body={
                    "query": {"term": {"bill_id": bid}}, "size": 1
                })
                if not b_resp["hits"]["hits"]:
                    parts.append(f"Bill #{bid}: tidak ditemukan.")
                    continue
                bill = b_resp["hits"]["hits"][0]["_source"]

                # Step 2: join ke service
                svc = None
                if "service_id" in bill:
                    s_resp = client.search(index="hospital_services", body={
                        "query": {"term": {"service_id": bill["service_id"]}}, "size": 1
                    })
                    if s_resp["hits"]["hits"]:
                        svc = s_resp["hits"]["hits"][0]["_source"]

                # Step 3: join ke patient
                pat = None
                if "patient_id" in bill:
                    p_resp = client.search(index="hospital_patients", body={
                        "query": {"term": {"patient_id": bill["patient_id"]}}, "size": 1
                    })
                    if p_resp["hits"]["hits"]:
                        pat = p_resp["hits"]["hits"][0]["_source"]

                # Step 4: join ke payment
                pay_resp = client.search(index="hospital_payments", body={
                    "query": {"term": {"bill_id": bid}}, "size": 5
                })
                pays = [h["_source"] for h in pay_resp["hits"]["hits"]]

                # Rangkum
                parts.append(f"=== Detail Bill #{bid} ===")
                parts.append(f"  Total biaya    : Rp {bill['total_biaya']:,}")
                parts.append(f"  Status tagihan : {bill['status_tagihan']}")
                parts.append(f"  Tanggal tagihan: {bill.get('tanggal_tagihan', '-')}")
                if pat:
                    parts.append(f"  Pasien         : {pat['nama_pasien']} (ID:{pat['patient_id']}) | Tipe: {pat['tipe_pasien']}")
                if svc:
                    parts.append(f"  Layanan        : {svc['nama_layanan']} | Jenis: {svc['jenis_layanan']} | Tarif dasar: Rp {svc['tarif_dasar']:,}")
                if pays:
                    parts.append(f"  Pembayaran ({len(pays)} transaksi):")
                    for p in pays:
                        parts.append(f"    - Rp {p['jumlah_bayar']:,} via {p['metode_pembayaran']} | Status: {p['status_pembayaran']} | Tgl: {p.get('tanggal_pembayaran','-')}")
                else:
                    parts.append(f"  Pembayaran     : Belum ada data pembayaran")
        except Exception as e:
            print(f"Join bill detail error: {e}")

    # ── Deteksi pola: dokter di departemen X ──────────────────────────────────
    if "departemen" in q and "dokter" in q:
        try:
            dept_resp = client.search(index="hospital_departments", body={
                "query": {"multi_match": {"query": question, "fields": ["nama_departemen"]}},
                "size": 3,
            })
            for dept in [h["_source"] for h in dept_resp["hits"]["hits"]][:2]:
                doc_resp = client.search(index="hospital_doctors", body={
                    "query": {"term": {"dept_id": dept["dept_id"]}}, "size": 20
                })
                docs = [h["_source"] for h in doc_resp["hits"]["hits"]]
                parts.append(f"Departemen: {dept['nama_departemen']} (ID:{dept['dept_id']})")
                parts.append(f"Jumlah dokter: {len(docs)}")
                for d in docs[:10]:
                    parts.append(f"  - {d['nama_dokter']} | {d['spesialisasi']}")
        except Exception as e:
            print(f"Join dept-doctor error: {e}")

    # ── Deteksi pola: layanan / service tertentu ───────────────────────────────
    service_id_patterns = [r'\blayanan\s*#?\s*(\d+)\b', r'\bservice\s*#?\s*(\d+)\b']
    svc_ids = []
    for pat in service_id_patterns:
        svc_ids += [int(m) for m in _re2.findall(pat, q)]
    svc_ids = list(set(svc_ids))

    if svc_ids:
        try:
            for sid in svc_ids[:3]:
                s_resp = client.search(index="hospital_services", body={
                    "query": {"term": {"service_id": sid}}, "size": 1
                })
                if s_resp["hits"]["hits"]:
                    svc = s_resp["hits"]["hits"][0]["_source"]
                    parts.append(f"=== Detail Layanan #{sid} ===")
                    parts.append(f"  Nama    : {svc['nama_layanan']}")
                    parts.append(f"  Jenis   : {svc['jenis_layanan']}")
                    parts.append(f"  Tarif   : Rp {svc['tarif_dasar']:,}")
        except Exception as e:
            print(f"Join service detail error: {e}")

    # ── Deteksi pola: pasien tertentu by ID ───────────────────────────────────
    patient_id_patterns = [r'\bpasien\s*#?\s*(\d+)\b', r'\bpatient\s*#?\s*(\d+)\b']
    pat_ids = []
    for pat in patient_id_patterns:
        pat_ids += [int(m) for m in _re2.findall(pat, q)]
    pat_ids = list(set(pat_ids))

    if pat_ids:
        try:
            for pid in pat_ids[:3]:
                p_resp = client.search(index="hospital_patients", body={
                    "query": {"term": {"patient_id": pid}}, "size": 1
                })
                if not p_resp["hits"]["hits"]:
                    continue
                patient = p_resp["hits"]["hits"][0]["_source"]

                # Tagihan pasien ini
                b_resp = client.search(index="hospital_bills", body={
                    "query": {"term": {"patient_id": pid}}, "size": 20
                })
                bills_data = [h["_source"] for h in b_resp["hits"]["hits"]]

                parts.append(f"=== Detail Pasien #{pid} ===")
                parts.append(f"  Nama      : {patient['nama_pasien']}")
                parts.append(f"  Tipe      : {patient['tipe_pasien']}")
                parts.append(f"  Team ID   : {patient['team_id']}")
                parts.append(f"  Tagihan ({len(bills_data)} total):")
                for b in bills_data:
                    # join service
                    svc_r = client.search(index="hospital_services", body={
                        "query": {"term": {"service_id": b["service_id"]}}, "size": 1
                    })
                    svc_name = svc_r["hits"]["hits"][0]["_source"]["nama_layanan"] if svc_r["hits"]["hits"] else "?"
                    jenis    = svc_r["hits"]["hits"][0]["_source"]["jenis_layanan"] if svc_r["hits"]["hits"] else "?"
                    parts.append(
                        f"    Bill #{b['bill_id']}: Rp {b['total_biaya']:,} "
                        f"({b['status_tagihan']}) | {svc_name} ({jenis}) | {b.get('tanggal_tagihan','-')}"
                    )
        except Exception as e:
            print(f"Join patient detail error: {e}")

    # ── Deteksi pola: dokter tertentu by ID ───────────────────────────────────
    doctor_id_patterns = [r'\bdokter\s*#?\s*(\d+)\b', r'\bdr\.?\s*(\d+)\b']
    doc_ids = []
    for pat in doctor_id_patterns:
        doc_ids += [int(m) for m in _re2.findall(pat, q)]
    doc_ids = list(set(doc_ids))

    if doc_ids and "pasien" not in q:  # kalau ada pasien, sudah dihandle di atas
        try:
            for did in doc_ids[:3]:
                d_resp = client.search(index="hospital_doctors", body={
                    "query": {"term": {"doctor_id": did}}, "size": 1
                })
                if not d_resp["hits"]["hits"]:
                    continue
                doc = d_resp["hits"]["hits"][0]["_source"]
                # dept
                dept_r = client.search(index="hospital_departments", body={
                    "query": {"term": {"dept_id": doc["dept_id"]}}, "size": 1
                })
                dept_name = dept_r["hits"]["hits"][0]["_source"]["nama_departemen"] if dept_r["hits"]["hits"] else "?"

                parts.append(f"=== Detail Dokter #{did} ===")
                parts.append(f"  Nama         : {doc['nama_dokter']}")
                parts.append(f"  Spesialisasi : {doc['spesialisasi']}")
                parts.append(f"  Departemen   : {dept_name} (ID:{doc['dept_id']})")
        except Exception as e:
            print(f"Join doctor detail error: {e}")

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

    # 1. Join context — untuk pertanyaan relasional antar collection
    join = build_join_context(question)
    if join:
        parts.append("=== DATA RELASI (JOIN ANTAR COLLECTION) ===")
        parts.append(join)
        parts.append("")

    # 2. Aggregation context — untuk pertanyaan count/sum/group
    agg = build_agg_context(question)
    if agg:
        parts.append("=== STATISTIK NYATA DARI OPENSEARCH ===")
        parts.append(agg)
        parts.append("")

    # 3. Sample dokumen sebagai konteks tambahan
    if results:
        parts.append("=== SAMPLE DOKUMEN ===")
        for r in results[:10]:
            idx = r["index"].replace("hospital_", "").upper()
            parts.append(f"[{idx}] {json.dumps(r['data'], ensure_ascii=False)}")

    return "\n".join(parts) if parts else "Tidak ada data relevan ditemukan."

# ── Ask Groq ───────────────────────────────────────────────────────────────────
def ask_groq(question: str, context: str) -> str:
    system = """Kamu adalah asisten QA untuk Rumah Sakit Sehat Selalu.
Jawab pertanyaan berdasarkan data yang diberikan dari database rumah sakit.
Gunakan Bahasa Indonesia yang jelas dan profesional.

PENTING — DATA:
- Bagian "DATA RELASI" berisi hasil JOIN antar collection. Gunakan untuk pertanyaan relasi dokter-pasien, detail bill, dll.
- Bagian "STATISTIK NYATA DARI OPENSEARCH" berisi angka AKURAT dari seluruh database. Gunakan untuk pertanyaan total/jumlah/count.
- Jangan menghitung dari sample dokumen untuk pertanyaan agregasi — gunakan angka dari statistik.

PENTING — MATEMATIKA:
- Jika user tanya "total lunas DAN belum lunas", jumlahkan HANYA dua kategori tersebut, BUKAN total keseluruhan.
- "Total keseluruhan" = semua status (Lunas + Belum Lunas + Diproses + dll).
- "Total lunas" = hanya status Lunas.
- "Total belum lunas" = hanya status Belum Lunas.
- Selalu tunjukkan perhitungan jika menjumlahkan beberapa kategori. Contoh: "Rp X + Rp Y = Rp Z".
- Jangan campurkan kategori yang tidak ditanyakan ke dalam hasil jumlah.

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
