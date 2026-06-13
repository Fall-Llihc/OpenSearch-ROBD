/* ============================================================
   Chat Components — Stitch Design
   Glassmorphism bubbles · Material Symbols · JetBrains Mono
   ============================================================ */

function ChecksBlock({ title, items }) {
  return (
    <div>
      {title && <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">{title}</p>}
      <div className="space-y-2">
        {items.map((c,i)=>(
          <div key={i} className="glass-card border border-outline-variant/25 rounded-xl px-3 py-2.5 flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-primary-container/20 border border-primary-container/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-outlined ms-xs text-primary-container">check</span>
            </div>
            <div>
              <div className="text-on-surface text-sm font-medium leading-tight">{c.name}</div>
              {c.sub && <div className="font-mono text-[10px] text-on-surface-variant mt-0.5">{c.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcesBlock({ items }) {
  if(!items||!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-outline-variant/20">
      <span className="font-mono text-[9px] text-on-surface-variant flex items-center gap-1 mr-1">
        <span className="material-symbols-outlined ms-xs">storage</span>Sumber
      </span>
      {items.map((s,i)=>(
        <span key={i} className="font-mono text-[10px] glass-card border border-outline-variant/30 rounded-full px-2 py-0.5 text-primary-fixed-dim">
          {s.index}
          {s.hits!==undefined&&<span className="text-on-surface-variant ml-1 opacity-60">{s.hits}</span>}
        </span>
      ))}
    </div>
  );
}

function Blocks({ blocks }) {
  return (
    <div className="space-y-3">
      {blocks.map((b,i)=>{
        if(b.type==="text")    return <p key={i} className={"text-sm leading-relaxed "+(b.lead?"text-on-surface font-medium":"text-on-surface-variant")} style={{whiteSpace:"pre-wrap"}}>{b.text}</p>;
        if(b.type==="checks")  return <ChecksBlock key={i} title={b.title} items={b.items}/>;
        if(b.type==="sources") return <SourcesBlock key={i} items={b.items}/>;
        return null;
      })}
    </div>
  );
}

/* ── Message bubble ── */
function Message({ m }) {
  const isUser = m.role === "user";
  return (
    <div className={"flex gap-3 items-start "+(m.noAnim?"":"fade-up")+(isUser?" flex-row-reverse":"")}>

      {/* Avatar */}
      <div className={"w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 "+(
        isUser
          ? "bg-gradient-to-br from-secondary-container to-secondary border border-secondary/30"
          : "bg-gradient-to-br from-primary-container/30 to-surface-container-high border border-primary-container/30"
      )}>
        <span className="material-symbols-outlined ms-sm" style={{color: isUser?"#d8b9ff":"#00daf3"}}>
          {isUser ? "person" : "monitor_heart"}
        </span>
      </div>

      {/* Content */}
      <div className={"max-w-[78%] "+(isUser?"items-end":"items-start")+" flex flex-col gap-1"}>
        <div className={"font-mono text-[10px] flex gap-2 "+(isUser?"text-secondary":"text-primary-container")}>
          <span className="font-semibold">{isUser?"Anda":"Cost Analyst"}</span>
          {!isUser&&<span className="text-on-surface-variant">· Groq LLM</span>}
        </div>
        <div className={"p-4 text-sm "+(
          isUser
            ? "bubble-user bg-secondary-container/40 border border-secondary/25 text-on-surface"
            : "bubble-bot glass-card border border-primary-container/20 text-on-surface"
        )}>
          {isUser
            ? <p className="text-sm leading-relaxed">{m.content}</p>
            : typeof m.content==="string"
              ? <p className="text-sm leading-relaxed">{m.content}</p>
              : <Blocks blocks={m.content}/>
          }
        </div>
      </div>
    </div>
  );
}

/* ── Typing / Search indicator ── */
function SearchIndicator({ indices }) {
  const STEPS=["Menganalisis pertanyaan…","Mencari di OpenSearch…","Merangkum dengan Groq LLM…"];
  const [step,setStep]=React.useState(0);
  React.useEffect(()=>{
    const t1=setTimeout(()=>setStep(1),700);
    const t2=setTimeout(()=>setStep(2),1600);
    return ()=>{clearTimeout(t1);clearTimeout(t2);};
  },[]);
  return (
    <div className="flex gap-3 items-start fade-up">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-container/30 to-surface-container-high border border-primary-container/30 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined ms-sm text-primary-container spin">refresh</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] text-primary-container">Cost Analyst <span className="text-on-surface-variant">· sedang bekerja</span></span>
        <div className="glass-card border border-primary-container/20 rounded-xl rounded-tl-sm p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="font-mono text-[11px]">{STEPS[step]}</span>
            <span className="dot-typing flex gap-1 ml-1"><i/><i/><i/></span>
          </div>
          {step>=1&&(
            <div className="flex flex-wrap gap-1.5">
              {indices.map((ix,i)=>(
                <span key={i} className="font-mono text-[9px] bg-primary-container/10 border border-primary-container/25 text-primary-container rounded-full px-2 py-0.5 animate-pulse">
                  {ix.replace("cost_","")}
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
