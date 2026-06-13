/* ============================================================
   CostPulse App — Stitch "Lumina Analytics" Design
   WebGL Aurora · Glassmorphism · Material Symbols
   ============================================================ */
const { Message, SearchIndicator } = window.ChatUI;
const { AuroraShader }             = window;
const Sidebar                      = window.DashSidebar;

const WELCOME = {
  id:"welcome", role:"bot", noAnim:true,
  content:[
    { type:"text", lead:true,
      text:"Selamat datang di CostPulse Analytics Intelligence." },
    { type:"text",
      text:"Saya analis berbasis RAG yang menganalisis biaya operasional rumah sakit secara real-time. Setiap jawaban ditarik langsung dari indeks OpenSearch dan dirangkum oleh Groq LLM." },
    { type:"checks", title:"Komponen biaya yang tersedia", items:[
      { name:"Biaya Obat & Farmasi",       sub:"1.000 records · cost_obat" },
      { name:"Biaya Alat Medis",           sub:"1.000 records · cost_alat_medis" },
      { name:"Biaya Laboratorium",         sub:"1.000 records · cost_lab" },
      { name:"Biaya SDM & Nakes",          sub:"1.000 records · cost_sdm" },
      { name:"Biaya Utilitas & Overhead",  sub:"2.520 records · cost_utilitas" },
      { name:"Ringkasan Bulanan 3 Tahun",  sub:"360 records · cost_monthly" },
    ]},
    { type:"text", text:"Ketik pertanyaan analitik di bawah atau pilih contoh di sidebar untuk memulai." },
  ],
};

/* ── Top KPI bar — ditampilkan di header main ── */
function TopKpiBar({ summary }) {
  const cat = summary?.by_category || {};
  const grand = cat.total || 0;
  const { formatRp } = window.HData;

  const items = [
    { label:"Total OpEx", val: grand>=1000000000 ? "Rp "+(grand/1000000000).toFixed(2)+" M" : formatRp(Math.round(grand/1000000)), icon:"account_balance_wallet", color:"text-primary-container" },
    { label:"Biaya SDM",  val: formatRp(Math.round((cat.sdm?.value||0)/1000000)),   icon:"group",      color:"text-secondary" },
    { label:"Biaya Obat", val: formatRp(Math.round((cat.obat?.value||0)/1000000)),  icon:"medication", color:"text-primary-fixed" },
    { label:"Utilitas",   val: formatRp(Math.round((cat.utilitas?.value||0)/1000000)), icon:"bolt",   color:"text-error" },
  ];

  return (
    <div className="flex gap-3">
      {items.map((item,i)=>(
        <div key={i} className="glass-card border border-outline-variant/25 rounded-xl px-3 py-2 flex items-center gap-2.5 flex-shrink-0">
          <span className={"material-symbols-outlined ms-sm "+item.color}>{item.icon}</span>
          <div>
            <div className="font-mono text-[9px] text-on-surface-variant uppercase">{item.label}</div>
            <div className={"font-grotesk font-bold text-xs "+item.color+" tabular-nums"}>{item.val||"–"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [messages,setMessages] = React.useState([WELCOME]);
  const [input,setInput]       = React.useState("");
  const [busy,setBusy]         = React.useState(false);
  const [scan,setScan]         = React.useState([]);
  const [summary,setSummary]   = React.useState(null);
  const threadRef = React.useRef(null);
  const taRef     = React.useRef(null);

  React.useEffect(()=>{
    function onReady(){ setSummary({...window.HData.DASHBOARD}); }
    window.addEventListener("costpulse-data-ready",onReady);
    return ()=>window.removeEventListener("costpulse-data-ready",onReady);
  },[]);

  React.useEffect(()=>{
    if(threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  },[messages,busy]);

  async function send(text){
    const q=(text!=null?text:input).trim();
    if(!q||busy) return;
    setMessages(m=>[...m,{id:"u"+Date.now(),role:"user",content:q}]);
    setInput("");
    if(taRef.current){ taRef.current.style.height="auto"; }
    setScan(window.HData.scanIndicesFor(q));
    setBusy(true);
    try{
      const ans = await window.HData.answerFor(q);
      setMessages(m=>[...m,{id:"b"+Date.now(),role:"bot",content:ans.blocks}]);
    }catch(e){
      setMessages(m=>[...m,{id:"b"+Date.now(),role:"bot",content:[{type:"text",lead:true,text:"Terjadi kesalahan: "+e.message}]}]);
    }finally{ setBusy(false); }
  }

  function onKey(e){ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }
  function onInput(e){
    setInput(e.target.value);
    e.target.style.height="auto";
    e.target.style.height=Math.min(e.target.scrollHeight,160)+"px";
  }
  const canSend = !busy && input.trim().length>0;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* WebGL Aurora Background */}
      <div className="absolute inset-0 z-0"><AuroraShader/></div>
      {/* Veil overlay to darken aurora slightly */}
      <div className="absolute inset-0 z-0" style={{background:"rgba(5,20,36,0.55)"}}/>

      {/* App layout */}
      <div className="relative z-10 flex h-full w-full">
        <Sidebar onPick={q=>send(q)}/>

        {/* Main canvas */}
        <main className="ml-[280px] flex-1 flex flex-col h-full overflow-hidden">

          {/* Top bar */}
          <header className="flex-shrink-0 px-8 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-grotesk font-bold text-2xl text-on-surface tracking-tight">Financial Insights Dashboard</h2>
                <p className="text-on-surface-variant text-sm mt-0.5 font-mono">
                  <span className="text-primary-container">RAG</span>
                  <span className="mx-2 opacity-40">·</span>
                  OpenSearch retriever + Groq LLM generator
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <TopKpiBar summary={summary}/>
                <button
                  onClick={()=>setMessages([WELCOME])}
                  className="glass-card border border-outline-variant/30 text-on-surface-variant hover:text-on-surface rounded-xl px-3 py-2 text-sm flex items-center gap-2 transition-all hover:border-primary-container/30">
                  <span className="material-symbols-outlined ms-sm">refresh</span>
                  Reset
                </button>
              </div>
            </div>
          </header>

          {/* Chat thread */}
          <div ref={threadRef} className="flex-1 overflow-y-auto px-8 pb-4">
            <div className="max-w-[800px] mx-auto space-y-6">
              {messages.map(m=><Message key={m.id} m={m}/>)}
              {busy && <SearchIndicator indices={scan}/>}
              <div style={{height:8}}/>
            </div>
          </div>

          {/* Composer — floating glass pill */}
          <div className="flex-shrink-0 px-8 pb-6">
            <div className="max-w-[800px] mx-auto">
              <div className="glass-input rounded-2xl p-1 flex items-end gap-2">
                <textarea
                  ref={taRef} rows={1} value={input}
                  onChange={onInput} onKeyDown={onKey}
                  placeholder="Ketik pertanyaan tentang biaya operasional rumah sakit…"
                  className="flex-1 bg-transparent text-on-surface placeholder-on-surface-variant text-sm leading-relaxed resize-none outline-none px-4 py-3"
                  style={{minHeight:48,maxHeight:160}}
                />
                <button
                  onClick={()=>send()} disabled={!canSend}
                  className={"rounded-xl m-1 px-4 py-2.5 flex items-center gap-2 font-medium text-sm transition-all flex-shrink-0 "+(
                    canSend
                      ? "bg-gradient-to-r from-primary-container to-secondary-container text-on-primary btn-glow hover:opacity-90"
                      : "bg-surface-container-high text-on-surface-variant opacity-50 cursor-not-allowed"
                  )}>
                  {busy
                    ? <span className="material-symbols-outlined ms-sm spin">refresh</span>
                    : <span className="material-symbols-outlined ms-sm">send</span>}
                  {busy ? "Analisis…" : "Kirim"}
                </button>
              </div>
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="font-mono text-[10px] text-on-surface-variant">
                  <kbd className="glass-card border border-outline-variant/30 rounded px-1 py-0.5 text-[9px]">Enter</kbd> kirim &nbsp;·&nbsp;
                  <kbd className="glass-card border border-outline-variant/30 rounded px-1 py-0.5 text-[9px]">Shift+Enter</kbd> baris baru
                </span>
                <span className="font-mono text-[10px] text-on-surface-variant">
                  {input.length>0 ? input.length+" karakter" : "7 indeks · 6.890 records"}
                </span>
              </div>
              <p className="font-mono text-[9px] text-on-surface-variant text-center mt-2 opacity-60 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined ms-xs">shield</span>
                Jawaban dihasilkan AI dari data internal. Validasi dengan laporan keuangan resmi sebelum pengambilan keputusan.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
