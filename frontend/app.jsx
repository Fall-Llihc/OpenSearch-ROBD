/* ============================================================
   CostPulse — App (Orchestration)
   Terintegrasi penuh dengan FastAPI backend via HData.answerFor()
   ============================================================ */
const CostSidebar = window.DashSidebar;
const { Message, SearchIndicator } = window.ChatUI;

const WELCOME = {
  id: "welcome",
  role: "bot",
  noAnim: true,
  content: [
    { type: "text", text: "Selamat datang di CostPulse — Sistem Analisis Biaya Operasional!", lead: true },
    { type: "text", text: "Saya asisten berbasis RAG yang menganalisis data biaya operasional rumah sakit secara real-time. Setiap jawaban ditarik langsung dari indeks OpenSearch dan dirangkum oleh Groq LLM." },
    { type: "checks", title: "Komponen biaya yang tersedia", items: [
      { name: "Biaya Obat & Farmasi",    sub: "1.000 records · cost_obat" },
      { name: "Biaya Alat Medis",        sub: "1.000 records · cost_alat_medis" },
      { name: "Biaya Laboratorium",      sub: "1.000 records · cost_lab" },
      { name: "Biaya SDM & Nakes",       sub: "1.000 records · cost_sdm" },
      { name: "Biaya Utilitas & Overhead", sub: "2.520 records · cost_utilitas" },
      { name: "Ringkasan Bulanan",       sub: "360 records · cost_monthly (3 tahun)" },
    ]},
    { type: "text", text: "Ketik pertanyaan analitik atau pilih contoh di sidebar untuk memulai." },
  ],
};

const PLUSES = [
  { left: "18%", size: 16, dur: 17, delay: 0 },
  { left: "34%", size: 11, dur: 22, delay: 5 },
  { left: "52%", size: 20, dur: 19, delay: 9 },
  { left: "68%", size: 13, dur: 24, delay: 3 },
  { left: "82%", size: 15, dur: 21, delay: 12 },
];

function AuroraBg() {
  const ref = React.useRef(null);
  React.useEffect(() => {
    let cleanup = null;
    const mount = () => {
      if (window.mountAurora && ref.current && !cleanup) {
        cleanup = window.mountAurora(ref.current, {
          colorStops: ["#D4896E", "#A8706A", "#53354A"],
          amplitude: 0.9, blend: 0.5, speed: 0.45,
        });
      }
    };
    if (window.mountAurora) mount();
    else window.addEventListener("aurora-ready", mount, { once: true });
    return () => {
      if (cleanup) cleanup();
      window.removeEventListener("aurora-ready", mount);
    };
  }, []);
  return <div ref={ref} className="aurora-container"></div>;
}

function BgDecor() {
  return (
    <div className="bg-deco" aria-hidden="true">
      <AuroraBg />
      <span className="aurora-veil"></span>
      {PLUSES.map((p, i) => (
        <span key={i} className="deco-plus"
          style={{ left: p.left, bottom: "-30px", animationDuration: p.dur + "s", animationDelay: p.delay + "s" }}>
          <Ico.Cross s={p.size} />
        </span>
      ))}
    </div>
  );
}

function App() {
  const [messages, setMessages] = React.useState([WELCOME]);
  const [input, setInput]       = React.useState("");
  const [busy, setBusy]         = React.useState(false);
  const [scan, setScan]         = React.useState([]);
  const threadRef = React.useRef(null);
  const taRef     = React.useRef(null);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };
  React.useEffect(scrollDown, [messages, busy]);

  async function send(text) {
    const q = (text != null ? text : input).trim();
    if (!q || busy) return;

    setMessages(m => [...m, { id: "u" + Date.now(), role: "user", content: q }]);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setScan(window.HData.scanIndicesFor(q));
    setBusy(true);

    try {
      const ans = await window.HData.answerFor(q);
      setMessages(m => [...m, { id: "b" + Date.now(), role: "bot", content: ans.blocks }]);
    } catch (e) {
      setMessages(m => [...m, {
        id: "b" + Date.now(), role: "bot",
        content: [{ type: "text", text: "Terjadi kesalahan: " + e.message, lead: true }],
      }]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMessages([WELCOME]);
    setInput("");
    setBusy(false);
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function onInput(e) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  return (
    <div className="app">
      <CostSidebar onPick={q => send(q)} />
      <main className="main">
        <BgDecor />

        <header className="topbar">
          <div className="topbar-titles">
            <h1>Analisis Biaya Operasional</h1>
            <div className="sub">
              <span className="pill">RAG</span>
              OpenSearch (retriever) + Groq LLM (generator)
            </div>
          </div>
          <button className="btn-reset" onClick={reset}>
            <Ico.Reset s={14} /> Reset
          </button>
        </header>

        <div className="thread-wrap" ref={threadRef}>
          <div className="thread">
            {messages.map(m => <Message m={m} key={m.id} />)}
            {busy && <SearchIndicator indices={scan} />}
          </div>
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <div className="input-shell">
              <textarea
                ref={taRef} rows={1}
                value={input} onChange={onInput} onKeyDown={onKey}
                placeholder="Ketik pertanyaan tentang biaya operasional…"
              ></textarea>
              <div className="input-foot">
                <span><span className="kbd">Enter</span> kirim · <span className="kbd">Shift+Enter</span> baris baru</span>
                <span>{input.length > 0 ? input.length + " karakter" : "7 indeks · 6.890 records"}</span>
              </div>
            </div>
            <button className="btn-send" onClick={() => send()} disabled={busy || !input.trim()}>
              {busy ? <Ico.Spinner s={15} /> : <Ico.Send s={15} />}
              {busy ? "Menganalisis…" : "Kirim"}
            </button>
          </div>
          <div className="disclaimer">
            <Ico.Shield s={12} />
            Jawaban dihasilkan AI dari data internal. Validasi dengan laporan keuangan resmi sebelum pengambilan keputusan.
          </div>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
