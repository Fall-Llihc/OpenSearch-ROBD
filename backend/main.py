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

# ── OpenSearch ─────────────────────────────────────────────────────────────────
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
        hosts=[{
            "host": os.getenv("OPENSEARCH_HOST", "localhost"),
            "port": int(os.getenv("OPENSEARCH_PORT", "9200")),
        }],
        http_auth=(
            os.getenv("OPENSEARCH_USER", "admin"),
            os.getenv("OPENSEARCH_PASS", "admin"),
        ),
        use_ssl=use_ssl,
        verify_certs=False,
        ssl_show_warn=False,
    )

# ── Groq ───────────────────────────────────────────────────────────────────────
def get_groq_client():
    return Groq(api_key=os.getenv("GROQ_API_KEY", ""))

# ── Index names ────────────────────────────────────────────────────────────────
INDICES = [
    "hospital_patients",
    "hospital_doctors",
    "hospital_departments",
    "hospital_teams",
    "hospital_services",
    "hospital_bills",
    "hospital_payments",
    "hospital_tim_dokter",
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

# ── Search OpenSearch ──────────────────────────────────────────────────────────
def search_opensearch(query: str, size: int = 8) -> list:
    results = []
    for index in INDICES:
        try:
            resp = get_os_client().search(
                index=index,
                body={
                    "query": {
                        "multi_match": {
                            "query": query,
                            "fields": ["*"],
                            "fuzziness": "AUTO",
                            "type": "best_fields",
                        }
                    },
                    "size": size,
                },
            )
            for hit in resp["hits"]["hits"]:
                results.append({
                    "index": index,
                    "score": hit["_score"],
                    "data": hit["_source"],
                })
        except Exception as e:
            print(f"Search error on {index}: {e}")
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:size * 2]

# ── Build context ──────────────────────────────────────────────────────────────
def build_context(results: list) -> str:
    if not results:
        return "Tidak ada data relevan ditemukan."
    parts = []
    for r in results:
        idx = r["index"].replace("hospital_", "").upper()
        parts.append(f"[{idx}]\n{json.dumps(r['data'], ensure_ascii=False)}")
    return "\n\n".join(parts)

# ── Ask Groq ───────────────────────────────────────────────────────────────────
def ask_groq(question: str, context: str) -> str:
    system = """Kamu adalah asisten QA untuk Rumah Sakit Sehat Selalu.
Jawab pertanyaan berdasarkan data yang diberikan dari database rumah sakit.
Gunakan Bahasa Indonesia yang jelas dan profesional.

ATURAN FORMAT:
- Gunakan teks biasa tanpa markdown
- Gunakan tanda hubung (-) untuk daftar, bukan asterisk atau bintang
- Jangan gunakan simbol **, *, #, >, ---, atau backtick
- Jangan gunakan format bold, italic, heading, atau blockquote
- Pisahkan bagian dengan baris kosong saja
- Tulis angka mata uang dengan format: Rp 1.234.567
- Jika data tidak cukup, katakan dengan jelas tanpa mengarang"""

    chat = get_groq_client().chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        max_tokens=1024,
        temperature=0.3,
        messages=[
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": "Data dari OpenSearch:\n" + context + "\n\nPertanyaan: " + question,
            },
        ],
    )
    raw = chat.choices[0].message.content
    return strip_markdown(raw)

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
        results = search_opensearch(req.question, size=req.max_results)
        context = build_context(results)
        answer = ask_groq(req.question, context)
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
            count = get_os_client().count(index=index)["count"]
            data[index.replace("hospital_", "")] = count
        except Exception:
            data[index.replace("hospital_", "")] = 0
    return {"indices": data}

@app.get("/debug")
def debug():
    result = {}
    result["groq_key_set"] = bool(os.getenv("GROQ_API_KEY", ""))
    result["groq_model"] = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    result["opensearch_url_set"] = bool(os.getenv("OPENSEARCH_URL", ""))
    result["opensearch_host"] = os.getenv("OPENSEARCH_HOST", "not set")

    # Test search langsung
    try:
        resp = get_os_client().search(
            index="hospital_departments",
            body={"query": {"match_all": {}}, "size": 3},
        )
        hits = [h["_source"] for h in resp["hits"]["hits"]]
        result["opensearch_search"] = "ok"
        result["opensearch_sample"] = hits
    except Exception as e:
        result["opensearch_search"] = "error"
        result["opensearch_error"] = str(e)

    # Test Groq
    try:
        chat = get_groq_client().chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            max_tokens=10,
            messages=[{"role": "user", "content": "hi"}],
        )
        result["groq_status"] = "ok"
        result["groq_response"] = chat.choices[0].message.content
    except Exception as e:
        result["groq_status"] = "error"
        result["groq_error"] = str(e)

    return result