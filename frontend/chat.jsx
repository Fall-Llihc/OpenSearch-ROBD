/* ============================================================
   Chat Components — messages, blocks, search indicator
   ============================================================ */

/* ---- Block renderers ---- */
function StatBlock({ items }) {
  return (
    <div className="stat-grid">
      {items.map((s, i) => (
        <div className={"stat-card" + (s.tone ? " " + s.tone : "")} key={i}>
          <div className="stat-val mono">{s.val}{s.u && <span className="u">{s.u}</span>}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function BillBlock({ amount, label, status, sub }) {
  return (
    <div className="bill-card">
      <div className="bill-top">
        <div>
          <div className="bill-amount mono">{amount}</div>
          <div className="bill-label">{label}</div>
        </div>
        {status && (
          <span className={"badge " + status.tone}>
            <span className="bdot"></span>{status.label}
          </span>
        )}
      </div>
      {sub && <div className="bill-sub"><Ico.Bill s={14} />{sub}</div>}
    </div>
  );
}

function EntityBlock({ title, items }) {
  return (
    <div>
      {title && <div className="meta-line" style={{ marginBottom: 8 }}><b>{title}</b></div>}
      <div className="entity-list">
        {items.map((e, i) => (
          <div className="entity-row" key={i}>
            <span className="entity-ava">
              {e.name.replace(/^dr\.?\s*/i, "").trim().slice(0, 2).toUpperCase()}
            </span>
            <div className="entity-main">
              <div className="entity-name">{e.name}</div>
              <div className="entity-desc">{e.desc}</div>
            </div>
            {e.tag && <span className="entity-tag">{e.tag}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecksBlock({ title, items }) {
  return (
    <div>
      {title && <div className="meta-line" style={{ marginBottom: 8 }}><b>{title}</b></div>}
      <div className="chk-list">
        {items.map((c, i) => (
          <div className="chk-item" key={i}>
            <span className="chk-ico"><Ico.Check s={16} /></span>
            <div>
              <div className="chk-name">{c.name}</div>
              {c.sub && <div className="chk-sub">{c.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcesBlock({ items }) {
  if (!items || !items.length) return null;
  return (
    <div className="sources">
      <span className="sources-label"><Ico.Index s={12} /> Sumber data</span>
      {items.map((s, i) => (
        <span className="src-chip" key={i}>
          {s.index} <span className="h">{s.hits} hits</span>
        </span>
      ))}
    </div>
  );
}

function Blocks({ blocks }) {
  return (
    <div className="blocks">
      {blocks.map((b, i) => {
        if (b.type === "text")     return <p className={b.lead ? "lead" : ""} key={i} style={{ marginTop: i === 0 ? 0 : 5 }}>{b.text}</p>;
        if (b.type === "stats")    return <StatBlock items={b.items} key={i} />;
        if (b.type === "bill")     return <BillBlock {...b} key={i} />;
        if (b.type === "entities") return <EntityBlock title={b.title} items={b.items} key={i} />;
        if (b.type === "checks")   return <ChecksBlock title={b.title} items={b.items} key={i} />;
        if (b.type === "sources")  return <SourcesBlock items={b.items} key={i} />;
        return null;
      })}
    </div>
  );
}

/* ---- Message ---- */
function Message({ m }) {
  const isUser = m.role === "user";
  return (
    <div className={"msg " + (isUser ? "user" : "bot") + (m.noAnim ? "" : " fade-up")}>
      <div className={"avatar " + (isUser ? "user" : "bot")}>
        {isUser ? <Ico.User s={17} /> : <Ico.Pulse s={19} />}
      </div>
      <div className="bubble-col">
        <div className="meta-line">
          <b>{isUser ? "Anda" : "Cost Analyst"}</b>
          {!isUser && <span>· Groq LLM</span>}
        </div>
        <div className="bubble">
          {typeof m.content === "string"
            ? <p>{m.content}</p>
            : <Blocks blocks={m.content} />}
        </div>
      </div>
    </div>
  );
}

/* ---- Search / Typing Indicator ---- */
function SearchIndicator({ indices }) {
  const STEPS = [
    "Menganalisis pertanyaan",
    "Mencari di indeks OpenSearch",
    "Menyusun jawaban dengan Groq LLM",
  ];
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 650);
    const t2 = setTimeout(() => setStep(2), 1550);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="msg bot fade-up">
      <div className="avatar bot"><Ico.Cross s={19} /></div>
      <div className="bubble-col">
        <div className="meta-line"><b>Cost Analyst</b> <span>· sedang bekerja</span></div>
        <div className="search-ind">
          <div className="search-line">
            <Ico.Spinner s={15} />
            {STEPS[step]}
            <span className="dots"><i></i><i></i><i></i></span>
          </div>
          {step >= 1 && (
            <div className="search-chips">
              {indices.map((ix, i) => (
                <span className={"search-chip" + (step === 1 ? " scanning" : "")} key={i}>{ix}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.ChatUI = { Message, SearchIndicator };
