/* ============================================================
   CostPulse — Chat Components  v3
   Smart visualization: auto-detect bar chart / table / line
   ============================================================ */

const fmtRp  = v => window.HData.formatRp(v, "jt");
const fmtRaw = v => window.HData.formatRp(v, "raw");

/* ── Inline Bar Chart in chat ── */
function InlineBarChart({ title, items }) {
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);

  React.useEffect(() => {
    if (!canvasRef.current || !items.length) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");

    const maxVal = Math.max(...items.map(i => i.val));
    const colors = items.map((_, idx) => {
      const palette = ["#00daf3","#d8b9ff","#9cf0ff","#cdcdf6","#ffb4ab","#fbbf24","#4ade80","#f472b6"];
      return palette[idx % palette.length];
    });

    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: items.map(i => i.label?.length > 18 ? i.label.slice(0, 18) + "…" : i.label),
        datasets: [{
          data: items.map(i => i.val),
          backgroundColor: colors.map(c => c + "28"),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 5,
          hoverBackgroundColor: colors.map(c => c + "55"),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: items.length > 5 ? "y" : "x",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(5,14,28,0.92)",
            borderColor: "rgba(0,218,243,0.25)",
            borderWidth: 1,
            titleColor: "#d4e4fa",
            bodyColor: "#bac9cc",
            titleFont: { family: "JetBrains Mono", size: 11 },
            bodyFont: { family: "JetBrains Mono", size: 11 },
            callbacks: {
              label: ctx => {
                const item = items[ctx.dataIndex];
                return item ? ` ${item.raw || fmtRp(item.val)}` : "";
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#849396",
              font: { family: "JetBrains Mono", size: 9 },
              callback: items.length <= 5 ? v => fmtRp(v) : undefined,
              maxRotation: 30,
            },
            grid: { color: "rgba(59,73,76,0.2)" },
          },
          y: {
            ticks: {
              color: "#849396",
              font: { family: "JetBrains Mono", size: 9 },
              callback: items.length > 5 ? v => fmtRp(v) : undefined,
            },
            grid: { color: "rgba(59,73,76,0.2)" },
          },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [items]);

  const isHoriz = items.length > 5;
  const h = isHoriz ? Math.max(items.length * 30, 140) : 180;

  return (
    <div className="mt-3 glass-card border border-outline-variant/25 rounded-xl p-4">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined ms-xs text-primary-container">bar_chart</span>
          <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">{title}</span>
        </div>
      )}
      <div style={{ height: h, position: "relative" }}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  );
}

/* ── Inline Table in chat ── */
function InlineTable({ title, cols, rows }) {
  return (
    <div className="mt-3 glass-card border border-outline-variant/25 rounded-xl overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 border-b border-outline-variant/20 flex items-center gap-2">
          <span className="material-symbols-outlined ms-xs text-secondary">table_chart</span>
          <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">{title}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>{cols.map((c, i) => <th key={i} className={i > 0 ? "text-right" : "text-left"}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={`${ci > 0 ? "text-right font-mono" : ""} ${ci === row.length - 1 && typeof cell === "string" && cell.includes("Rp") ? "text-primary-fixed-dim" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Sources block ── */
function SourcesBlock({ items }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-2.5 mt-2.5 border-t border-outline-variant/15">
      <span className="font-mono text-[9px] text-on-surface-variant flex items-center gap-1 mr-1">
        <span className="material-symbols-outlined ms-xs">storage</span>Sumber
      </span>
      {items.map((s, i) => (
        <span key={i} className="font-mono text-[10px] glass-card border border-outline-variant/30 rounded-full px-2 py-0.5 text-primary-fixed-dim">
          {s.index}
          {s.score !== undefined && <span className="text-on-surface-variant ml-1 opacity-50 text-[9px]">·{typeof s.score === "number" ? s.score.toFixed(2) : s.score}</span>}
        </span>
      ))}
    </div>
  );
}

/* ── Checks Block ── */
function ChecksBlock({ title, items }) {
  return (
    <div>
      {title && <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">{title}</p>}
      <div className="grid grid-cols-2 gap-2">
        {items.map((c, i) => (
          <div key={i} className="glass-card border border-outline-variant/20 rounded-xl px-3 py-2.5 flex items-start gap-2.5 glass-card-hover transition-all">
            <div className="w-5 h-5 rounded-full bg-primary-container/15 border border-primary-container/35 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-outlined ms-xs text-primary-container">check</span>
            </div>
            <div>
              <div className="text-on-surface text-xs font-medium leading-tight">{c.name}</div>
              {c.sub && <div className="font-mono text-[9px] text-on-surface-variant mt-0.5">{c.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Text block with highlighted numbers ── */
function TextBlock({ text, lead }) {
  /* Highlight Rp numbers */
  const highlighted = text.replace(
    /(Rp\s[\d.,]+(?:\s*[MjmtT](?:iliar|uta)?)?|\d[\d.,]+(?:\s*(?:juta|miliar|ribu|orang|item|tes|unit))?)/g,
    '<span class="num-highlight">$1</span>'
  );
  return (
    <p
      className={`text-sm leading-relaxed ${lead ? "text-on-surface font-medium" : "text-on-surface-variant"}`}
      style={{ whiteSpace: "pre-wrap" }}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

/* ── Blocks renderer ── */
function Blocks({ blocks }) {
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.type === "text")      return <TextBlock key={i} text={b.text} lead={b.lead}/>;
        if (b.type === "checks")    return <ChecksBlock key={i} title={b.title} items={b.items}/>;
        if (b.type === "sources")   return <SourcesBlock key={i} items={b.items}/>;
        if (b.type === "bar_chart") return <InlineBarChart key={i} title={b.title} items={b.items}/>;
        if (b.type === "table")     return <InlineTable key={i} title={b.title} cols={b.cols} rows={b.rows}/>;
        return null;
      })}
    </div>
  );
}

/* ── Message bubble ── */
function Message({ m }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex gap-3 items-start ${m.noAnim ? "" : "fade-up"} ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isUser
          ? "bg-gradient-to-br from-secondary-container to-secondary border border-secondary/30"
          : "bg-gradient-to-br from-primary-container/25 to-surface-container-high border border-primary-container/30"
      }`}>
        <span className="material-symbols-outlined ms-sm fill" style={{ color: isUser ? "#d8b9ff" : "#00daf3" }}>
          {isUser ? "person" : "monitor_heart"}
        </span>
      </div>

      {/* Content */}
      <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`font-mono text-[10px] flex gap-2 ${isUser ? "text-secondary" : "text-primary-container"}`}>
          <span className="font-semibold">{isUser ? "Anda" : "Cost Analyst"}</span>
          {!isUser && <span className="text-on-surface-variant opacity-70">· Groq LLM</span>}
        </div>
        <div className={`p-4 text-sm ${
          isUser
            ? "bubble-user glass-card border border-secondary/20 text-on-surface"
            : "bubble-bot glass-card border border-primary-container/15 text-on-surface"
        }`}>
          {isUser
            ? <p className="text-sm leading-relaxed">{m.content}</p>
            : typeof m.content === "string"
              ? <TextBlock text={m.content} lead={true}/>
              : <Blocks blocks={m.content}/>
          }
        </div>
      </div>
    </div>
  );
}

/* ── Search / Typing indicator ── */
function SearchIndicator({ indices }) {
  const STEPS = ["Menganalisis pertanyaan…", "Mencari di OpenSearch…", "Merangkum dengan Groq LLM…"];
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 700);
    const t2 = setTimeout(() => setStep(2), 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="flex gap-3 items-start fade-up">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-container/25 to-surface-container-high border border-primary-container/30 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined ms-sm text-primary-container spin">refresh</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] text-primary-container">Cost Analyst <span className="text-on-surface-variant opacity-70">· sedang bekerja</span></span>
        <div className="glass-card border border-primary-container/15 rounded-xl rounded-tl-sm p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="font-mono text-[11px]">{STEPS[step]}</span>
            <span className="dot-typing flex gap-1 ml-1"><i/><i/><i/></span>
          </div>
          {step >= 1 && (
            <div className="flex flex-wrap gap-1.5">
              {indices.map((ix, i) => (
                <span key={i} className="font-mono text-[9px] bg-primary-container/10 border border-primary-container/25 text-primary-container rounded-full px-2 py-0.5 animate-pulse">
                  {ix.replace("cost_", "")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.ChatUI = { Message, SearchIndicator };
