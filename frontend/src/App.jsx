import { useState, useRef, useEffect } from "react";

// ── API base URL — set via Vercel env var VITE_API_URL ─────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Sample questions using real data values ───────────────────────────────────
const SAMPLE_QUESTIONS = [
  "Berapa jumlah dokter spesialis neurologi?",
  "Apa saja layanan rawat inap yang tersedia?",
  "Berapa total tagihan yang belum lunas?",
  "Departemen apa saja yang ada di rumah sakit?",
  "Metode pembayaran apa saja yang diterima?",
  "Berapa banyak pasien dengan tipe BPJS?",
  "Tampilkan layanan dengan jenis Radiologi",
  "Dokter dengan spesialisasi apa saja yang ada?",
];

// ── ChatBubble component ───────────────────────────────────────────────────────
function ChatBubble({ role, content, sources, isLoading }) {
  const isUser = role === "user";

  return (
    <div
      className={`flex gap-3 mb-5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow ${
          isUser
            ? "bg-gradient-to-br from-blue-500 to-blue-700"
            : "bg-gradient-to-br from-teal-500 to-teal-700"
        }`}
      >
        {isUser ? "U" : "RS"}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-white text-gray-800 rounded-tl-sm border border-gray-100"
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5 py-0.5 px-1">
            <div className="w-2 h-2 rounded-full bg-teal-400 dot-1" />
            <div className="w-2 h-2 rounded-full bg-teal-400 dot-2" />
            <div className="w-2 h-2 rounded-full bg-teal-400 dot-3" />
          </div>
        ) : (
          <>
            {/* Render plain text — newlines become <br> */}
            <p className="whitespace-pre-wrap">{content}</p>

            {/* Sources chips */}
            {sources && sources.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Sumber OpenSearch
                </p>
                <div className="flex flex-wrap gap-1">
                  {sources.map((s) => (
                    <span
                      key={s.index}
                      className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-medium"
                    >
                      {s.index}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── StatRow ───────────────────────────────────────────────────────────────────
function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-slate-400 capitalize">{label}</span>
      <span className="text-xs font-bold text-teal-400 bg-teal-900/30 px-2 py-0.5 rounded-full">
        {Number(value).toLocaleString("id-ID")}
      </span>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Selamat datang di QA System Rumah Sakit Sehat Selalu!\n\n" +
        "Saya dapat menjawab pertanyaan tentang:\n" +
        "- Pasien (1.000 data)\n" +
        "- Dokter & spesialisasi (1.000 data)\n" +
        "- Departemen & layanan (1.000 data)\n" +
        "- Tagihan & pembayaran (1.000 data)\n\n" +
        "Silakan ketik pertanyaan atau pilih contoh di sidebar.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [apiStatus, setApiStatus] = useState("checking"); // checking | online | offline
  const bottomRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Initial API checks
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then((d) => setApiStatus(d.status === "healthy" ? "online" : "degraded"))
      .catch(() => setApiStatus("offline"));

    fetch(`${API_BASE}/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d.indices))
      .catch(() => {});
  }, []);

  // Send message handler
  const sendMessage = async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput("");

    // Add user message immediately
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, max_results: 8 }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Maaf, terjadi kesalahan saat menghubungi server.\n" +
            "Pastikan backend API sudah berjalan dan dapat diakses.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setMessages([messages[0]]);
  };

  // Status indicator
  const statusDot = {
    online:   "bg-green-400 shadow-[0_0_6px_#4ade80]",
    degraded: "bg-yellow-400",
    offline:  "bg-red-400",
    checking: "bg-gray-400 animate-pulse",
  }[apiStatus];

  const statusLabel = {
    online: "Online", degraded: "Degraded",
    offline: "Offline", checking: "Connecting...",
  }[apiStatus];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* ════════════════════════════════════════ SIDEBAR ════════════════════ */}
      <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0 overflow-y-auto">
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-xl shadow-lg flex-shrink-0">
              🏥
            </div>
            <div className="leading-tight">
              <p className="text-white font-extrabold text-sm">Rumah Sakit</p>
              <p className="text-teal-400 font-extrabold text-sm">Sehat Selalu</p>
            </div>
          </div>
          <p className="text-slate-500 text-[10px] mt-2">
            QA System · OpenSearch + Claude AI
          </p>
        </div>

        {/* API Status */}
        <div className="px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
            <span className="text-slate-400 text-xs">Backend: {statusLabel}</span>
          </div>
        </div>

        {/* Index Stats */}
        <div className="px-5 py-4 border-b border-slate-800">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">
            OpenSearch Indices
          </p>
          <div className="space-y-1.5">
            {stats ? (
              Object.entries(stats).map(([name, count]) => (
                <StatRow key={name} label={name} value={count} />
              ))
            ) : (
              <p className="text-slate-600 text-xs">Memuat stats...</p>
            )}
          </div>
        </div>

        {/* Sample Questions */}
        <div className="px-5 py-4 flex-1">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">
            Contoh Pertanyaan
          </p>
          <div className="space-y-1.5">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={loading}
                className="w-full text-left text-[11px] text-slate-400 hover:text-teal-300 bg-slate-800/50 hover:bg-teal-900/40 border border-slate-700/50 hover:border-teal-700/50 rounded-lg px-3 py-2 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="px-5 py-3 border-t border-slate-800">
          <p className="text-slate-600 text-[10px] text-center">
            OpenSearch 2.13 · Claude claude-sonnet-4
          </p>
        </div>
      </aside>

      {/* ══════════════════════════════════════ MAIN AREA ════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between shadow-sm flex-shrink-0">
          <div>
            <h1 className="font-bold text-gray-800 text-base">
              Hospital Question & Answer System
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">
              RAG Pipeline — OpenSearch (retriever) + Claude AI (generator)
            </p>
          </div>
          <button
            onClick={resetChat}
            className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-all"
          >
            Reset Chat
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <ChatBubble key={i} {...msg} />
            ))}
            {loading && <ChatBubble role="assistant" isLoading />}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex gap-3 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={loading}
              placeholder="Ketik pertanyaan tentang data rumah sakit... (Enter untuk kirim, Shift+Enter untuk baris baru)"
              className="flex-1 resize-none border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all disabled:bg-gray-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 bg-gradient-to-br from-teal-500 to-teal-700 hover:from-teal-600 hover:to-teal-800 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-teal-200 hover:shadow-teal-300 transition-all disabled:shadow-none disabled:cursor-not-allowed"
            >
              {loading ? "..." : "Kirim →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
