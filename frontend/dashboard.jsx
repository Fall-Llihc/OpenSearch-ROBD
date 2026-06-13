/* ============================================================
   Dashboard Sidebar — Stitch "Lumina Analytics" Design
   Glassmorphism · Hanken Grotesk · Material Symbols
   ============================================================ */

function KpiCards({ data }) {
  const { CAT_KEYS, CAT_CONFIG, formatRp } = window.HData;
  const cat = data.by_category || {};
  const ICONS = { obat:"medication", alat_medis:"build", lab:"biotech", sdm:"group", utilitas:"bolt" };
  const COLORS = {
    obat:       { ring:"border-primary-fixed/30",      glow:"bg-primary-fixed/10",    text:"text-primary-fixed",     icon:"bg-primary-fixed/20 text-primary-fixed" },
    alat_medis: { ring:"border-secondary/30",           glow:"bg-secondary/10",         text:"text-secondary",          icon:"bg-secondary/20 text-secondary" },
    lab:        { ring:"border-primary-container/30",   glow:"bg-primary-container/10", text:"text-primary-container",  icon:"bg-primary-container/20 text-primary-container" },
    sdm:        { ring:"border-tertiary-container/30",  glow:"bg-tertiary-container/10",text:"text-tertiary-container", icon:"bg-tertiary-container/20 text-tertiary-container" },
    utilitas:   { ring:"border-error/30",               glow:"bg-error/10",             text:"text-error",              icon:"bg-error/20 text-error" },
  };
  return (
    <div className="space-y-2">
      {CAT_KEYS.map(k => {
        const d = cat[k] || { total:0, pct:0 };
        const c = COLORS[k]; const cfg = CAT_CONFIG[k];
        return (
          <div key={k} className={"glass-card rounded-xl p-3 border "+c.ring+" relative overflow-hidden"}>
            <div className={"absolute top-0 right-0 w-16 h-16 "+c.glow+" rounded-full blur-xl -mr-4 -mt-4"}/>
            <div className="flex items-center gap-3 relative z-10">
              <div className={"w-8 h-8 rounded-lg "+c.icon+" flex items-center justify-center flex-shrink-0"}>
                <span className="material-symbols-outlined ms-sm">{ICONS[k]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">{cfg.short}</div>
                <div className={"font-grotesk font-bold text-sm "+c.text+" tabular-nums"}>{formatRp(d.total)}</div>
              </div>
              <span className={"font-mono text-[10px] px-1.5 py-0.5 rounded "+c.icon}>{(d.pct||0).toFixed(1)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ data }) {
  const { CAT_KEYS, CAT_CONFIG } = window.HData;
  const cat = data.by_category || {};
  const r=38, sw=13, size=100, circ=2*Math.PI*r, gap=2.5;
  const STROKES = ["#9cf0ff","#d8b9ff","#00e5ff","#cdcdf6","#ffb4ab"];
  const slices = CAT_KEYS.map((k,i)=>({ pct:cat[k]?.pct||0, stroke:STROKES[i], label:CAT_CONFIG[k].short }));
  let cum=0;
  const segs = slices.map(s=>{
    const len=Math.max((s.pct/100)*circ-gap,0.5);
    const seg={...s,len,offset:circ*0.25-cum};
    cum+=len+gap; return seg;
  });
  const grand=data.grand_total||0;
  const display=grand>=1000?(grand/1000).toFixed(1)+"M":grand.toLocaleString("id-ID");
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{width:size,height:size}}>
        <svg width={size} height={size} viewBox={"0 0 "+size+" "+size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1c2b3c" strokeWidth={sw}/>
          {segs.map((s,i)=>(
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.stroke} strokeWidth={sw}
              strokeDasharray={s.len+" "+(circ-s.len)} strokeDashoffset={s.offset}
              style={{transition:"stroke-dasharray .7s ease"}}/>
          ))}
          <circle cx={size/2} cy={size/2} r={r-sw/2-2} fill="rgba(5,20,36,0.7)"/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[9px] text-on-surface-variant">Total</span>
          <span className="font-grotesk font-bold text-sm text-on-surface tabular-nums">{display}</span>
          <span className="font-mono text-[8px] text-on-surface-variant">jt</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {segs.map((s,i)=>(
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{background:s.stroke}}/>
              <span className="text-on-surface-variant text-[11px]">{s.label}</span>
            </div>
            <span className="font-mono text-[11px] text-on-surface-variant">{(s.pct||0).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ data }) {
  const trend=(data.trend_monthly||[]).slice(-12);
  if(trend.length<2) return null;
  const vals=trend.map(t=>t.total);
  const lo=Math.min(...vals)*0.93, hi=Math.max(...vals)*1.04;
  const W=230,H=52;
  const pts=vals.map((v,i)=>{
    const x=(i/(vals.length-1))*W;
    const y=4+(1-(v-lo)/(hi-lo||1))*(H-8);
    return x.toFixed(1)+","+y.toFixed(1);
  }).join(" ");
  const area=pts+" "+W+","+H+" 0,"+H;
  return (
    <div>
      <svg className="w-full" viewBox={"0 0 "+W+" "+H} preserveAspectRatio="none" style={{height:52}}>
        <defs>
          <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#spk)"/>
        <polyline points={pts} fill="none" stroke="#00daf3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="flex justify-between font-mono text-[9px] text-on-surface-variant mt-0.5">
        <span>{trend[0]?.periode}</span><span>{trend[trend.length-1]?.periode}</span>
      </div>
    </div>
  );
}

function DeptBars({ data }) {
  const depts=(data.by_department||[]).slice(0,5);
  if(!depts.length) return <div className="font-mono text-[11px] text-on-surface-variant">Memuat…</div>;
  const max=depts[0]?.total||1;
  return (
    <div className="space-y-2.5">
      {depts.map((d,i)=>(
        <div key={i}>
          <div className="flex justify-between font-mono text-[10px] mb-1">
            <span className="text-on-surface-variant truncate max-w-[145px]">{d.name}</span>
            <span className="text-primary-fixed-dim">{(d.total/1000).toFixed(0)}M</span>
          </div>
          <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary-container to-secondary-container"
                 style={{width:(d.total/max*100).toFixed(1)+"%",transition:"width .6s ease"}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function Sidebar({ onPick }) {
  const [data,setData]       = React.useState(window.HData.DASHBOARD);
  const [indices,setIndices] = React.useState(window.HData.INDICES);
  const [status,setStatus]   = React.useState("checking");

  React.useEffect(()=>{
    function onReady(){ setData({...window.HData.DASHBOARD}); setIndices([...window.HData.INDICES]); }
    window.addEventListener("costpulse-data-ready",onReady);
    fetch(window.COSTPULSE_API+"/health")
      .then(r=>r.json()).then(d=>setStatus(d.status==="healthy"?"online":"degraded"))
      .catch(()=>setStatus("offline"));
    return ()=>window.removeEventListener("costpulse-data-ready",onReady);
  },[]);

  const STATUS_COLOR={online:"bg-green-400",checking:"bg-yellow-400",offline:"bg-red-400",degraded:"bg-yellow-400"};
  const grand=data.grand_total||0;
  const grandDisplay=grand>=1000?("Rp "+(grand/1000).toFixed(2).replace(".",",")+" M"):("Rp "+grand.toLocaleString("id-ID")+" jt");

  return (
    <nav className="glass-panel fixed left-0 top-0 h-full w-[280px] border-r border-outline-variant/30 flex flex-col z-20">

      {/* Brand + Grand Total */}
      <div className="px-5 pt-5 pb-4 border-b border-outline-variant/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-container to-secondary-container flex items-center justify-center shadow-lg shadow-primary-container/20 flex-shrink-0">
            <span className="material-symbols-outlined fill text-on-primary font-bold" style={{fontSize:20}}>monitor_heart</span>
          </div>
          <div>
            <h1 className="font-grotesk font-bold text-base text-primary-container tracking-tight leading-tight">CostPulse</h1>
            <p className="font-mono text-[10px] text-on-surface-variant">Analytics Intelligence</p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-3.5 border border-primary-container/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary-container/10 rounded-full blur-2xl -mr-6 -mt-6"/>
          <div className="relative z-10">
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-0.5">Total Biaya Operasional</p>
            <div className="font-grotesk font-bold text-xl text-primary-container tabular-nums">{grandDisplay}</div>
            <p className="font-mono text-[9px] text-on-surface-variant mt-0.5">Seluruh dept · Semua periode</p>
          </div>
        </div>
      </div>

      {/* Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div>
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">Komposisi Biaya</p>
          <DonutChart data={data}/>
        </div>
        <div>
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">Per Kategori</p>
          <KpiCards data={data}/>
        </div>
        <div>
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">Tren 12 Bulan (jt)</p>
          <Sparkline data={data}/>
        </div>
        <div>
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">Biaya per Departemen</p>
          <DeptBars data={data}/>
        </div>
        <div>
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">OpenSearch Indices</p>
          <div className="flex flex-wrap gap-1.5">
            {indices.map(ix=>(
              <div key={ix.key} className="glass-card border border-outline-variant/30 rounded-lg px-2 py-1 flex items-center gap-1">
                <span className="font-mono text-[9px] text-on-surface-variant">{ix.key.replace("cost_","")}</span>
                <span className="font-mono text-[9px] text-primary-container bg-primary-container/10 px-1 rounded">{ix.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">Contoh Pertanyaan</p>
          <div className="space-y-1.5">
            {window.HData.EXAMPLES.map((ex,i)=>(
              <button key={i} onClick={()=>onPick(ex)}
                className="w-full text-left glass-card border border-outline-variant/25 rounded-lg px-3 py-2 text-[11px] text-on-surface-variant hover:text-on-surface hover:border-primary-container/30 transition-all flex items-center gap-2 group">
                <span className="material-symbols-outlined ms-xs text-surface-tint opacity-60 group-hover:opacity-100 flex-shrink-0">chevron_right</span>
                <span className="leading-tight">{ex}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-outline-variant/20 flex items-center gap-2">
        <span className={"w-2 h-2 rounded-full "+STATUS_COLOR[status]} style={status==="online"?{boxShadow:"0 0 6px #4ade80"}:{}}/>
        <span className="font-mono text-[10px] text-on-surface-variant capitalize">{status}</span>
        <div className="ml-auto glass-card border border-outline-variant/25 rounded-full px-2 py-0.5 flex items-center gap-1">
          <span className="material-symbols-outlined ms-xs text-surface-tint">hub</span>
          <span className="font-mono text-[9px] text-on-surface-variant">RAG Pipeline</span>
        </div>
      </div>
    </nav>
  );
}

window.DashSidebar = Sidebar;
