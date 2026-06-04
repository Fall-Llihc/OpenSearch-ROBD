import { useState, useRef, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Icons ──────────────────────────────────────────────────────────────────────
const Ico = {
  Cross: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M10 3.5h4a1.5 1.5 0 0 1 1.5 1.5V8.5H19a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 19 15.5h-3.5V19a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 19v-3.5H5A1.5 1.5 0 0 1 3.5 14v-4A1.5 1.5 0 0 1 5 8.5h3.5V5A1.5 1.5 0 0 1 10 3.5Z" fill="currentColor"/>
    </svg>
  ),
  Spinner: ({ s = 16 }) => (
    <svg className="spin" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.22"/>
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  ),
  Send: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 12 20 4l-5 16-3.5-6L4 12Z" fill="currentColor"/>
    </svg>
  ),
  User: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M5 19.5c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Reset: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 5v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.5 10a8 8 0 1 1-.7 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Arrow: ({ s = 13 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" opacity="0.5"/>
      <path d="m8 12 2.7 2.7L16 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Index: ({ s = 13 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" stroke="currentColor" strokeWidth="1.7"/>
    </svg>
  ),
  Shield: ({ s = 13 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 3 5 6v5c0 4.4 3 8 7 9 4-1 7-4.6 7-9V6l-7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Spark: ({ s = 13 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Patients: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7.5" r="3.2" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M17 6v4M15 8h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Doctor: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Dept: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 20V7l8-3.5L20 7v13" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M4 20h16M10 11h4M12 9v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Team: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7"/>
      <circle cx="16" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M3.5 18c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4M12 18c0-2.2 2-4 4.5-4s4 1.6 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Service: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M3.5 9.5h17M8 5V3.5M16 5V3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Bill: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5h12v17l-3-1.6-3 1.6-3-1.6-3 1.6V3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M9 8h6M9 11.5h6M9 15h3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Pay: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M7 14.5h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
};

// ── Data ───────────────────────────────────────────────────────────────────────
const INDICES = [
  { key: "patients",    name: "Patients",    ico: "Patients" },
  { key: "doctors",     name: "Doctors",     ico: "Doctor"   },
  { key: "departments", name: "Departments", ico: "Dept"     },
  { key: "teams",       name: "Teams",       ico: "Team"     },
  { key: "services",    name: "Services",    ico: "Service"  },
  { key: "bills",       name: "Bills",       ico: "Bill"     },
  { key: "payments",    name: "Payments",    ico: "Pay"      },
  { key: "tim_dokter",  name: "Tim Dokter",  ico: "Team"     },
];

const EXAMPLES = [
  "Berapa jumlah dokter spesialis neurologi?",
  "Apa saja layanan rawat inap yang tersedia?",
  "Berapa total tagihan yang belum lunas?",
  "Departemen apa saja yang ada di rumah sakit?",
  "Metode pembayaran apa saja yang diterima?",
  "Berapa total pasien yang terdaftar?",
];

const WELCOME_MSG = {
  id: "welcome",
  role: "bot",
  text: "Selamat datang di QA System Rumah Sakit Sehat Selalu! 👋\n\nSaya asisten berbasis RAG yang menjawab pertanyaan dari data operasional rumah sakit.\n\nData yang tersedia:\n- Pasien (1.000 data)\n- Dokter & spesialisasi (1.000 data)\n- Departemen & layanan (1.000 data)\n- Tagihan & pembayaran (1.000 data)\n\nSilakan ketik pertanyaan atau pilih contoh di sidebar.",
  sources: [],
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ onPick, stats, apiStatus }) {
  const statusOnline = apiStatus === "online";
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo"><Ico.Cross s={24} /></div>
        <div>
          <div className="brand-name">Rumah Sakit<span>Sehat Selalu</span></div>
          <div className="brand-tag">QA System · OpenSearch + Groq LLM</div>
        </div>
      </div>

      <div className={`status-strip ${statusOnline ? "online" : "offline"}`}>
        <span className={`dot-pulse ${statusOnline ? "green" : "red"}`}></span>
        Backend: <b>{statusOnline ? "Online" : apiStatus === "checking" ? "Connecting…" : "Offline"}</b>
      </div>

      <div className="side-scroll">
        <div className="side-label">OpenSearch Indices</div>
        <div className="index-list">
          {INDICES.map((ix) => {
            const I = Ico[ix.ico];
            return (
              <div className="index-row" key={ix.key}>
                <span className="index-ico"><I s={15} /></span>
                <span className="index-name">{ix.name}</span>
                <span className="index-count mono">
                  {stats ? (stats[ix.key] ?? "–").toLocaleString("id-ID") : "…"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="side-label">Contoh Pertanyaan</div>
        <div className="example-list">
          {EXAMPLES.map((ex, i) => (
            <button className="example-btn" key={i} onClick={() => onPick(ex)}>
              {ex}
              <span className="arr"><Ico.Arrow s={13} /></span>
            </button>
          ))}
        </div>
      </div>

      <div className="side-foot">
        <span className="pipeline-tag"><Ico.Spark s={13} /> <b>RAG Pipeline</b></span>
        <span style={{ marginLeft: "auto" }}>v2.4 · 8 indeks</span>
      </div>
    </aside>
  );
}

// ── Message ────────────────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`msg ${isUser ? "user" : "bot"} fade-up`}>
      <div className={`avatar ${isUser ? "user" : "bot"}`}>
        {isUser ? <Ico.User s={18} /> : <Ico.Cross s={20} />}
      </div>
      <div className="bubble-col">
        <div className="meta-line">
          <b>{isUser ? "Anda" : "QA Assistant"}</b>
          {!isUser && <span>· Groq LLM</span>}
        </div>
        <div className="bubble">
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{msg.text}</p>
          {msg.sources && msg.sources.length > 0 && (
            <div className="sources">
              <span className="sources-label"><Ico.Index s={13} /> Sumber data</span>
              {msg.sources.map((s, i) => (
                <span className="src-chip" key={i}>
                  {s.index} <span className="h">{s.score}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────
function SearchIndicator({ scanning }) {
  const [step, setStep] = useState(0);
  const STEPS = [
    "Menganalisis pertanyaan",
    "Mencari di indeks OpenSearch",
    "Menyusun jawaban dengan Groq LLM",
  ];
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 650);
    const t2 = setTimeout(() => setStep(2), 1550);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="msg bot fade-up">
      <div className="avatar bot"><Ico.Cross s={20} /></div>
      <div className="bubble-col">
        <div className="meta-line"><b>QA Assistant</b> <span>· sedang bekerja</span></div>
        <div className="search-ind">
          <div className="search-line">
            <Ico.Spinner s={16} />
            <span>{STEPS[step]}</span>
            <span className="dots"><i/><i/><i/></span>
          </div>
          {scanning.length > 0 && (
            <div className="search-chips">
              {scanning.map((idx, i) => (
                <span className={`search-chip ${i <= step ? "scanning" : ""}`} key={idx}>{idx}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState([]);
  const [stats, setStats] = useState(null);
  const [apiStatus, setApiStatus] = useState("checking");
  const threadRef = useRef(null);
  const taRef = useRef(null);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    });
  };

  useEffect(scrollDown, [messages, busy]);

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(d => setApiStatus(d.status === "healthy" ? "online" : "degraded"))
      .catch(() => setApiStatus("offline"));

    fetch(`${API_BASE}/stats`)
      .then(r => r.json())
      .then(d => setStats(d.indices))
      .catch(() => {});
  }, []);

  async function send(text) {
    const q = (text != null ? text : input).trim();
    if (!q || busy) return;

    setMessages(m => [...m, { id: "u" + Date.now(), role: "user", text: q, sources: [] }]);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    // Determine which indices to show scanning
    const q_lower = q.toLowerCase();
    const scanList = [];
    if (/dokter|spesialis/.test(q_lower)) scanList.push("doctors");
    if (/departemen|dept/.test(q_lower)) scanList.push("departments");
    if (/tagihan|lunas/.test(q_lower)) scanList.push("bills");
    if (/pembayaran|bayar/.test(q_lower)) scanList.push("payments");
    if (/pasien|bpjs/.test(q_lower)) scanList.push("patients");
    if (/layanan|rawat/.test(q_lower)) scanList.push("services");
    if (scanList.length === 0) scanList.push("patients", "doctors", "departments");
    setScanning(scanList);
    setBusy(true);

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, max_results: 8 }),
      });
      const data = await res.json();
      setMessages(m => [...m, {
        id: "b" + Date.now(),
        role: "bot",
        text: data.answer,
        sources: data.sources || [],
      }]);
    } catch {
      setMessages(m => [...m, {
        id: "b" + Date.now(),
        role: "bot",
        text: "Maaf, terjadi kesalahan saat menghubungi server. Pastikan backend Railway sudah berjalan.",
        sources: [],
      }]);
    } finally {
      setBusy(false);
      setScanning([]);
    }
  }

  function reset() {
    setMessages([WELCOME_MSG]);
    setInput("");
    setBusy(false);
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function onInput(e) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  return (
    <div className="app">
      <Sidebar onPick={send} stats={stats} apiStatus={apiStatus} />

      <main className="main">
        {/* Background decorations */}
        <div className="bg-deco" aria-hidden="true">
          <div className="deco-blob b1" />
          <div className="deco-blob b2" />
          <div className="deco-blob b3" />
        </div>

        <header className="topbar">
          <div className="topbar-titles">
            <h1>Hospital Question &amp; Answer System</h1>
            <div className="sub">
              <span className="pill">RAG</span>
              OpenSearch (retriever) + Groq LLM (generator)
            </div>
          </div>
          <button className="btn-reset" onClick={reset}>
            <Ico.Reset s={15} /> Reset Chat
          </button>
        </header>

        <div className="thread-wrap" ref={threadRef}>
          <div className="thread">
            {messages.map(m => <Message msg={m} key={m.id} />)}
            {busy && <SearchIndicator scanning={scanning} />}
          </div>
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <div className="input-shell">
              <textarea
                ref={taRef}
                rows={1}
                value={input}
                onChange={onInput}
                onKeyDown={onKey}
                placeholder="Ketik pertanyaan tentang data rumah sakit…"
              />
              <div className="input-foot">
                <span><span className="kbd">Enter</span> kirim · <span className="kbd">Shift+Enter</span> baris baru</span>
                <span>{input.length > 0 ? input.length + " karakter" : "Terhubung ke 8 indeks"}</span>
              </div>
            </div>
            <button className="btn-send" onClick={() => send()} disabled={busy || !input.trim()}>
              {busy ? <Ico.Spinner s={16} /> : <Ico.Send s={16} />}
              {busy ? "Mencari" : "Kirim"}
            </button>
          </div>
          <div className="disclaimer">
            <Ico.Shield s={13} />
            Jawaban dihasilkan AI dari data internal &amp; dapat mengandung ketidakakuratan. Bukan pengganti nasihat medis profesional.
          </div>
        </div>
      </main>
    </div>
  );
}
