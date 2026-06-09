/* ============================================================
   Dashboard Sidebar — CostPulse
   Diintegrasikan dengan window.HData (live dari FastAPI)
   ============================================================ */

/* ---- Grand Total Banner ---- */
function GrandTotal({ data }) {
  const total = data.grand_total || 0;
  let display, unit;
  if (total >= 1000) { display = (total / 1000).toFixed(2).replace(".", ","); unit = "Miliar"; }
  else               { display = total.toLocaleString("id-ID"); unit = "jt"; }

  return (
    <div className="grand-total">
      <div className="gt-label">Total Biaya Operasional</div>
      <div className="gt-value mono">
        Rp {display}<span className="gt-unit">{unit}</span>
      </div>
      <div className="gt-sub">Seluruh departemen · Semua periode</div>
    </div>
  );
}

/* ---- Donut Chart ---- */
function DonutChart({ data }) {
  const { CAT_KEYS, CAT_CONFIG } = window.HData;
  const size = 100, sw = 14;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const gap = 3;

  const items = CAT_KEYS.map(k => ({
    key: k, ...CAT_CONFIG[k], ...data.by_category[k],
  })).sort((a, b) => b.pct - a.pct);

  let offset = 0;
  const segs = items.map(d => {
    const len = Math.max(((d.pct || 0) / 100) * circ - gap, 1);
    const s = { ...d, len, offset };
    offset += len + gap;
    return s;
  });

  const total = data.grand_total || 0;
  let centerVal, centerUnit;
  if (total >= 1000) { centerVal = (total / 1000).toFixed(1).replace(".", ","); centerUnit = "Miliar"; }
  else               { centerVal = total.toLocaleString("id-ID"); centerUnit = "jt"; }

  return (
    <div className="donut-wrap">
      <div className="donut-chart" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
          {segs.map((s, i) => (
            <circle key={i} cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={s.len + " " + (circ - s.len)}
              strokeDashoffset={-s.offset}
              transform={"rotate(-90 " + size / 2 + " " + size / 2 + ")"}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          ))}
        </svg>
        <div className="donut-center">
          <div className="dc-val mono">{centerVal}</div>
          <div className="dc-unit">{centerUnit}</div>
        </div>
      </div>
      <div className="donut-legend">
        {items.map((d, i) => (
          <div className="legend-item" key={i}>
            <span className="legend-dot" style={{ background: d.color }}></span>
            <span className="legend-label">{d.short}</span>
            <span className="legend-pct">{(d.pct || 0).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- KPI Cards Grid ---- */
function KPIGrid({ data }) {
  const { CAT_KEYS, CAT_CONFIG, formatRp } = window.HData;
  return (
    <div className="kpi-grid">
      {CAT_KEYS.map((k, i) => {
        const cat = CAT_CONFIG[k];
        const d = data.by_category[k] || { total: 0, pct: 0 };
        const I = Ico[cat.ico];
        const isLast = i === CAT_KEYS.length - 1 && CAT_KEYS.length % 2 === 1;
        return (
          <div className={"kpi-card" + (isLast ? " span-2" : "")} data-cat={k} key={k}>
            <div className="kpi-head">
              <span className="kpi-ico"><I s={13} /></span>
              <span className="kpi-name">{cat.short}</span>
            </div>
            <div className="kpi-val mono">{formatRp(d.total)}</div>
            <div className="kpi-pct">{(d.pct || 0).toFixed(1)}% dari total</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Sparkline Tren Bulanan ---- */
function SparklineChart({ data }) {
  const trend = data.trend_monthly || [];
  if (trend.length < 2) return null;

  const last12 = trend.slice(-12);
  const vals = last12.map(t => t.total);
  const lo = Math.min(...vals) * 0.94;
  const hi = Math.max(...vals) * 1.03;
  const W = 268, H = 56;

  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = 4 + (1 - ((v - lo) / (hi - lo || 1))) * (H - 8);
    return x.toFixed(1) + "," + y.toFixed(1);
  });

  const line = pts.join(" ");
  const area = line + " " + W + "," + H + " 0," + H;

  return (
    <div className="sparkline-wrap">
      <svg className="sparkline-svg" viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none" style={{ height: 56 }}>
        <defs>
          <linearGradient id="spkG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4896E" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#D4896E" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#spkG)" />
        <polyline points={line} fill="none" stroke="#D4896E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="sparkline-labels">
        <span>{last12[0]?.periode || ""}</span>
        <span>{last12[last12.length - 1]?.periode || ""}</span>
      </div>
    </div>
  );
}

/* ---- Department Cost Bars ---- */
function DeptTable({ data }) {
  const depts = (data.by_department || []).slice(0, 6);
  if (!depts.length) return (
    <div style={{ fontSize: 11, color: "var(--text-4)", padding: "8px 0" }}>Memuat data…</div>
  );
  const maxVal = depts[0]?.total || 1;
  return (
    <div className="dept-list">
      {depts.map((d, i) => (
        <div className="dept-row" key={i}>
          <div className="dept-info">
            <span className="dept-name">{d.name}</span>
            <span className="dept-val mono">{d.total.toLocaleString("id-ID")} jt</span>
          </div>
          <div className="dept-bar-bg">
            <div className="dept-bar-fill" style={{ width: (d.total / maxVal * 100) + "%" }}></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Index List ---- */
function IndexList({ indices }) {
  const idxStyle = { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 11 };
  const cntStyle = { fontSize: 10, color: "var(--teal-bright)", background: "var(--teal-soft)", border: "1px solid var(--teal-line)", padding: "2px 7px", borderRadius: 5 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {indices.map((ix) => {
        const I = Ico[ix.ico];
        return (
          <div style={idxStyle} key={ix.key}>
            <span style={{ color: "var(--teal)", opacity: 0.65 }}><I s={13} /></span>
            <span style={{ flex: 1, color: "var(--text-3)" }}>{ix.name}</span>
            <span className="mono" style={cntStyle}>{ix.count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   BRAND LOGO
   ============================================================ */
function CostPulseBrandLogo() {
  return (
    <div className="brand-logo" style={{
      background: 'linear-gradient(135deg, #D4896E 0%, #A8706A 55%, #53354A 100%)',
      boxShadow: '0 4px 20px -4px rgba(212,137,110,0.30), inset 0 1px 0 rgba(255,255,255,0.08)',
      position: 'relative', overflow: 'hidden',
    }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none"
           style={{ position: 'absolute', inset: 0 }}>
        <circle cx="30" cy="10" r="18" fill="rgba(255,255,255,0.06)"/>
        <circle cx="8" cy="32" r="14" fill="rgba(255,255,255,0.04)"/>
        <circle cx="20" cy="20" r="11" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" fill="none"/>
        <circle cx="20" cy="20" r="6.5" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none"/>
      </svg>
      <svg width="26" height="20" viewBox="0 0 26 20" fill="none" style={{ position: 'relative', zIndex: 1 }}>
        <path d="M1 11h3.5L7 4.5l3.5 13L14 2.5l3.5 12.5L19.5 8H25"
              stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.35))' }}/>
        <circle cx="25" cy="8" r="2" fill="white"/>
        <circle cx="25" cy="8" r="3.8" fill="white" fillOpacity="0.15"/>
      </svg>
    </div>
  );
}

/* ============================================================
   SIDEBAR — assembles all dashboard components
   State dikelola di sini agar bisa re-render saat data masuk
   ============================================================ */
function Sidebar({ onPick }) {
  const [data, setData] = React.useState(window.HData.DASHBOARD);
  const [indices, setIndices] = React.useState(window.HData.INDICES);
  const [apiStatus, setApiStatus] = React.useState("checking");

  React.useEffect(() => {
    /* Dengarkan event data siap */
    function onReady() {
      setData({ ...window.HData.DASHBOARD });
      setIndices([...window.HData.INDICES]);
    }
    window.addEventListener("costpulse-data-ready", onReady);

    /* Cek health backend */
    fetch(window.COSTPULSE_API + "/health")
      .then(r => r.json())
      .then(d => setApiStatus(d.status === "healthy" ? "online" : "degraded"))
      .catch(() => setApiStatus("offline"));

    return () => window.removeEventListener("costpulse-data-ready", onReady);
  }, []);

  return (
    <aside className="sidebar">
      <div className="brand">
        <CostPulseBrandLogo />
        <div>
          <div className="brand-name">CostPulse<span>Analytics</span></div>
          <div className="brand-tag">Analisis Biaya · OpenSearch + Groq</div>
        </div>
      </div>

      <div className="side-scroll">
        <div className="side-section">
          <GrandTotal data={data} />
        </div>

        <div className="side-section">
          <div className="side-label">Komposisi Biaya</div>
          <DonutChart data={data} />
        </div>

        <div className="side-section">
          <div className="side-label">Per Kategori</div>
          <KPIGrid data={data} />
        </div>

        <div className="side-section">
          <div className="side-label">Tren 12 Bulan (jt)</div>
          <SparklineChart data={data} />
        </div>

        <div className="side-section">
          <div className="side-label">Biaya per Departemen</div>
          <DeptTable data={data} />
        </div>

        <div className="side-section">
          <div className="side-label">OpenSearch Indices</div>
          <IndexList indices={indices} />
        </div>

        <div className="side-section" style={{ paddingBottom: 8 }}>
          <div className="side-label">Contoh Pertanyaan</div>
          <div className="example-list">
            {window.HData.EXAMPLES.map((ex, i) => (
              <button className="example-btn" key={i} onClick={() => onPick(ex)}>
                {ex}
                <span className="arr"><Ico.Arrow s={11} /></span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="side-foot">
        <span className="status-dot">
          <span className="dot" style={{ background: apiStatus === "online" ? "var(--green)" : apiStatus === "checking" ? "var(--amber)" : "var(--red)" }}></span>
          <b style={{ color: apiStatus === "online" ? "var(--green)" : apiStatus === "checking" ? "var(--amber)" : "var(--red)" }}>
            {apiStatus === "online" ? "Online" : apiStatus === "checking" ? "Connecting…" : "Offline"}
          </b>
        </span>
        <span style={{ marginLeft: "auto" }}>
          <span className="pipeline-tag"><Ico.Spark s={11} /> <b>RAG Pipeline</b></span>
        </span>
      </div>
    </aside>
  );
}

window.DashSidebar = Sidebar;
