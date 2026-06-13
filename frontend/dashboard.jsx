/* ============================================================
   CostPulse — Dashboard Section  v3
   Full analytics view with Chart.js visualizations
   ============================================================ */

/* ── Utility: format number ── */
const fmtRp = v => window.HData.formatRp(v, "jt");
const fmtRaw = v => window.HData.formatRp(v, "raw");

/* ── Donut Chart (SVG, no lib needed) ── */
function DonutChart({ data }) {
  const { CAT_KEYS, CAT_CONFIG } = window.HData;
  const cat = data.by_category || {};
  const r = 54, sw = 14, size = 130, circ = 2 * Math.PI * r, gap = 2;
  const colors = CAT_KEYS.map(k => CAT_CONFIG[k].color);
  const slices = CAT_KEYS.map((k, i) => ({ pct: cat[k]?.pct || 0, color: colors[i], label: CAT_CONFIG[k].short }));
  let cum = 0;
  const segs = slices.map(s => {
    const len = Math.max((s.pct / 100) * circ - gap, 0.5);
    const seg = { ...s, len, offset: circ * 0.25 - cum };
    cum += len + gap;
    return seg;
  });
  const grand = data.grand_total || 0;
  const display = grand >= 1000 ? (grand / 1000).toFixed(1).replace(".", ",") + " T" : grand.toLocaleString("id-ID");

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#0d1c2d" strokeWidth={sw}/>
          {segs.map((s, i) => (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${s.len} ${circ - s.len}`} strokeDashoffset={s.offset}
              style={{ transition: "stroke-dasharray .8s cubic-bezier(.22,.68,0,1)", filter: `drop-shadow(0 0 4px ${s.color}55)` }}/>
          ))}
          <circle cx={size/2} cy={size/2} r={r - sw/2 - 3} fill="rgba(5,14,28,0.85)"/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">Total</span>
          <span className="font-grotesk font-bold text-base text-on-surface tabular-nums">{display}</span>
          <span className="font-mono text-[9px] text-on-surface-variant">juta</span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {segs.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color, boxShadow: `0 0 5px ${s.color}88` }}/>
            <span className="text-on-surface-variant text-xs flex-1 truncate">{s.label}</span>
            <span className="font-mono text-xs text-on-surface tabular-nums">{(s.pct || 0).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI Cards ── */
function KpiCards({ data }) {
  const { CAT_KEYS, CAT_CONFIG } = window.HData;
  const cat = data.by_category || {};
  return (
    <div className="space-y-2">
      {CAT_KEYS.map(k => {
        const d = cat[k] || { total: 0, pct: 0 };
        const cfg = CAT_CONFIG[k];
        return (
          <div key={k} className="glass-card rounded-xl p-3 border border-outline-variant/20 flex items-center gap-3 relative overflow-hidden glass-card-hover transition-all duration-200">
            <div className="absolute right-0 top-0 w-12 h-12 rounded-full blur-xl" style={{ background: cfg.soft }}/>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg.soft }}>
              <span className="material-symbols-outlined ms-sm" style={{ color: cfg.color }}>{cfg.icon}</span>
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <div className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest truncate">{cfg.short}</div>
              <div className="font-grotesk font-bold text-sm tabular-nums" style={{ color: cfg.color }}>{fmtRp(d.total)}</div>
            </div>
            <div className="font-mono text-[10px] px-1.5 py-0.5 rounded relative z-10" style={{ background: cfg.soft, color: cfg.color }}>
              {(d.pct || 0).toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Trend Chart (Chart.js canvas) ── */
function TrendChart({ data }) {
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);
  const trend = data.trend_full || data.trend_monthly || [];
  const last12 = trend.slice(-12);

  React.useEffect(() => {
    if (!canvasRef.current || !last12.length) return;
    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext("2d");
    const labels = last12.map(t => {
      const s = String(t.periode || "");
      return s.length >= 7 ? s.slice(0, 7) : s;
    });

    const makeGrad = (color, alpha1 = 0.25, alpha2 = 0) => {
      const g = ctx.createLinearGradient(0, 0, 0, 180);
      g.addColorStop(0, color.replace(")", `,${alpha1})`).replace("rgb", "rgba"));
      g.addColorStop(1, color.replace(")", `,${alpha2})`).replace("rgb", "rgba"));
      return g;
    };

    const cyanFill   = ctx.createLinearGradient(0, 0, 0, 180);
    cyanFill.addColorStop(0, "rgba(0,218,243,0.22)");
    cyanFill.addColorStop(1, "rgba(0,218,243,0)");

    const budgetFill = ctx.createLinearGradient(0, 0, 0, 180);
    budgetFill.addColorStop(0, "rgba(205,205,246,0.12)");
    budgetFill.addColorStop(1, "rgba(205,205,246,0)");

    const datasets = [
      {
        label: "Total Aktual",
        data: last12.map(t => t.total),
        borderColor: "#00daf3",
        backgroundColor: cyanFill,
        borderWidth: 2,
        pointBackgroundColor: "#00daf3",
        pointRadius: 3,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
      },
    ];

    if (last12[0]?.anggaran) {
      datasets.push({
        label: "Anggaran",
        data: last12.map(t => t.anggaran || 0),
        borderColor: "#cdcdf6",
        backgroundColor: budgetFill,
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.4,
      });
    }

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: "#bac9cc",
              font: { family: "JetBrains Mono", size: 10 },
              boxWidth: 12,
              padding: 12,
            },
          },
          tooltip: {
            backgroundColor: "rgba(5,14,28,0.92)",
            borderColor: "rgba(0,218,243,0.25)",
            borderWidth: 1,
            titleColor: "#00daf3",
            bodyColor: "#d4e4fa",
            titleFont: { family: "JetBrains Mono", size: 11 },
            bodyFont: { family: "JetBrains Mono", size: 11 },
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${fmtRp(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#849396", font: { family: "JetBrains Mono", size: 9 }, maxRotation: 45 },
            grid: { color: "rgba(59,73,76,0.3)", drawBorder: false },
          },
          y: {
            ticks: { color: "#849396", font: { family: "JetBrains Mono", size: 9 }, callback: v => fmtRp(v) },
            grid: { color: "rgba(59,73,76,0.2)", drawBorder: false },
          },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  if (!last12.length) return <div className="skeleton h-[180px] rounded-xl"/>;

  return (
    <div style={{ height: 180, position: "relative" }}>
      <canvas ref={canvasRef}/>
    </div>
  );
}

/* ── Department Bar Chart (Chart.js) ── */
function DeptChart({ data }) {
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);
  const depts = (data.by_department || []).slice(0, 8);

  React.useEffect(() => {
    if (!canvasRef.current || !depts.length) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");

    const colors = depts.map((_, i) => {
      const palette = ["#00daf3","#d8b9ff","#9cf0ff","#cdcdf6","#ffb4ab","#00e5ff","#a8d8ff","#f0d9ff"];
      return palette[i % palette.length];
    });

    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: depts.map(d => d.name?.length > 16 ? d.name.slice(0, 16) + "…" : d.name),
        datasets: [{
          label: "Total Biaya (jt)",
          data: depts.map(d => d.total),
          backgroundColor: colors.map(c => c + "33"),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: colors.map(c => c + "66"),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(5,14,28,0.92)",
            borderColor: "rgba(0,218,243,0.25)",
            borderWidth: 1,
            titleColor: "#d4e4fa",
            bodyColor: "#bac9cc",
            titleFont: { family: "JetBrains Mono", size: 11 },
            bodyFont: { family: "JetBrains Mono", size: 10 },
            callbacks: {
              label: ctx => ` ${fmtRp(ctx.parsed.x)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#849396", font: { family: "JetBrains Mono", size: 9 }, callback: v => fmtRp(v) },
            grid: { color: "rgba(59,73,76,0.2)" },
          },
          y: {
            ticks: { color: "#bac9cc", font: { family: "JetBrains Mono", size: 10 } },
            grid: { display: false },
          },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  if (!depts.length) return <div className="skeleton h-[200px] rounded-xl"/>;
  return <div style={{ height: Math.max(depts.length * 28, 160), position: "relative" }}><canvas ref={canvasRef}/></div>;
}

/* ── Utilitas Pie Chart (Chart.js) ── */
function UtilitasPie({ items }) {
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);

  React.useEffect(() => {
    if (!canvasRef.current || !items.length) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");
    const colors = ["#ffb4ab","#00daf3","#cdcdf6","#d8b9ff","#9cf0ff","#fbbf24","#4ade80","#f87171"];

    chartRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: items.map(i => i.jenis),
        datasets: [{
          data: items.map(i => i.total),
          backgroundColor: colors.slice(0, items.length).map(c => c + "30"),
          borderColor: colors.slice(0, items.length),
          borderWidth: 1.5,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#bac9cc", font: { family: "JetBrains Mono", size: 9 }, boxWidth: 10, padding: 8 },
          },
          tooltip: {
            backgroundColor: "rgba(5,14,28,0.92)",
            borderColor: "rgba(0,218,243,0.25)",
            borderWidth: 1,
            titleColor: "#d4e4fa",
            bodyColor: "#bac9cc",
            titleFont: { family: "JetBrains Mono", size: 11 },
            bodyFont: { family: "JetBrains Mono", size: 10 },
            callbacks: {
              label: ctx => ` ${fmtRaw(ctx.parsed)}`,
            },
          },
        },
        cutout: "62%",
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [items]);

  if (!items.length) return <div className="skeleton h-[160px] rounded-xl"/>;
  return <div style={{ height: 160, position: "relative" }}><canvas ref={canvasRef}/></div>;
}

/* ── SDM Jabatan Chart ── */
function SdmChart({ items }) {
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);
  const top = (items || []).slice(0, 7);

  React.useEffect(() => {
    if (!canvasRef.current || !top.length) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");

    const grad = ctx.createLinearGradient(200, 0, 0, 0);
    grad.addColorStop(0, "rgba(216,185,255,0.6)");
    grad.addColorStop(1, "rgba(216,185,255,0.15)");

    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: top.map(j => j.jabatan?.length > 20 ? j.jabatan.slice(0, 20) + "…" : j.jabatan),
        datasets: [{
          label: "Total Kompensasi (jt)",
          data: top.map(j => Math.round(j.total / 1_000_000)),
          backgroundColor: grad,
          borderColor: "#d8b9ff",
          borderWidth: 1.5,
          borderRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(5,14,28,0.92)",
            borderColor: "rgba(216,185,255,0.3)",
            borderWidth: 1,
            titleColor: "#d8b9ff",
            bodyColor: "#bac9cc",
            titleFont: { family: "JetBrains Mono", size: 11 },
            bodyFont: { family: "JetBrains Mono", size: 10 },
            callbacks: {
              label: ctx => ` ${fmtRp(ctx.parsed.x)}`,
              afterLabel: (ctx) => {
                const item = top[ctx.dataIndex];
                return item ? ` ${item.count} orang` : "";
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#849396", font: { family: "JetBrains Mono", size: 9 }, callback: v => fmtRp(v) },
            grid: { color: "rgba(59,73,76,0.2)" },
          },
          y: {
            ticks: { color: "#bac9cc", font: { family: "JetBrains Mono", size: 10 } },
            grid: { display: false },
          },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [items]);

  if (!top.length) return <div className="skeleton h-[180px] rounded-xl"/>;
  return <div style={{ height: Math.max(top.length * 28, 140), position: "relative" }}><canvas ref={canvasRef}/></div>;
}

/* ── Top Obat Table ── */
function TopObatTable({ items }) {
  if (!items?.length) return <div className="skeleton h-[120px] rounded-xl"/>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full data-table">
        <thead>
          <tr>
            <th className="text-left">Nama Obat</th>
            <th className="text-left">Kategori</th>
            <th className="text-right">Biaya/Bulan</th>
            <th className="text-right">Stok</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="cursor-default">
              <td className="font-medium text-on-surface">{item.nama_obat || "—"}</td>
              <td className="text-on-surface-variant">{item.kategori_obat || "—"}</td>
              <td className="text-right font-mono text-primary-fixed-dim">{fmtRaw(item.biaya_pemakaian_bulan || 0)}</td>
              <td className="text-right font-mono text-on-surface-variant">{(item.stok_tersedia || 0).toLocaleString("id-ID")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Top Alat Table ── */
function TopAlatTable({ items }) {
  if (!items?.length) return <div className="skeleton h-[120px] rounded-xl"/>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full data-table">
        <thead>
          <tr>
            <th className="text-left">Nama Alat</th>
            <th className="text-left">Jenis</th>
            <th className="text-right">Depresiasi/Th</th>
            <th className="text-left">Kondisi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td className="font-medium text-on-surface">{item.nama_alat || "—"}</td>
              <td className="text-on-surface-variant">{item.jenis_alat || "—"}</td>
              <td className="text-right font-mono text-secondary">{fmtRaw(item.biaya_depresiasi_tahunan || 0)}</td>
              <td>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  item.kondisi === "Baik" ? "bg-green-500/15 text-green-400" :
                  item.kondisi === "Rusak" ? "bg-red-500/15 text-red-400" :
                  "bg-yellow-500/15 text-yellow-400"
                }`}>{item.kondisi || "—"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Card wrapper ── */
function Card({ title, icon, children, className = "", accent }) {
  return (
    <div className={`glass-card rounded-2xl border border-outline-variant/20 p-4 relative overflow-hidden ${className}`}>
      {accent && <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-30" style={{ background: accent }}/>}
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-3 relative z-10">
          {icon && <span className="material-symbols-outlined ms-sm text-on-surface-variant">{icon}</span>}
          {title && <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">{title}</span>}
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ── Dashboard Panel ── */
function DashboardPanel({ data, loading }) {
  const grand = data?.grand_total || 0;
  const grandDisplay = grand >= 1000
    ? "Rp " + (grand / 1000).toFixed(2).replace(".", ",") + " T"
    : "Rp " + (grand || 0).toLocaleString("id-ID") + " jt";

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-8 w-64 rounded-xl"/>
        <div className="dash-grid">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-[180px] rounded-2xl"/>)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full">

      {/* Grand Total Hero */}
      <div className="glass-card rounded-2xl border border-primary-container/20 p-5 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full blur-3xl" style={{ background: "rgba(0,229,255,0.08)" }}/>
        <div className="absolute -left-4 -bottom-4 w-32 h-32 rounded-full blur-3xl" style={{ background: "rgba(110,6,208,0.08)" }}/>
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Total Biaya Operasional</p>
            <div className="font-grotesk font-bold text-3xl text-primary-container tabular-nums">{grandDisplay}</div>
            <p className="font-mono text-[10px] text-on-surface-variant mt-1">Seluruh departemen · Semua periode</p>
          </div>
          <div className="flex-shrink-0">
            <DonutChart data={data}/>
          </div>
        </div>
      </div>

      {/* Trend & Dept side-by-side */}
      <div className="dash-grid">
        <Card title="Tren Biaya Operasional" icon="trending_up" accent="rgba(0,218,243,0.15)">
          <TrendChart data={data}/>
        </Card>
        <Card title="Biaya per Departemen" icon="apartment" accent="rgba(216,185,255,0.15)">
          <DeptChart data={data}/>
        </Card>
      </div>

      {/* Per-kategori + Utilitas */}
      <div className="dash-grid">
        <Card title="Breakdown per Kategori" icon="pie_chart" accent="rgba(156,240,255,0.1)">
          <KpiCards data={data}/>
        </Card>
        <Card title="Utilitas & Overhead" icon="bolt" accent="rgba(255,180,171,0.1)">
          <UtilitasPie items={data.utilitas_breakdown || []}/>
        </Card>
      </div>

      {/* SDM Jabatan */}
      <Card title="Kompensasi SDM per Jabatan" icon="group" accent="rgba(205,205,246,0.1)">
        <SdmChart items={data.top_sdm_jabatan || []}/>
      </Card>

      {/* Top tables */}
      <div className="dash-grid">
        <Card title="Top 5 Obat Biaya Tertinggi" icon="medication" accent="rgba(0,218,243,0.08)">
          <TopObatTable items={data.top_obat || []}/>
        </Card>
        <Card title="Top 5 Alat Medis Depresiasi Tertinggi" icon="build" accent="rgba(216,185,255,0.08)">
          <TopAlatTable items={data.top_alat || []}/>
        </Card>
      </div>

    </div>
  );
}

window.CostDashboard = DashboardPanel;
