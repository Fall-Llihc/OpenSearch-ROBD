import os
import re
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from opensearchpy import OpenSearch
import anthropic

app = FastAPI(title="Hospital QA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── OpenSearch ─────────────────────────────────────────────────────────────────
OPENSEARCH_HOST = os.getenv("OPENSEARCH_HOST", "localhost")
OPENSEARCH_PORT = int(os.getenv("OPENSEARCH_PORT", "9200"))
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER", "admin")
OPENSEARCH_PASS = os.getenv("OPENSEARCH_PASS", "admin")

os_client = OpenSearch(
    hosts=[{"host": OPENSEARCH_HOST, "port": OPENSEARCH_PORT}],
    http_auth=(OPENSEARCH_USER, OPENSEARCH_PASS),
    use_ssl=False,
    verify_certs=False,
    ssl_show_warn=False,
)

# ── Anthropic ──────────────────────────────────────────────────────────────────
anthropic_client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY", "")
)

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
    """
    Remove markdown syntax from Claude's response so it renders as
    clean plain text in the frontend without asterisks, hashes, etc.
    """
    # Remove bold/italic: **text** -> text, *text* -> text, __text__ -> text
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"_{1,3}(.+?)_{1,3}", r"\1", text, flags=re.DOTALL)
    # Remove headings: ## Heading -> Heading
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove blockquotes: > text -> text
    text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)
    # Remove horizontal rules
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    # Remove inline code: `code` -> code
    text = re.sub(r"`(.+?)`", r"\1", text)
    # Remove markdown links: [text](url) -> text
    text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)
    # Bullet points: keep but use simple dash
    text = re.sub(r"^[\*\+]\s+", "- ", text, flags=re.MULTILINE)
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Search OpenSearch ──────────────────────────────────────────────────────────
def search_opensearch(query: str, size: int = 8) -> list:
    results = []
    for index in INDICES:
        try:
            resp = os_client.search(
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
                results.append(
                    {
                        "index": index,
                        "score": hit["_score"],
                        "data": hit["_source"],
                    }
                )
        except Exception:
            pass

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[: size * 2]


# ── Build context ──────────────────────────────────────────────────────────────
def build_context(results: list) -> str:
    if not results:
        return "Tidak ada data relevan ditemukan."
    parts = []
    for r in results:
        idx = r["index"].replace("hospital_", "").upper()
        parts.append(f"[{idx}]\n{json.dumps(r['data'], ensure_ascii=False)}")
    return "\n\n".join(parts)


# ── Ask Claude ────────────────────────────────────────────────────────────────
def ask_claude(question: str, context: str) -> str:
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
- Jika data tidak cukup, katakan dengan jelas tanpa mengarang

Contoh format yang BENAR:
Dokter spesialis neurologi yang tersedia:
- Dr. Budi Santoso (ID: 1)
- Dr. Siti Rahma (ID: 2)

Total: 2 dokter"""

    msg = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system,
        messages=[
            {
                "role": "user",
                "content": f"Data dari OpenSearch:\n{context}\n\nPertanyaan: {question}",
            }
        ],
    )
    raw = msg.content[0].text
    return strip_markdown(raw)


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "Hospital QA API"}


@app.get("/health")
def health():
    try:
        info = os_client.info()
        return {"status": "healthy", "opensearch": info["version"]["number"]}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Pertanyaan tidak boleh kosong.")

    results = search_opensearch(req.question, size=req.max_results)
    context = build_context(results)
    answer = ask_claude(req.question, context)

    sources = [
        {
            "index": r["index"].replace("hospital_", ""),
            "score": round(r["score"], 3),
        }
        for r in results[:5]
    ]
    # Deduplicate sources by index name
    seen = set()
    unique_sources = []
    for s in sources:
        if s["index"] not in seen:
            seen.add(s["index"])
            unique_sources.append(s)

    return AskResponse(answer=answer, sources=unique_sources)


@app.get("/stats")
def stats():
    data = {}
    for index in INDICES:
        try:
            count = os_client.count(index=index)["count"]
            data[index.replace("hospital_", "")] = count
        except Exception:
            data[index.replace("hospital_", "")] = 0
    return {"indices": data}
