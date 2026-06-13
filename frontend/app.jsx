/* ============================================================
   CostPulse App  v3 — Dual Section: Dashboard + Chat
   Tab navigation · Aurora BG · Glassmorphism
   ============================================================ */
const { Message, SearchIndicator } = window.ChatUI;
const { AuroraShader }             = window;
const DashboardPanel               = window.CostDashboard;

const WELCOME = {
  id: "welcome", role: "bot", noAnim: true,
  content: [
    { type: "text", lead: true, text: "Selamat datang di CostPulse Analytics Intelligence." },
    { type: "text", text: "Saya analis berbasis RAG yang menganalisis biaya operasional rumah sakit secara real-time. Setiap jawaban ditarik langsung dari indeks OpenSearch dan dirangkum oleh Groq LLM.\n\nJika jawaban mengandung angka terstruktur, akan otomatis divisualisasikan sebagai chart atau tabel." },
    { type: "checks", title: "Komponen biaya yang tersedia", items: [
      { name: "Biaya Obat & Farmasi",       sub: "1.000 records · cost_obat" },
      { name: "Biaya Alat Medis",           sub: "1.000 records · cost_alat_medis" },
      { name: "Biaya Laboratorium",         sub: "1.000 records · cost_lab" },
      { name: "Biaya SDM & Nakes",          sub: "1.000 records · cost_sdm" },
      { name: "Biaya Utilitas & Overhead",  sub: "2.520 records · cost_utilitas" },
      { name: "Ringkasan Bulanan 3 Tahun",  sub: "360 records · cost_monthly" },
    ]},
    { type: "text", text: "Ketik pertanyaan di bawah atau klik contoh di sidebar." },
  ],
};

/* ── Status dot ── */
function StatusBadge({ status }) {
  const map = {
    online:   { color: "#4ade80", label: "Online",   glow: "0 0 7px #4ade8088" },
    offline:  { color: "#f87171", label: "Offline",  glow: "none" },
    checking: { color: "#fbbf24", label: "Checking", glow: "none" },
    degraded: { color: "#fbbf24", label: "Degraded", glow: "none" },
  };
  const s = map[status] || map.checking;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color, boxShadow: s.glow }}/>
      <span className="font-mono text-[10px] text-on-surface-variant">{s.label}</span>
    </div>
  );
}

/* ── Sidebar ── */
function Sidebar({ onPick, activeTab, setActiveTab }) {
  const [data, setData]       = React.useState(window.HData.DASHBOARD);
  const [indices, setIndices] = React.useState(window.HData.INDICES);
  const [status, setStatus]   = React.useState("checking");

  React.useEffect(() => {
    function onReady() { setData({ ...window.HData.DASHBOARD }); setIndices([...window.HData.INDICES]); }
    window.addEventListener("costpulse-data-ready", onReady);
    fetch(window.COSTPULSE_API + "/health")
      .then(r => r.json())
      .then(d => setStatus(d.status === "healthy" ? "online" : "degraded"))
      .catch(() => setStatus("offline"));
    return () => window.removeEventListener("costpulse-data-ready", onReady);
  }, []);

  const grand = data.grand_total || 0;
  const grandDisplay = grand >= 1000
    ? "Rp " + (grand / 1000).toFixed(2).replace(".", ",") + " T"
    : "Rp " + (grand || 0).toLocaleString("id-ID") + " jt";

  const { CAT_KEYS, CAT_CONFIG } = window.HData;
  const cat = data.by_category || {};

  return (
    <nav className="glass-panel fixed left-0 top-0 h-full w-[280px] border-r border-outline-variant/25 flex flex-col z-20">

      {/* Brand */}
      <div className="px-5 pt-5 pb-4 border-b border-outline-variant/15">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-container to-secondary-container flex items-center justify-center shadow-lg flex-shrink-0" style={{ boxShadow: "0 0 16px rgba(0,229,255,0.3)" }}>
            <span className="material-symbols-outlined fill text-on-primary ms-sm">monitor_heart</span>
          </div>
          <div>
            <h1 className="font-grotesk font-bold text-base text-primary-container tracking-tight leading-tight">CostPulse</h1>
            <p className="font-mono text-[10px] text-on-surface-variant">Analytics Intelligence</p>
          </div>
        </div>

        {/* Grand total card */}
        <div className="glass-card rounded-xl p-3.5 border border-primary-container/20 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl" style={{ background: "rgba(0,229,255,0.1)" }}/>
          <div className="relative z-10">
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-0.5">Total OpEx</p>
            <div className="font-grotesk font-bold text-lg text-primary-container tabular-nums">{grandDisplay}</div>
            <p className="font-mono text-[9px] text-on-surface-variant mt-0.5">Semua dept · Semua periode</p>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="px-3 pt-3 flex gap-1">
        {[
          { id: "dashboard", icon: "dashboard", label: "Dashboard" },
          { id: "chat",      icon: "chat",      label: "AI Chat" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-primary-container/15 text-primary-container border border-primary-container/25"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50 border border-transparent"
            }`}>
            <span className="material-symbols-outlined ms-xs">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* Per-kategori mini */}
        <div>
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">Per Kategori</p>
          <div className="space-y-1.5">
            {CAT_KEYS.map(k => {
              const d = cat[k] || { total: 0, pct: 0 };
              const cfg = CAT_CONFIG[k];
              return (
                <div key={k} className="flex items-center gap-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }}/>
                  <span className="font-mono text-[10px] text-on-surface-variant flex-1 truncate">{cfg.short}</span>
                  <span className="font-mono text-[10px] tabular-nums" style={{ color: cfg.color }}>{window.HData.formatRp(d.total, "jt")}</span>
                  <span className="font-mono text-[9px] text-on-surface-variant w-8 text-right">{(d.pct || 0).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Indices */}
        <div>
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">OpenSearch Indices</p>
          <div className="space-y-1">
            {indices.map(ix => (
              <div key={ix.key} className="flex items-center gap-2 py-1">
                <span className="material-symbols-outlined ms-xs text-on-surface-variant opacity-60">{ix.icon || "storage"}</span>
                <span className="font-mono text-[10px] text-on-surface-variant flex-1 truncate">{ix.key.replace("cost_", "")}</span>
                <span className="font-mono text-[10px] text-primary-container bg-primary-container/10 px-1.5 py-0.5 rounded">{ix.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Examples (only in chat tab) */}
        {activeTab === "chat" && (
          <div>
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">Contoh Pertanyaan</p>
            <div className="space-y-1.5">
              {window.HData.EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => onPick(ex)}
                  className="w-full text-left glass-card border border-outline-variant/20 rounded-lg px-3 py-2 text-[11px] text-on-surface-variant hover:text-on-surface hover:border-primary-container/30 transition-all flex items-start gap-2 group glass-card-hover">
                  <span className="material-symbols-outlined ms-xs text-surface-tint opacity-50 group-hover:opacity-100 flex-shrink-0 mt-0.5">chevron_right</span>
                  <span className="leading-tight">{ex}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-outline-variant/15 flex items-center justify-between">
        <StatusBadge status={status}/>
        <div className="glass-card border border-outline-variant/20 rounded-full px-2 py-0.5 flex items-center gap-1">
          <span className="material-symbols-outlined ms-xs text-surface-tint">hub</span>
          <span className="font-mono text-[9px] text-on-surface-variant">RAG Pipeline</span>
        </div>
      </div>
    </nav>
  );
}

/* ── Chat Section ── */
function ChatSection({ messages, busy, scan, input, setInput, send, taRef, threadRef }) {
  function onKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }
  function onInput(e) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }
  const canSend = !busy && input.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-[800px] mx-auto space-y-6">
          {messages.map(m => <Message key={m.id} m={m}/>)}
          {busy && <SearchIndicator indices={scan}/>}
          <div style={{ height: 8 }}/>
        </div>
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 px-8 pb-6">
        <div className="max-w-[800px] mx-auto">
          <div className="glass-input rounded-2xl p-1 flex items-end gap-2">
            <textarea
              ref={taRef} rows={1} value={input}
              onChange={onInput} onKeyDown={onKey}
              placeholder="Ketik pertanyaan tentang biaya operasional rumah sakit…"
              className="flex-1 bg-transparent text-on-surface placeholder-on-surface-variant text-sm leading-relaxed resize-none outline-none px-4 py-3 font-inter"
              style={{ minHeight: 48, maxHeight: 160 }}
            />
            <button onClick={() => send()} disabled={!canSend}
              className={`rounded-xl m-1 px-4 py-2.5 flex items-center gap-2 font-medium text-sm transition-all flex-shrink-0 ${
                canSend
                  ? "bg-gradient-to-r from-primary-container to-secondary-container text-on-primary btn-glow hover:opacity-90"
                  : "bg-surface-container-high text-on-surface-variant opacity-40 cursor-not-allowed"
              }`}>
              {busy
                ? <span className="material-symbols-outlined ms-sm spin">refresh</span>
                : <span className="material-symbols-outlined ms-sm">send</span>}
              {busy ? "Analisis…" : "Kirim"}
            </button>
          </div>
          <div className="flex justify-between items-center mt-2 px-1">
            <span className="font-mono text-[10px] text-on-surface-variant">
              <kbd className="glass-card border border-outline-variant/25 rounded px-1 py-0.5 text-[9px]">Enter</kbd> kirim ·&nbsp;
              <kbd className="glass-card border border-outline-variant/25 rounded px-1 py-0.5 text-[9px]">Shift+Enter</kbd> baris baru
            </span>
            <span className="font-mono text-[10px] text-on-surface-variant">
              {input.length > 0 ? input.length + " karakter" : "7 indeks · 6.890 records"}
            </span>
          </div>
          <p className="font-mono text-[9px] text-on-surface-variant text-center mt-2 opacity-50 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined ms-xs">shield</span>
            Jawaban dihasilkan AI dari data internal. Validasi sebelum pengambilan keputusan.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── App Root ── */
function App() {
  const [activeTab, setActiveTab]   = React.useState("dashboard");
  const [messages,  setMessages]    = React.useState([WELCOME]);
  const [input,     setInput]       = React.useState("");
  const [busy,      setBusy]        = React.useState(false);
  const [scan,      setScan]        = React.useState([]);
  const [dashData,  setDashData]    = React.useState(null);
  const [dashLoad,  setDashLoad]    = React.useState(true);
  const threadRef = React.useRef(null);
  const taRef     = React.useRef(null);

  React.useEffect(() => {
    function onReady() {
      setDashData({ ...window.HData.DASHBOARD });
      setDashLoad(false);
    }
    window.addEventListener("costpulse-data-ready", onReady);
    return () => window.removeEventListener("costpulse-data-ready", onReady);
  }, []);

  React.useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(text) {
    const q = (text != null ? text : input).trim();
    if (!q || busy) return;
    /* Auto-switch to chat on pick */
    setActiveTab("chat");
    setMessages(m => [...m, { id: "u" + Date.now(), role: "user", content: q }]);
    setInput("");
    if (taRef.current) { taRef.current.style.height = "auto"; }
    setScan(window.HData.scanIndicesFor(q));
    setBusy(true);
    try {
      const ans = await window.HData.answerFor(q);
      setMessages(m => [...m, { id: "b" + Date.now(), role: "bot", content: ans.blocks }]);
    } catch (e) {
      setMessages(m => [...m, { id: "b" + Date.now(), role: "bot", content: [{ type: "text", lead: true, text: "Terjadi kesalahan: " + e.message }] }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Aurora background */}
      <div className="absolute inset-0 z-0"><AuroraShader/></div>
      <div className="absolute inset-0 z-0" style={{ background: "rgba(5,14,30,0.52)" }}/>

      {/* Layout */}
      <div className="relative z-10 flex h-full w-full">
        <Sidebar onPick={q => send(q)} activeTab={activeTab} setActiveTab={setActiveTab}/>

        {/* Main */}
        <main className="ml-[280px] flex-1 flex flex-col h-full overflow-hidden">

          {/* Top bar */}
          <header className="flex-shrink-0 px-8 pt-5 pb-4 border-b border-outline-variant/15">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="font-grotesk font-bold text-xl text-on-surface tracking-tight">
                    {activeTab === "dashboard" ? "Financial Insights Dashboard" : "Analisis Biaya — AI Chat"}
                  </h2>
                  <p className="text-on-surface-variant text-xs mt-0.5 font-mono flex items-center gap-1.5">
                    <span className="text-primary-container font-semibold">RAG</span>
                    <span className="opacity-40">·</span>
                    OpenSearch retriever + Groq LLM generator
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Tab toggles in header */}
                {[
                  { id: "dashboard", icon: "dashboard", label: "Dashboard" },
                  { id: "chat",      icon: "chat",      label: "AI Chat" },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      activeTab === tab.id
                        ? "bg-primary-container/15 text-primary-container border-primary-container/30 shadow-[0_0_12px_rgba(0,229,255,0.15)]"
                        : "text-on-surface-variant hover:text-on-surface border-outline-variant/20 hover:border-outline-variant/40 glass-card"
                    }`}>
                    <span className="material-symbols-outlined ms-xs">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
                <div className="w-px h-5 bg-outline-variant/30 mx-1"/>
                <button
                  onClick={() => {
                    if (activeTab === "chat") setMessages([WELCOME]);
                    else { setDashLoad(true); window.HData.loadDashboard(); }
                  }}
                  className="glass-card border border-outline-variant/25 text-on-surface-variant hover:text-on-surface rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all hover:border-primary-container/25">
                  <span className="material-symbols-outlined ms-xs">refresh</span>
                  Reset
                </button>
              </div>
            </div>
          </header>

          {/* Content area — tab-switched */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "dashboard" && (
              <div className="h-full overflow-y-auto">
                <DashboardPanel data={dashData || window.HData.DASHBOARD} loading={dashLoad}/>
              </div>
            )}
            {activeTab === "chat" && (
              <ChatSection
                messages={messages} busy={busy} scan={scan}
                input={input} setInput={setInput}
                send={send} taRef={taRef} threadRef={threadRef}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
