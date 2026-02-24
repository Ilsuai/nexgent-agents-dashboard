import { useState, useEffect, useMemo, useCallback, Fragment, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from "recharts";

// ═══ API ═══
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
async function api(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...opts.headers } });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ═══ CSV PARSING (matches data/import-to-firestore.js) ═══
function parseCSVLine(line) {
  const fields = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ""; }
    else current += ch;
  }
  fields.push(current.trim());
  return fields;
}
function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    if (values.length < 2) return null;
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
    return row;
  }).filter(Boolean);
}
function mapTradeRow(row, agentId, mode) {
  const pnlStr = (row['Profit / Loss (USD)'] || '0').replace(/[+$,]/g, '');
  const changeStr = (row['Change (%)'] || '0%').replace(/[+%]/g, '');
  const timestamp = row['Time'] ? new Date(row['Time']).getTime() : Date.now();
  const id = `${agentId}_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id, agentId, mode,
    token: row['Token Symbol'] || '', tokenSymbol: row['Token Symbol'] || '',
    tokenAddress: row['Token Address'] || '', quantity: parseFloat(row['Amount']) || 0,
    entryPrice: parseFloat(row['Average Purchase Price (USD)']) || 0,
    exitPrice: parseFloat(row['Sale Price (USD)']) || 0,
    pnl: parseFloat(pnlStr) || 0, pnlPercent: parseFloat(changeStr) || 0,
    side: 'BUY', status: 'CLOSED', timestamp,
    signalId: row['Signal ID'] || '', signalType: row['Signal Type'] || '',
    activationReason: row['Activation Reason'] || '', source: 'nexgent',
  };
}
function mapSignalRow(row) {
  const timestamp = row['Created At'] ? new Date(row['Created At']).getTime() : Date.now();
  const id = row['Signal ID'] || `sig_${timestamp}`;
  return {
    id: String(id), signalReceivedAt: timestamp,
    token: row['Token Symbol'] || '', tokenSymbol: row['Token Symbol'] || '',
    tokenAddress: row['Token Address'] || '', tradingStrategy: row['Trading Strategy'] || '',
    activationReason: row['Activation Reason'] || '', source: row['Source'] || 'Nexgent AI',
    signalStrength: parseInt(row['Signal Strength']) || 0, status: 'received',
  };
}

// ═══ FIRESTORE → FRONTEND MAPPERS ═══
const AGENT_ID_MAP = { "nexgent-degen": "degen", "nexgent-pro": "pro", "nexgent-scalper": "scalper", "nexgent-base": "basetest", "nexgent-boost-hunter": "boosthunter", "nexgent-signal-sniper": "signalsniper", "nexgent-scalper-2": "scalper2", "nexgent-base-2": "basetest2", "nexgent-ignition-tester": "ignitiontester" };
const AGENT_ID_REVERSE = { degen: "nexgent-degen", pro: "nexgent-pro", scalper: "nexgent-scalper", basetest: "nexgent-base", boosthunter: "nexgent-boost-hunter", signalsniper: "nexgent-signal-sniper", scalper2: "nexgent-scalper-2", basetest2: "nexgent-base-2", ignitiontester: "nexgent-ignition-tester" };
function mapFirestoreTrade(t) {
  const agent = AGENT_ID_MAP[t.agentId] || t.agentId || "unknown";
  const mode = t.mode === "simulation" ? "sim" : t.mode === "live" ? "live" : (t.mode || "sim");
  const time = t.timestamp ? new Date(t.timestamp).toLocaleString() : "";
  return {
    id: t.id, agent, mode, token: t.token || t.tokenSymbol || "",
    time, pnlUsd: t.pnl || 0, changePct: t.pnlPercent || 0,
    signalType: t.signalType || "", signalStrength: t.signalStrength || 0,
    signalId: t.signalId || "", tokenAddress: t.tokenAddress || "",
    entryPrice: t.entryPrice || 0, exitPrice: t.exitPrice || 0,
  };
}
function mapFirestoreSignal(s) {
  const time = s.signalReceivedAt ? new Date(s.signalReceivedAt).toLocaleString() : "";
  return {
    id: s.id, type: s.tradingStrategy || "", strength: s.signalStrength || 0,
    token: s.token || s.tokenSymbol || "", timestamp: time,
    tokenAddress: s.tokenAddress || "", reason: s.activationReason || "",
  };
}

// ═══ THEME ═══
const THEMES = {
  light: {
    bg: "#f5f6f8", bgSidebar: "#ffffff", bgCard: "#ffffff", bgInput: "#f0f1f4", bgHover: "#f0f1f4",
    bgTableHead: "#f8f9fb", bgFilterBar: "#f8f9fb", bgCodeBlock: "#f4f5f7",
    border: "#e2e4e9", borderLight: "#eceef2", borderInput: "#d1d5db",
    text: "#111827", textSecondary: "#6b7280", textMuted: "#9ca3af", textFaint: "#c0c5ce",
    accent: "#6366f1", accentHover: "#4f46e5", accentBg: "#6366f110",
    scrollTrack: "#f5f6f8", scrollThumb: "#d1d5db", scrollThumbHover: "#9ca3af",
    positive: "#16a34a", negative: "#dc2626", warning: "#d97706",
    chevronFill: "%23999", modeLive: "#d97706", modeSim: "#6b7280",
  },
  dark: {
    bg: "#0f0f1a", bgSidebar: "#0a0a14", bgCard: "#141424", bgInput: "#0e0e1e", bgHover: "#1a1a30",
    bgTableHead: "#0c0c1c", bgFilterBar: "#0a0a18", bgCodeBlock: "#08081a",
    border: "#1e1e38", borderLight: "#141428", borderInput: "#2a2a48",
    text: "#e5e7eb", textSecondary: "#9ca3af", textMuted: "#6b7280", textFaint: "#3a3a50",
    accent: "#818cf8", accentHover: "#6366f1", accentBg: "#818cf810",
    scrollTrack: "#0f0f1a", scrollThumb: "#1e1e38", scrollThumbHover: "#2a2a48",
    positive: "#22c55e", negative: "#ef4444", warning: "#eab308",
    chevronFill: "%23505070", modeLive: "#eab308", modeSim: "#585878",
  },
};
function useTheme() {
  const [mode, setMode] = useState(() => localStorage.getItem("nexgent-theme") || "light");
  const toggle = useCallback(() => { setMode(prev => { const next = prev === "light" ? "dark" : "light"; localStorage.setItem("nexgent-theme", next); return next; }); }, []);
  return [THEMES[mode], mode, toggle];
}

// ═══ CONSTANTS ═══
const AG = {
  degen:{name:"Degen",abbr:"DG",tag:"Max Risk / Max Reward"},
  pro:{name:"Pro",abbr:"PR",tag:"Balanced / Smart Reward"},
  scalper:{name:"Scalper",abbr:"SC",tag:"Tight Risk / Max WR"},
  basetest:{name:"Base Test",abbr:"BT",tag:"Control / Defaults"},
  boosthunter:{name:"Boost Hunter",abbr:"BH",tag:"Dex Boost Focus"},
  signalsniper:{name:"Signal Sniper",abbr:"SS",tag:"High Signal Quality"},
  scalper2:{name:"Scalper 2.0",abbr:"S2",tag:"Refined Scalping"},
  basetest2:{name:"Base Test 2.0",abbr:"B2",tag:"Updated Control"},
  ignitiontester:{name:"Ignition Tester",abbr:"IT",tag:"Ignition Signals"},
};
const AK = Object.keys(AG);
const F = `'Inter','DM Sans',system-ui,sans-serif`;
const M = `'JetBrains Mono','Fira Code',monospace`;
const pc = (v, T) => v>0?(T?.positive||"#16a34a"):v<0?(T?.negative||"#dc2626"):(T?.textMuted||"#9ca3af");

// ═══ STATS ENGINE ═══
function calcStats(trades) {
  if(!trades.length) return {n:0,wins:0,losses:0,winRate:0,totalPnl:0,avgWinPct:0,avgLossPct:0,avgWinUsd:0,avgLossUsd:0,profitFactor:0,expectancy:0,avgReturn:0,avgReturnUsd:0,rr:0,grossWin:0,grossLoss:0,edgeScore:0};
  const w=trades.filter(t=>t.pnlUsd>0), l=trades.filter(t=>t.pnlUsd<0);
  const tp=trades.reduce((s,t)=>s+t.pnlUsd,0);
  const tpPct=trades.reduce((s,t)=>s+t.changePct,0);
  const aw=w.length?w.reduce((s,t)=>s+t.changePct,0)/w.length:0;
  const al=l.length?l.reduce((s,t)=>s+t.changePct,0)/l.length:0;
  const awU=w.length?w.reduce((s,t)=>s+t.pnlUsd,0)/w.length:0;
  const alU=l.length?l.reduce((s,t)=>s+t.pnlUsd,0)/l.length:0;
  const grossWin=w.reduce((s,t)=>s+t.pnlUsd,0);
  const grossLoss=Math.abs(l.reduce((s,t)=>s+t.pnlUsd,0));
  const wr=w.length/trades.length;
  const rr=Math.abs(al)>0?Math.abs(aw/al):0;
  const pf=grossLoss>0?grossWin/grossLoss:0;
  const avgReturn=tpPct/trades.length;
  const avgReturnUsd=tp/trades.length;
  const expectancy=wr*aw+(1-wr)*al;
  const edgeScore = expectancy * (1 + Math.log10(Math.max(pf,0.01))) * Math.min(trades.length/20,1);
  return {n:trades.length,wins:w.length,losses:l.length,
    winRate:wr*100, totalPnl:tp, avgWinPct:aw, avgLossPct:al,
    avgWinUsd:awU, avgLossUsd:alU, grossWin, grossLoss,
    profitFactor:pf, expectancy, avgReturn, avgReturnUsd, rr, edgeScore};
}

// ═══ UI PRIMITIVES ═══
const mkSelectBase = (T) => ({
  appearance:"none", WebkitAppearance:"none", background:T.bgInput,
  border:`1px solid ${T.borderInput}`, borderRadius:6, padding:"6px 28px 6px 10px",
  color:T.text, fontSize:11, fontFamily:F, cursor:"pointer", outline:"none",
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${T.chevronFill}'/%3E%3C/svg%3E")`,
  backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center",
});
const Select = ({value,onChange,children,style={},T}) => (
  <select value={value} onChange={e=>onChange(e.target.value)} style={{...mkSelectBase(T||THEMES.light),...style}}>{children}</select>
);
const FilterBar = ({children,T}) => (
  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",padding:"12px 16px",background:T.bgFilterBar,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:16}}>{children}</div>
);
const FilterLabel = ({children,T}) => <span style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:T.textMuted,marginRight:-2}}>{children}</span>;
const FilterDivider = ({T}) => <div style={{width:1,height:20,background:T.border,margin:"0 4px"}}/>;
const Badge = ({color,children,T}) => {const c=color||T?.accent||"#6366f1";return <span style={{display:"inline-block",padding:"2px 7px",borderRadius:4,background:`${c}14`,color:c,fontSize:10,fontWeight:600,fontFamily:M,letterSpacing:.3}}>{children}</span>;};
const ABadge = ({k,T}) => {const a=AG[k]; return a?<Badge color={T?.accent} T={T}>{a.abbr} {a.name}</Badge>:<Badge T={T}>{k}</Badge>;};
const Mono = ({children,style={}}) => <span style={{fontFamily:M,fontWeight:600,...style}}>{children}</span>;
const PnL = ({v,pct,T}) => <Mono style={{color:pc(v,T)}}>{v>=0?"+":""}{pct?`${v?.toFixed(1)}%`:`$${v?.toFixed(2)}`}</Mono>;
const Card = ({children,style={},accent,T}) => <div style={{background:T?.bgCard||"#fff",border:`1px solid ${T?.border||"#e2e4e9"}`,borderRadius:10,padding:20,marginBottom:16,borderTop:accent?`3px solid ${accent}`:undefined,...style}}>{children}</div>;
const CTitle = ({children,color,right,T}) => <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:color||T?.textMuted||"#9ca3af"}}>{children}</div>{right&&<div>{right}</div>}</div>;
const Stat = ({label,value,color,sub,T}) => <div style={{textAlign:"center",padding:"10px 4px"}}><div style={{fontSize:22,fontWeight:800,fontFamily:M,color:color||T?.text||"#111827",letterSpacing:-1}}>{value}</div><div style={{fontSize:8,color:T?.textMuted||"#9ca3af",marginTop:3,letterSpacing:1.2,textTransform:"uppercase"}}>{label}</div>{sub&&<div style={{fontSize:9,color:T?.textFaint||"#c0c5ce",marginTop:1}}>{sub}</div>}</div>;

// ═══ SORTABLE TABLE ═══
const TH = ({children,sortKey,currentSort,onSort,align,T}) => {
  const active = sortKey && currentSort && currentSort.key === sortKey;
  const dir = active ? currentSort.dir : null;
  const t = T || THEMES.light;
  return <th onClick={sortKey?()=>onSort(sortKey):undefined} style={{
    padding:"8px 10px",background:t.bgTableHead,color:active?t.text:t.textMuted,
    textAlign:align||"left",fontWeight:700,borderBottom:`2px solid ${t.border}`,whiteSpace:"nowrap",
    fontFamily:M,fontSize:9,letterSpacing:1,textTransform:"uppercase",
    cursor:sortKey?"pointer":"default",userSelect:"none",position:"relative",
    transition:"color .15s",
  }}>
    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
      {children}
      {sortKey && <span style={{fontSize:8,color:active?t.accent:t.textFaint,transition:"color .15s"}}>{dir==="asc"?"▲":dir==="desc"?"▼":"⇅"}</span>}
    </span>
  </th>;
};
const TD = ({children,style={},T}) => <td style={{padding:"7px 10px",borderBottom:`1px solid ${(T||THEMES.light).borderLight}`,color:(T||THEMES.light).textSecondary,fontSize:11,...style}}>{children}</td>;

function useSort(defaultKey="time",defaultDir="desc") {
  const [sort,setSort] = useState({key:defaultKey,dir:defaultDir});
  const toggle = useCallback((key)=>{
    setSort(prev => prev.key===key ? {key,dir:prev.dir==="desc"?"asc":"desc"} : {key,dir:"desc"});
  },[]);
  return [sort,toggle];
}

function sortTrades(trades,sort) {
  const s = [...trades];
  const dir = sort.dir==="asc"?1:-1;
  switch(sort.key) {
    case "time": return s.sort((a,b)=>dir*(new Date(a.time||0)-new Date(b.time||0)));
    case "pnl": return s.sort((a,b)=>dir*(a.pnlUsd-b.pnlUsd));
    case "pct": return s.sort((a,b)=>dir*(a.changePct-b.changePct));
    case "str": return s.sort((a,b)=>dir*(a.signalStrength-b.signalStrength));
    case "token": return s.sort((a,b)=>dir*a.token.localeCompare(b.token));
    default: return s;
  }
}

function TradeTable({trades,limit,sort,onSort,showAgent=true,showMode=true,T}) {
  const t_ = T || THEMES.light;
  const d = limit ? trades.slice(0,limit) : trades;
  if(!d.length) return <div style={{textAlign:"center",padding:"40px",color:t_.textFaint,fontSize:12}}>No trades match filters</div>;
  return <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
    <thead><tr>
      {showAgent&&<TH T={t_}>Agent</TH>}
      {showMode&&<TH T={t_}>Mode</TH>}
      <TH sortKey="token" currentSort={sort} onSort={onSort} T={t_}>Token</TH>
      <TH T={t_}>Signal</TH>
      <TH sortKey="str" currentSort={sort} onSort={onSort} align="center" T={t_}>Str</TH>
      <TH sortKey="pct" currentSort={sort} onSort={onSort} align="right" T={t_}>Δ%</TH>
      <TH sortKey="pnl" currentSort={sort} onSort={onSort} align="right" T={t_}>P/L</TH>
      <TH sortKey="time" currentSort={sort} onSort={onSort} T={t_}>Time</TH>
    </tr></thead>
    <tbody>{d.map((t,i)=><tr key={t.id} style={{background:i%2?t_.bgFilterBar:"transparent",transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background=t_.bgHover} onMouseLeave={e=>e.currentTarget.style.background=i%2?t_.bgFilterBar:"transparent"}>
      {showAgent&&<TD T={t_}><ABadge k={t.agent} T={t_}/></TD>}
      {showMode&&<TD T={t_}><Badge color={t.mode==="live"?t_.modeLive:t_.modeSim} T={t_}>{t.mode}</Badge></TD>}
      <TD style={{fontWeight:700,color:t_.text,fontFamily:M,fontSize:11}} T={t_}>{t.token}</TD>
      <TD T={t_}><Badge T={t_}>{(t.signalType||"").replace("Hyper Surge","HS").replace("Dormant Explosion","DE").replace("Price Reversal","PR").replace("Dex Boost","DB").replace(" (Pullback)"," ↩")}</Badge></TD>
      <TD style={{textAlign:"center"}} T={t_}><Mono style={{color:t.signalStrength>=4?t_.positive:t.signalStrength>=3?t_.warning:t.signalStrength>=2?"#f97316":t_.negative,fontSize:12}}>{t.signalStrength||"—"}</Mono></TD>
      <TD style={{textAlign:"right"}} T={t_}><PnL v={t.changePct} pct T={t_}/></TD>
      <TD style={{textAlign:"right"}} T={t_}><PnL v={t.pnlUsd} T={t_}/></TD>
      <TD style={{fontSize:9,color:t_.textMuted,fontFamily:M,whiteSpace:"nowrap"}} T={t_}>{t.time||"—"}</TD>
    </tr>)}</tbody>
  </table></div>;
}

// ═══════════════════════════════
// DASHBOARD
// ═══════════════════════════════
function Dashboard({trades,modeFilter,T}) {
  const ft = useMemo(()=>modeFilter==="all"?trades:trades.filter(t=>t.mode===modeFilter),[trades,modeFilter]);
  const stats = useMemo(()=>{const s={};AK.forEach(k=>{s[k]=calcStats(ft.filter(t=>t.agent===k));});s.all=calcStats(ft);return s;},[ft]);

  const stStats = useMemo(()=>{
    const m={};ft.forEach(t=>{const k=t.signalType||"?";if(!m[k])m[k]={type:k,n:0,w:0,pnl:0,pct:0};m[k].n++;if(t.pnlUsd>0)m[k].w++;m[k].pnl+=t.pnlUsd;m[k].pct+=t.changePct;});
    return Object.values(m).map(s=>({...s,wr:s.n?s.w/s.n*100:0,avg:s.n?s.pct/s.n:0})).sort((a,b)=>b.wr-a.wr);
  },[ft]);
  const strStats = useMemo(()=>{
    const m={};ft.forEach(t=>{const k=t.signalStrength||0;if(!m[k])m[k]={str:k,n:0,w:0,pnl:0,pct:0,wpct:0,lpct:0,wn:0,ln:0};m[k].n++;if(t.pnlUsd>0){m[k].w++;m[k].wpct+=t.changePct;m[k].wn++;}else{m[k].lpct+=t.changePct;m[k].ln++;}m[k].pnl+=t.pnlUsd;m[k].pct+=t.changePct;});
    return Object.values(m).map(s=>{const aw=s.wn?s.wpct/s.wn:0;const al=s.ln?s.lpct/s.ln:0;return {...s,wr:s.n?s.w/s.n*100:0,avg:s.n?s.pct/s.n:0,aw,al,rr:Math.abs(al)>0?Math.abs(aw/al):0};}).sort((a,b)=>a.str-b.str);
  },[ft]);
  const stStatsSorted = useMemo(()=>{
    return [...stStats].map(s=>{const ws=ft.filter(t=>t.signalType===s.type&&t.pnlUsd>0);const ls=ft.filter(t=>t.signalType===s.type&&t.pnlUsd<0);const aw=ws.length?ws.reduce((ac,t)=>ac+t.changePct,0)/ws.length:0;const al=ls.length?ls.reduce((ac,t)=>ac+t.changePct,0)/ls.length:0;return {...s,aw,al,rr:Math.abs(al)>0?Math.abs(aw/al):0};}).sort((a,b)=>b.avg-a.avg);
  },[stStats,ft]);
  const activeAK = AK.filter(k=>stats[k].n>0);
  const chartData = activeAK.map(k=>({name:AG[k].name,exp:+stats[k].expectancy.toFixed(2),rr:+stats[k].rr.toFixed(2),avg:+stats[k].avgReturn.toFixed(2),pnl:+stats[k].totalPnl.toFixed(2),wr:+stats[k].winRate.toFixed(1),pf:+stats[k].profitFactor.toFixed(2)}));
  const [sort,onSort] = useSort();

  return <div>
    <Card T={T} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
      <Stat label="Trades" value={stats.all.n} T={T}/>
      <Stat label="Avg Return" value={`${stats.all.avgReturn>=0?"+":""}${stats.all.avgReturn.toFixed(2)}%`} color={pc(stats.all.avgReturn,T)} sub="per trade" T={T}/>
      <Stat label="Expectancy" value={`${stats.all.expectancy>=0?"+":""}${stats.all.expectancy.toFixed(2)}%`} color={pc(stats.all.expectancy,T)} sub="expected per trade" T={T}/>
      <Stat label="R:R Ratio" value={stats.all.rr>0?`${stats.all.rr.toFixed(2)}x`:"—"} color={stats.all.rr>=1?T.positive:T.negative} sub={`+${stats.all.avgWinPct.toFixed(0)}% / ${stats.all.avgLossPct.toFixed(0)}%`} T={T}/>
      <Stat label="Win Rate" value={`${stats.all.winRate.toFixed(1)}%`} color={stats.all.winRate>=50?T.positive:T.negative} T={T}/>
      <Stat label="Profit Factor" value={stats.all.profitFactor>0?stats.all.profitFactor.toFixed(2):"—"} color={stats.all.profitFactor>=1?T.positive:T.negative} sub={`$${stats.all.grossWin.toFixed(0)} / $${stats.all.grossLoss.toFixed(0)}`} T={T}/>
      <Stat label="Total P/L" value={`${stats.all.totalPnl>=0?"+":""}$${stats.all.totalPnl.toFixed(0)}`} color={pc(stats.all.totalPnl,T)} T={T}/>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(activeAK.length,4)},1fr)`,gap:12,marginBottom:16}}>
      {activeAK.map(k=>({k,s:stats[k],a:AG[k]})).sort((a,b)=>b.s.expectancy-a.s.expectancy).map(({k,s,a},rank)=> <Card key={k} accent={T.accent} T={T} style={{marginBottom:0,padding:16,position:"relative"}}>
        <div style={{position:"absolute",top:8,right:10,fontSize:9,fontFamily:M,fontWeight:700,color:rank===0?T.positive:rank===activeAK.length-1?T.negative:T.textMuted}}>#{rank+1}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><span style={{fontSize:10,fontWeight:800,fontFamily:M,color:T.accent,background:T.accentBg,padding:"2px 6px",borderRadius:4}}>{a.abbr}</span><div><div style={{fontSize:12,fontWeight:700,color:T.text}}>{a.name}</div></div></div>
        <div style={{textAlign:"center",padding:"6px 0 10px",borderBottom:`1px solid ${T.borderLight}`,marginBottom:8}}>
          <div style={{fontSize:20,fontWeight:800,fontFamily:M,color:pc(s.expectancy,T),letterSpacing:-1}}>{s.expectancy>=0?"+":""}{s.expectancy.toFixed(2)}%</div>
          <div style={{fontSize:8,color:T.textMuted,letterSpacing:1.5,textTransform:"uppercase",marginTop:2}}>Expectancy / Trade</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,fontSize:10}}>
          {[
            ["Avg Return",`${s.avgReturn>=0?"+":""}${s.avgReturn.toFixed(2)}%`,pc(s.avgReturn,T)],
            ["R:R Ratio",s.rr>0?`${s.rr.toFixed(2)}x`:"—",s.rr>=1?T.positive:T.negative],
            ["Win Rate",`${s.winRate.toFixed(1)}%`,pc(s.winRate-50,T)],
            ["PF",s.profitFactor>0?s.profitFactor.toFixed(2):"—",s.profitFactor>=1?T.positive:T.negative],
            ["Trades",s.n,T.textSecondary],
            ["P/L",`${s.totalPnl>=0?"+":""}$${s.totalPnl.toFixed(0)}`,pc(s.totalPnl,T)],
          ].map(([l,v,c])=><Fragment key={l}><div style={{color:T.textMuted,padding:"2px 0"}}>{l}</div><div style={{textAlign:"right",fontFamily:M,fontWeight:600,padding:"2px 0",color:c}}>{v}</div></Fragment>)}
        </div>
      </Card>)}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
      <Card T={T}><CTitle T={T}>Expectancy / Trade (%)</CTitle><ResponsiveContainer width="100%" height={180}><BarChart data={chartData} barSize={24}><CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/><XAxis dataKey="name" tick={{fontSize:10,fill:T.textMuted}}/><YAxis tick={{fontSize:10,fill:T.textMuted}}/><Tooltip contentStyle={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:6,fontSize:11,color:T.text}} formatter={v=>[`${v}%`,"Expectancy"]}/><Bar dataKey="exp" radius={[4,4,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.exp>=0?T.accent:T.negative}/>)}</Bar></BarChart></ResponsiveContainer><div style={{textAlign:"center",fontSize:9,color:T.textFaint,marginTop:-2}}>WR x Avg Win + (1-WR) x Avg Loss</div></Card>
      <Card T={T}><CTitle T={T}>R:R Ratio (Win Size / Loss Size)</CTitle><ResponsiveContainer width="100%" height={180}><BarChart data={chartData} barSize={24}><CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/><XAxis dataKey="name" tick={{fontSize:10,fill:T.textMuted}}/><YAxis tick={{fontSize:10,fill:T.textMuted}} domain={[0,'auto']}/><Tooltip contentStyle={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:6,fontSize:11,color:T.text}} formatter={v=>[`${v}x`,"R:R"]}/><Bar dataKey="rr" radius={[4,4,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.rr>=1?T.accent:T.negative}/>)}</Bar></BarChart></ResponsiveContainer><div style={{textAlign:"center",fontSize:9,color:T.textFaint,marginTop:-2}}>Above 1.0x = wins bigger than losses</div></Card>
      <Card T={T}><CTitle T={T}>Total P/L ($)</CTitle><ResponsiveContainer width="100%" height={180}><BarChart data={chartData} barSize={24}><CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/><XAxis dataKey="name" tick={{fontSize:10,fill:T.textMuted}}/><YAxis tick={{fontSize:10,fill:T.textMuted}}/><Tooltip contentStyle={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:6,fontSize:11,color:T.text}} formatter={v=>[`$${v}`,"P/L"]}/><Bar dataKey="pnl" radius={[4,4,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.pnl>=0?T.accent:T.negative}/>)}</Bar></BarChart></ResponsiveContainer></Card>
    </div>

    <Card T={T}><CTitle color={T.warning} T={T}>Signal Strength vs Performance</CTitle>
      <div style={{fontSize:11,color:T.textSecondary,marginBottom:14,lineHeight:1.6,padding:"10px 14px",background:`${T.warning}08`,borderLeft:`3px solid ${T.warning}60`,borderRadius:"0 6px 6px 0"}}>
        <strong style={{color:T.warning}}>Counterintuitive:</strong> Higher strength = <em>worse</em> avg return. Str 4 has the worst expectancy despite being "strongest". Str 1-2 lose less per trade.
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Str","Trades","Win Rate","Avg Return","R:R","Avg Win","Avg Loss","Total P/L"].map(h=><TH key={h} T={T}>{h}</TH>)}</tr></thead><tbody>{strStats.filter(s=>s.str>0).map(s=><tr key={s.str}><TD T={T}><Mono style={{color:s.str>=4?T.positive:s.str>=3?T.warning:s.str>=2?"#f97316":T.negative,fontSize:14,fontWeight:800}}>{s.str}</Mono></TD><TD T={T}><Mono>{s.n}</Mono></TD><TD T={T}><Mono style={{color:pc(s.wr-50,T)}}>{s.wr.toFixed(1)}%</Mono></TD><TD T={T}><Mono style={{color:pc(s.avg,T),fontWeight:700,fontSize:12}}>{s.avg>=0?"+":""}{s.avg.toFixed(2)}%</Mono></TD><TD T={T}><Mono style={{color:s.rr>=1?T.positive:T.negative}}>{s.rr.toFixed(2)}x</Mono></TD><TD T={T}><Mono style={{color:T.positive}}>+{s.aw.toFixed(1)}%</Mono></TD><TD T={T}><Mono style={{color:T.negative}}>{s.al.toFixed(1)}%</Mono></TD><TD T={T}><PnL v={s.pnl} T={T}/></TD></tr>)}</tbody></table>
    </Card>

    <Card T={T}><CTitle T={T}>Signal Type Performance</CTitle>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Signal","Trades","Win Rate","Avg Return","Avg Win","Avg Loss","R:R","P/L"].map(h=><TH key={h} T={T}>{h}</TH>)}</tr></thead><tbody>{stStatsSorted.map(s=><tr key={s.type}><TD T={T}><Badge color={s.avg>=0?T.positive:s.avg>=-2?T.warning:T.negative} T={T}>{s.type}</Badge></TD><TD T={T}><Mono>{s.n}</Mono></TD><TD T={T}><Mono style={{color:pc(s.wr-50,T)}}>{s.wr.toFixed(1)}%</Mono></TD><TD T={T}><Mono style={{color:pc(s.avg,T),fontWeight:700,fontSize:12}}>{s.avg>=0?"+":""}{s.avg.toFixed(2)}%</Mono></TD><TD T={T}><Mono style={{color:T.positive}}>+{s.aw.toFixed(1)}%</Mono></TD><TD T={T}><Mono style={{color:T.negative}}>{s.al.toFixed(1)}%</Mono></TD><TD T={T}><Mono style={{color:s.rr>=1?T.positive:T.negative}}>{s.rr.toFixed(2)}x</Mono></TD><TD T={T}><PnL v={s.pnl} T={T}/></TD></tr>)}</tbody></table>
    </Card>

    <Card T={T}><CTitle T={T}>Recent Trades</CTitle><TradeTable trades={sortTrades(ft,sort)} limit={20} sort={sort} onSort={onSort} T={T}/></Card>
  </div>;
}

// ═══════════════════════════════
// TRADES PAGE
// ═══════════════════════════════
function TradesPage({trades,modeFilter,T}) {
  const SIGNAL_TYPES = useMemo(() => [...new Set(trades.map(t=>t.signalType).filter(Boolean))], [trades]);
  const [fa,setFa]=useState("all");
  const [fm,setFm]=useState(modeFilter);
  const [fs,setFs]=useState("all");
  const [fst,setFst]=useState("all");
  const [fstr,setFstr]=useState("all");
  const [sort,onSort]=useSort("time","desc");
  const [limit,setLimit]=useState(50);

  const filtered = useMemo(()=>{
    let r=[...trades];
    if(fm!=="all") r=r.filter(t=>t.mode===fm);
    if(fa!=="all") r=r.filter(t=>t.agent===fa);
    if(fs==="win") r=r.filter(t=>t.pnlUsd>0);
    if(fs==="loss") r=r.filter(t=>t.pnlUsd<0);
    if(fst!=="all") r=r.filter(t=>t.signalType===fst);
    if(fstr!=="all") r=r.filter(t=>String(t.signalStrength)===fstr);
    return sortTrades(r,sort);
  },[trades,fm,fa,fs,fst,fstr,sort]);

  const st = useMemo(()=>calcStats(filtered),[filtered]);

  return <div>
    <FilterBar T={T}>
      <FilterLabel T={T}>Agent</FilterLabel>
      <Select value={fa} onChange={setFa} T={T}>
        <option value="all">All Agents</option>
        {AK.map(k=><option key={k} value={k}>{AG[k].abbr} {AG[k].name}</option>)}
      </Select>
      <FilterDivider T={T}/>
      <FilterLabel T={T}>Mode</FilterLabel>
      <Select value={fm} onChange={setFm} T={T}>
        <option value="all">All Modes</option>
        <option value="live">Live</option>
        <option value="sim">Simulation</option>
      </Select>
      <FilterDivider T={T}/>
      <FilterLabel T={T}>Outcome</FilterLabel>
      <Select value={fs} onChange={setFs} T={T}>
        <option value="all">All Outcomes</option>
        <option value="win">Winners</option>
        <option value="loss">Losers</option>
      </Select>
      <FilterDivider T={T}/>
      <FilterLabel T={T}>Signal</FilterLabel>
      <Select value={fst} onChange={setFst} T={T}>
        <option value="all">All Signals</option>
        {SIGNAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
      </Select>
      <FilterDivider T={T}/>
      <FilterLabel T={T}>Strength</FilterLabel>
      <Select value={fstr} onChange={setFstr} T={T}>
        <option value="all">Any</option>
        {[1,2,3,4].map(s=><option key={s} value={String(s)}>&#8805; {s}</option>)}
      </Select>
    </FilterBar>

    <Card T={T} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,padding:14,marginBottom:14}}>
      <Stat label="Showing" value={filtered.length} sub={`of ${trades.length}`} T={T}/>
      <Stat label="Avg Return" value={`${st.avgReturn>=0?"+":""}${st.avgReturn.toFixed(2)}%`} color={pc(st.avgReturn,T)} sub="per trade" T={T}/>
      <Stat label="Expectancy" value={`${st.expectancy>=0?"+":""}${st.expectancy.toFixed(2)}%`} color={pc(st.expectancy,T)} T={T}/>
      <Stat label="R:R" value={st.rr>0?`${st.rr.toFixed(2)}x`:"---"} color={st.rr>=1?T.positive:T.negative} T={T}/>
      <Stat label="Win Rate" value={`${st.winRate.toFixed(1)}%`} color={pc(st.winRate-50,T)} T={T}/>
      <Stat label="PF" value={st.profitFactor>0?st.profitFactor.toFixed(2):"---"} color={st.profitFactor>=1?T.positive:T.negative} T={T}/>
      <Stat label="P/L" value={`${st.totalPnl>=0?"+":""}$${st.totalPnl.toFixed(0)}`} color={pc(st.totalPnl,T)} T={T}/>
    </Card>

    <Card T={T}><TradeTable trades={filtered} limit={limit} sort={sort} onSort={onSort} T={T}/></Card>
    {filtered.length>limit&&<div style={{textAlign:"center",padding:12}}>
      <button onClick={()=>setLimit(l=>l+50)} style={{background:T.bgInput,border:`1px solid ${T.borderInput}`,borderRadius:6,padding:"8px 24px",color:T.textSecondary,cursor:"pointer",fontSize:11,fontFamily:F}}>Load more ({filtered.length-limit} remaining)</button>
    </div>}
  </div>;
}

// ═══════════════════════════════
// SIGNALS PAGE
// ═══════════════════════════════
function SignalsPage({signals,T}) {
  const [ft,setFt]=useState("all");
  const [fstr,setFstr]=useState("all");
  const [sort,setSort]=useState("newest");
  const types=useMemo(()=>{const m={};signals.forEach(s=>{if(!s.type)return;if(!m[s.type])m[s.type]={n:0,str:0};m[s.type].n++;m[s.type].str+=s.strength;});return Object.entries(m).map(([t,v])=>({type:t,n:v.n,avg:(v.str/v.n).toFixed(1)})).sort((a,b)=>b.n-a.n);},[signals]);
  const filtered=useMemo(()=>{
    let r=[...signals];
    if(ft!=="all") r=r.filter(s=>s.type===ft);
    if(fstr!=="all") r=r.filter(s=>String(s.strength)===fstr);
    if(sort==="newest") r.sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0));
    if(sort==="oldest") r.sort((a,b)=>new Date(a.timestamp||0)-new Date(b.timestamp||0));
    if(sort==="str_desc") r.sort((a,b)=>b.strength-a.strength);
    if(sort==="str_asc") r.sort((a,b)=>a.strength-b.strength);
    return r;
  },[signals,ft,fstr,sort]);

  return <div>
    <FilterBar T={T}>
      <FilterLabel T={T}>Signal Type</FilterLabel>
      <Select value={ft} onChange={setFt} T={T}>
        <option value="all">All Types ({signals.length})</option>
        {types.map(t=><option key={t.type} value={t.type}>{t.type} ({t.n})</option>)}
      </Select>
      <FilterDivider T={T}/>
      <FilterLabel T={T}>Strength</FilterLabel>
      <Select value={fstr} onChange={setFstr} T={T}>
        <option value="all">Any</option>
        {[1,2,3,4].map(s=><option key={s} value={String(s)}>{s}</option>)}
      </Select>
      <FilterDivider T={T}/>
      <FilterLabel T={T}>Sort</FilterLabel>
      <Select value={sort} onChange={setSort} T={T}>
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="str_desc">Strength desc</option>
        <option value="str_asc">Strength asc</option>
      </Select>
      <FilterDivider T={T}/>
      <span style={{fontSize:10,color:T.textMuted,fontFamily:M}}>{filtered.length} signals</span>
    </FilterBar>

    <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(Math.max(types.length,1),5)},1fr)`,gap:10,marginBottom:16}}>
      {types.map(t=><Card key={t.type} T={T} style={{padding:12,marginBottom:0,cursor:"pointer",border:ft===t.type?`1px solid ${T.accent}`:`1px solid ${T.border}`}} onClick={()=>setFt(ft===t.type?"all":t.type)}>
        <div style={{fontSize:11,fontWeight:700,color:T.text}}>{t.type}</div>
        <div style={{display:"flex",gap:12,marginTop:4}}>
          <span style={{fontSize:9,color:T.textSecondary}}>{t.n} signals</span>
          <span style={{fontSize:9,color:T.textSecondary}}>avg str {t.avg}</span>
        </div>
      </Card>)}
    </div>

    <Card T={T}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Type","Str","Token","Details","Time"].map(h=><TH key={h} T={T}>{h}</TH>)}</tr></thead><tbody>{filtered.slice(0,80).map((s,i)=><tr key={s.id||i} style={{background:i%2?T.bgFilterBar:"transparent"}} onMouseEnter={e=>e.currentTarget.style.background=T.bgHover} onMouseLeave={e=>e.currentTarget.style.background=i%2?T.bgFilterBar:"transparent"}><TD T={T}><Badge T={T}>{s.type?.replace("Hyper Surge","HS").replace("Dormant Explosion","DE").replace("Price Reversal","PR").replace("Dex Boost","DB").replace(" (Pullback)"," PB")}</Badge></TD><TD T={T}><Mono style={{color:s.strength>=4?T.positive:s.strength>=3?T.warning:s.strength>=2?"#f97316":T.negative,fontSize:13,fontWeight:800}}>{s.strength}</Mono></TD><TD style={{fontWeight:700,color:T.text,fontFamily:M,fontSize:11}} T={T}>{s.token}</TD><TD style={{fontSize:10,color:T.textMuted,maxWidth:320,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} T={T}>{s.reason||"---"}</TD><TD style={{fontSize:9,color:T.textMuted,fontFamily:M,whiteSpace:"nowrap"}} T={T}>{s.timestamp}</TD></tr>)}</tbody></table></div></Card>
  </div>;
}

// ═══════════════════════════════
// AGENTS PAGE
// ═══════════════════════════════
function AgentsPage({trades,modeFilter,T}) {
  const [sel,setSel]=useState("degen");
  const [tab,setTab]=useState("Purchase & Position");
  const a = AG[sel];
  const ft=useMemo(()=>(modeFilter==="all"?trades:trades.filter(t=>t.mode===modeFilter)).filter(t=>t.agent===sel),[trades,modeFilter,sel]);
  const s=useMemo(()=>calcStats(ft),[ft]);
  const TABS=["Purchase & Position","Signals","Risk Management","Stop Loss","Take-Profit","DCA","Stale Trade"];
  const AGENT_DESCRIPTIONS={
    degen:"Accept every signal, trade anything, ride to big multipliers.",
    pro:"Balanced — strict filters, offset stop losses, stale trade closure.",
    scalper:"Quick in/out — tight stops, ultra-early profit-taking.",
    basetest:"Control benchmark — all defaults, Exponential Decay, no TP.",
    boosthunter:"Targets Dex Boost signals — filters for boosted tokens only.",
    signalsniper:"High signal quality filter — only trades top-tier signals.",
    scalper2:"Refined scalping v2 — optimized TP/SL from Scalper learnings.",
    basetest2:"Updated control v2 — revised defaults for Analytics 2.0.",
    ignitiontester:"Ignition signal specialist — tests ignition-type signals.",
  };
  const configs={
    degen:{"Purchase & Position":[{l:"Max Slippage",v:"3%",n:"Tight — prevents overpaying"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2",n:"0.2-3 SOL"},{l:"Medium from",v:"3",n:"3-7 SOL"},{l:"Large from",v:"7",n:"7+ SOL"},{d:"Position Size per Range"},{l:"Small",v:"0.3-0.5",n:"Up to ~25% of balance"},{l:"Medium",v:"0.5-1.0",n:"Up to ~30% per trade"},{l:"Large",v:"1.0-1.5"},{l:"Randomization",v:"ON"}],
      Signals:[{l:"Min Strength",v:"1 (All)",n:"Every signal triggers"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"No Filter"},{d:"Token Metrics"},{l:"Min Mcap",v:"---"},{l:"Min Liq",v:"---"},{l:"Min Holders",v:"---"},{i:"Pure exposure — trades everything."}],
      "Stop Loss":[{l:"Enabled",v:"ON"},{l:"Default",v:"-20%"},{l:"Strategy",v:"Custom"},{i:"Custom levels avoid Exponential Decay clustering."},{d:"Custom Levels (desc)"},{t:[["Price Up","SL%"],["300%","92%"],["200%","85%"],["100%","65%"],["50%","20%"],["25%","3%"]]}],
      "Take-Profit":[{l:"Enabled",v:"ON"},{l:"Strategy",v:"Custom"},{d:"Levels"},{t:[["Target","Sell%"],["100%","20%"],["200%","20%"],["400%","20%"],["600%","20%"]]},{i:"80% sold. 20% moon bag at 400%."},{l:"Moon Bag",v:"ON — 20% at 400%"}],
      DCA:[{l:"Enabled",v:"OFF"},{i:"DCA multiplies losses on rugs."}],
      "Stale Trade":[{l:"Enabled",v:"OFF"},{i:"Moonshots take hours — never cut short."}]},
    pro:{"Purchase & Position":[{l:"Max Slippage",v:"3%"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2"},{l:"Medium from",v:"3"},{l:"Large from",v:"7"},{d:"Position Size"},{l:"Small",v:"0.2-0.3"},{l:"Medium",v:"0.3-0.5",n:"~10-15% per trade"},{l:"Large",v:"0.5-1.0"},{l:"Randomization",v:"ON"}],
      Signals:[{l:"Min Strength",v:"2",n:"Filters weakest ~20%"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"No Filter (uses metrics)"},{d:"Token Metrics"},{l:"Min Mcap",v:"$50,000"},{l:"Min Liq",v:"$15,000"},{l:"Min Holders",v:"200"},{i:"Strict — filters rugs and bots."}],
      "Stop Loss":[{l:"Enabled",v:"ON"},{l:"Default",v:"-15%"},{l:"Strategy",v:"Custom"},{i:"Offset from Step-Based Zones to avoid cascades."},{d:"Custom Levels"},{t:[["Price Up","SL%"],["250%","88%"],["120%","60%"],["60%","28%"],["30%","10%"],["15%","2%"]]}],
      "Take-Profit":[{l:"Enabled",v:"ON"},{l:"Strategy",v:"Custom"},{i:"Exits before Moderate preset walls."},{d:"Levels"},{t:[["Target","Sell%"],["40%","25%"],["130%","25%"],["270%","25%"],["370%","15%"]]},{i:"90% sold. 10% moon bag at 270%."},{l:"Moon Bag",v:"ON — 10% at 270%"}],
      DCA:[{l:"Enabled",v:"OFF"}],
      "Stale Trade":[{l:"Enabled",v:"ON"},{l:"Hold Time",v:"120 min"},{l:"P/L Range",v:"1%-10%"},{i:"After 2hrs, 1-10% trades auto-closed."}]},
    scalper:{"Purchase & Position":[{l:"Max Slippage",v:"3%"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2"},{l:"Medium from",v:"3"},{l:"Large from",v:"7"},{d:"Position Size"},{l:"Small",v:"0.2-0.3"},{l:"Medium",v:"0.3-0.5",n:"-10% SL caps risk to ~1.5%"},{l:"Large",v:"0.5-1.0"},{l:"Randomization",v:"ON"}],
      Signals:[{l:"Min Strength",v:"3",n:"Quality — filters bottom ~40%"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"No Filter (uses metrics)"},{d:"Token Metrics"},{l:"Min Mcap",v:"$10,000"},{l:"Min Liq",v:"$5,000"},{l:"Min Holders",v:"50"}],
      "Stop Loss":[{l:"Enabled",v:"ON"},{l:"Default",v:"-10%",n:"Tightest of all"},{l:"Strategy",v:"Custom"},{d:"Custom Levels"},{t:[["Price Up","SL%"],["150%","85%"],["100%","65%"],["50%","30%"],["20%","8%"],["10%","2%"]]},{i:"Once up 10%, can NEVER lose money."}],
      "Take-Profit":[{l:"Enabled",v:"ON"},{l:"Strategy",v:"Custom — ultra-aggressive"},{d:"Levels"},{t:[["Target","Sell%"],["5%","30%"],["15%","30%"],["35%","25%"],["60%","15%"]]},{i:"100% sold. No moon bag."},{l:"Moon Bag",v:"OFF"}],
      DCA:[{l:"Enabled",v:"OFF"}],
      "Stale Trade":[{l:"Enabled",v:"ON"},{l:"Hold Time",v:"60 min"},{l:"P/L Range",v:"1%-8%"},{i:"After 1hr, 1-8% trades auto-closed."}]},
    basetest:{"Purchase & Position":[{l:"Max Slippage",v:"5%",n:"Default — wider than custom (3%)"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2",n:"0.2-5 SOL"},{l:"Medium from",v:"5"},{l:"Large from",v:"10"},{d:"Position Size"},{l:"Small",v:"0.2-0.5"},{l:"Medium",v:"0.5-1.0"},{l:"Large",v:"1.0-1.5"},{l:"Randomization",v:"ON"}],
      Signals:[{l:"Min Strength",v:"1 (All)",n:"Same as Degen"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"No Filter"},{d:"Token Metrics"},{l:"Min Mcap",v:"---"},{l:"Min Liq",v:"---"},{l:"Min Holders",v:"---"},{i:"No filters — benchmark."}],
      "Stop Loss":[{l:"Enabled",v:"ON"},{l:"Default",v:"-32%",n:"Wider than custom agents"},{l:"Strategy",v:"Exponential Decay (PRESET)"},{i:"Same preset most users run."},{d:"Behavior"},{t:[["Price Up","SL Set At"],["+10%","-32%"],["+25%","3.7%"],["+50%","30.8%"],["+100%","90%"]]}],
      "Take-Profit":[{l:"Enabled",v:"OFF"},{i:"No TP — relies on stop loss only."}],
      DCA:[{l:"Enabled",v:"OFF"}],
      "Stale Trade":[{l:"Enabled",v:"ON"},{l:"Hold Time",v:"60 min"},{l:"P/L Range",v:"1%-10%"}]},
    boosthunter:{"Purchase & Position":[{l:"Max Slippage",v:"3%"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2"},{l:"Medium from",v:"3"},{l:"Large from",v:"7"},{d:"Position Size"},{l:"Small",v:"0.2-0.4"},{l:"Medium",v:"0.4-0.8"},{l:"Large",v:"0.8-1.2"},{l:"Randomization",v:"ON"}],
      Signals:[{l:"Min Strength",v:"2"},{l:"Signal Types",v:"Dex Boost only",n:"Filters for boosted tokens"}],
      "Risk Management":[{l:"Filter Mode",v:"Metrics"},{d:"Token Metrics"},{l:"Min Mcap",v:"$25,000"},{l:"Min Liq",v:"$10,000"},{l:"Min Holders",v:"100"}],
      "Stop Loss":[{l:"Enabled",v:"ON"},{l:"Default",v:"-18%"},{l:"Strategy",v:"Custom"}],
      "Take-Profit":[{l:"Enabled",v:"ON"},{l:"Strategy",v:"Custom"},{d:"Levels"},{t:[["Target","Sell%"],["50%","25%"],["150%","25%"],["300%","25%"],["500%","15%"]]},{l:"Moon Bag",v:"ON — 10%"}],
      DCA:[{l:"Enabled",v:"OFF"}],
      "Stale Trade":[{l:"Enabled",v:"ON"},{l:"Hold Time",v:"90 min"},{l:"P/L Range",v:"1%-8%"}]},
    signalsniper:{"Purchase & Position":[{l:"Max Slippage",v:"3%"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2"},{l:"Medium from",v:"3"},{l:"Large from",v:"7"},{d:"Position Size"},{l:"Small",v:"0.3-0.5"},{l:"Medium",v:"0.5-0.8"},{l:"Large",v:"0.8-1.2"},{l:"Randomization",v:"ON"}],
      Signals:[{l:"Min Strength",v:"3",n:"High quality only"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"Metrics"},{d:"Token Metrics"},{l:"Min Mcap",v:"$30,000"},{l:"Min Liq",v:"$10,000"},{l:"Min Holders",v:"150"}],
      "Stop Loss":[{l:"Enabled",v:"ON"},{l:"Default",v:"-15%"},{l:"Strategy",v:"Custom"}],
      "Take-Profit":[{l:"Enabled",v:"ON"},{l:"Strategy",v:"Custom"},{d:"Levels"},{t:[["Target","Sell%"],["80%","20%"],["180%","25%"],["350%","25%"],["500%","20%"]]},{l:"Moon Bag",v:"ON — 10%"}],
      DCA:[{l:"Enabled",v:"OFF"}],
      "Stale Trade":[{l:"Enabled",v:"ON"},{l:"Hold Time",v:"90 min"},{l:"P/L Range",v:"1%-10%"}]},
    scalper2:{"Purchase & Position":[{l:"Max Slippage",v:"3%"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2"},{l:"Medium from",v:"3"},{l:"Large from",v:"7"},{d:"Position Size"},{l:"Small",v:"0.2-0.3"},{l:"Medium",v:"0.3-0.5"},{l:"Large",v:"0.5-0.8"},{l:"Randomization",v:"ON"}],
      Signals:[{l:"Min Strength",v:"3",n:"Quality filter"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"Metrics"},{d:"Token Metrics"},{l:"Min Mcap",v:"$15,000"},{l:"Min Liq",v:"$8,000"},{l:"Min Holders",v:"75"}],
      "Stop Loss":[{l:"Enabled",v:"ON"},{l:"Default",v:"-12%",n:"Refined from Scalper v1"},{l:"Strategy",v:"Custom"}],
      "Take-Profit":[{l:"Enabled",v:"ON"},{l:"Strategy",v:"Custom — aggressive"},{d:"Levels"},{t:[["Target","Sell%"],["8%","25%"],["20%","30%"],["45%","25%"],["80%","20%"]]},{l:"Moon Bag",v:"OFF"}],
      DCA:[{l:"Enabled",v:"OFF"}],
      "Stale Trade":[{l:"Enabled",v:"ON"},{l:"Hold Time",v:"45 min"},{l:"P/L Range",v:"1%-6%"}]},
    basetest2:{"Purchase & Position":[{l:"Max Slippage",v:"4%",n:"Slightly tighter than v1"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2"},{l:"Medium from",v:"4"},{l:"Large from",v:"8"},{d:"Position Size"},{l:"Small",v:"0.2-0.4"},{l:"Medium",v:"0.4-0.8"},{l:"Large",v:"0.8-1.2"},{l:"Randomization",v:"ON"}],
      Signals:[{l:"Min Strength",v:"1 (All)"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"No Filter"},{d:"Token Metrics"},{l:"Min Mcap",v:"---"},{l:"Min Liq",v:"---"},{l:"Min Holders",v:"---"},{i:"No filters — updated control benchmark."}],
      "Stop Loss":[{l:"Enabled",v:"ON"},{l:"Default",v:"-28%",n:"Tighter than v1"},{l:"Strategy",v:"Exponential Decay (PRESET)"}],
      "Take-Profit":[{l:"Enabled",v:"OFF"},{i:"No TP — relies on stop loss only."}],
      DCA:[{l:"Enabled",v:"OFF"}],
      "Stale Trade":[{l:"Enabled",v:"ON"},{l:"Hold Time",v:"75 min"},{l:"P/L Range",v:"1%-10%"}]},
    ignitiontester:{"Purchase & Position":[{l:"Max Slippage",v:"3%"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2"},{l:"Medium from",v:"3"},{l:"Large from",v:"7"},{d:"Position Size"},{l:"Small",v:"0.2-0.4"},{l:"Medium",v:"0.4-0.7"},{l:"Large",v:"0.7-1.0"},{l:"Randomization",v:"ON"}],
      Signals:[{l:"Min Strength",v:"2"},{l:"Signal Types",v:"Ignition signals",n:"Tests ignition-type triggers"}],
      "Risk Management":[{l:"Filter Mode",v:"Metrics"},{d:"Token Metrics"},{l:"Min Mcap",v:"$20,000"},{l:"Min Liq",v:"$8,000"},{l:"Min Holders",v:"100"}],
      "Stop Loss":[{l:"Enabled",v:"ON"},{l:"Default",v:"-16%"},{l:"Strategy",v:"Custom"}],
      "Take-Profit":[{l:"Enabled",v:"ON"},{l:"Strategy",v:"Custom"},{d:"Levels"},{t:[["Target","Sell%"],["60%","25%"],["150%","25%"],["300%","25%"],["500%","15%"]]},{l:"Moon Bag",v:"ON — 10%"}],
      DCA:[{l:"Enabled",v:"OFF"}],
      "Stale Trade":[{l:"Enabled",v:"ON"},{l:"Hold Time",v:"90 min"},{l:"P/L Range",v:"1%-10%"}]},
  };
  const renderField=(f,i)=>{
    if(f.d)return <div key={i} style={{padding:"9px 0 3px",borderBottom:`1px solid ${T.accent}25`}}><span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:T.accent,fontFamily:M}}>{f.d}</span></div>;
    if(f.i)return <div key={i} style={{margin:"6px 0",padding:"8px 12px",background:T.accentBg,borderLeft:`3px solid ${T.accent}60`,borderRadius:"0 6px 6px 0",fontSize:11,color:T.textSecondary,lineHeight:1.5,fontStyle:"italic"}}>{f.i}</div>;
    if(f.t)return <div key={i} style={{margin:"6px 0"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{f.t[0].map((h,j)=><th key={j} style={{padding:"5px 10px",background:`${T.accent}14`,color:T.textSecondary,textAlign:"left",fontWeight:700,borderBottom:`2px solid ${T.accent}20`,fontFamily:M,fontSize:10}}>{h}</th>)}</tr></thead><tbody>{f.t.slice(1).map((row,ri)=><tr key={ri}>{row.map((cell,ci)=><td key={ci} style={{padding:"4px 10px",borderBottom:`1px solid ${T.borderLight}`,color:ci===0?T.accent:T.textSecondary,fontFamily:M,fontSize:11,fontWeight:ci===0?700:400}}>{cell}</td>)}</tr>)}</tbody></table></div>;
    const isOn=f.v==="ON"||f.v?.startsWith("ON ");
    const isOff=f.v==="OFF"||f.v?.startsWith("OFF ");
    return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:"7px 0",borderBottom:`1px solid ${T.borderLight}`,alignItems:"center"}}>
      <div><div style={{fontSize:11.5,color:T.text,fontWeight:500}}>{f.l}</div>{f.n&&<div style={{fontSize:9.5,color:T.textMuted,marginTop:1}}>{f.n}</div>}</div>
      <div style={{fontFamily:M,fontSize:11.5,fontWeight:700,textAlign:"right",padding:"4px 10px",background:T.bgInput,borderRadius:4,border:`1px solid ${T.borderLight}`,color:isOn?T.positive:isOff?T.negative:f.v==="---"?T.textFaint:T.accent}}>{f.v}</div>
    </div>;
  };
  return <div>
    <FilterBar T={T}>
      <FilterLabel T={T}>Agent</FilterLabel>
      <Select value={sel} onChange={v=>{setSel(v);setTab("Purchase & Position");}} T={T}>
        {AK.map(k=><option key={k} value={k}>{AG[k].abbr} {AG[k].name}</option>)}
      </Select>
      <FilterDivider T={T}/>
      <FilterLabel T={T}>Tab</FilterLabel>
      <Select value={tab} onChange={setTab} T={T}>
        {TABS.map(t=><option key={t} value={t}>{t}</option>)}
      </Select>
      <FilterDivider T={T}/>
      {s.n>0&&<span style={{fontSize:10,color:T.textSecondary}}>{s.n} trades | Exp: <Mono style={{color:pc(s.expectancy,T)}}>{s.expectancy>=0?"+":""}{s.expectancy.toFixed(2)}%</Mono> | R:R: <Mono style={{color:s.rr>=1?T.positive:T.negative}}>{s.rr.toFixed(2)}x</Mono> | P/L: <PnL v={s.totalPnl} T={T}/></span>}
    </FilterBar>
    <div style={{margin:"0 0 12px",padding:"10px 14px",background:T.accentBg,borderLeft:`3px solid ${T.accent}`,borderRadius:"0 6px 6px 0",fontSize:11,color:T.textSecondary,lineHeight:1.5}}>
      <span style={{fontWeight:700,color:T.accent}}>{a.abbr} {a.name}</span>{" --- "}
      {AGENT_DESCRIPTIONS[sel]||a.tag}
    </div>
    <Card accent={T.accent} T={T}>{(configs[sel]?.[tab]||[{i:`Configuration data for ${a.name} will be added after initial testing period.`}]).map(renderField)}</Card>
  </div>;
}

// ═══════════════════════════════
// ANALYTICS PAGE
// ═══════════════════════════════
function AnalyticsPage({trades,modeFilter,T}) {
  const SIGNAL_TYPES = useMemo(() => [...new Set(trades.map(t=>t.signalType).filter(Boolean))], [trades]);
  const [fm,setFm]=useState(modeFilter);
  const [fst,setFst]=useState("all");
  const ft=useMemo(()=>{let r=fm==="all"?[...trades]:trades.filter(t=>t.mode===fm);if(fst!=="all")r=r.filter(t=>t.signalType===fst);return r;},[trades,fm,fst]);
  const agentComp=useMemo(()=>AK.map(k=>({k,...calcStats(ft.filter(t=>t.agent===k))})).filter(d=>d.n>0).sort((a,b)=>b.expectancy-a.expectancy),[ft]);
  const stByAgent=useMemo(()=>{const m={};ft.forEach(t=>{const k=`${t.agent}|${t.signalType}`;if(!m[k])m[k]={agent:t.agent,type:t.signalType,n:0,w:0,pnl:0,pct:0};m[k].n++;if(t.pnlUsd>0)m[k].w++;m[k].pnl+=t.pnlUsd;m[k].pct+=t.changePct;});return Object.values(m).map(d=>({...d,wr:d.n?d.w/d.n*100:0,avg:d.n?d.pct/d.n:0})).filter(d=>d.n>=3).sort((a,b)=>b.avg-a.avg);},[ft]);
  const strByAgent=useMemo(()=>{const m={};ft.forEach(t=>{if(!t.signalStrength)return;const k=`${t.agent}|${t.signalStrength}`;if(!m[k])m[k]={agent:t.agent,str:t.signalStrength,n:0,w:0,pnl:0,pct:0};m[k].n++;if(t.pnlUsd>0)m[k].w++;m[k].pnl+=t.pnlUsd;m[k].pct+=t.changePct;});return Object.values(m).map(d=>({...d,wr:d.n?d.w/d.n*100:0,avg:d.n?d.pct/d.n:0})).sort((a,b)=>a.str===b.str?a.agent.localeCompare(b.agent):a.str-b.str);},[ft]);
  const LINE_COLORS=["#6366f1","#818cf8","#a78bfa","#c084fc","#f472b6","#fb923c","#38bdf8","#34d399","#fbbf24"];
  const cumPnl=useMemo(()=>{const by={};AK.forEach(k=>{by[k]=[];});const sorted=[...ft].sort((a,b)=>new Date(a.time||0)-new Date(b.time||0));const run={};AK.forEach(k=>{run[k]=0;});sorted.forEach((t,i)=>{if(!run.hasOwnProperty(t.agent))return;run[t.agent]+=t.pnlUsd;by[t.agent].push({i,pnl:+run[t.agent].toFixed(2)});});return by;},[ft]);
  const [sort,onSort]=useSort("pct","desc");

  return <div>
    <FilterBar T={T}>
      <FilterLabel T={T}>Mode</FilterLabel>
      <Select value={fm} onChange={setFm} T={T}>
        <option value="all">All Modes</option>
        <option value="live">Live</option>
        <option value="sim">Simulation</option>
      </Select>
      <FilterDivider T={T}/>
      <FilterLabel T={T}>Signal</FilterLabel>
      <Select value={fst} onChange={setFst} T={T}>
        <option value="all">All Signals</option>
        {SIGNAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
      </Select>
      <FilterDivider T={T}/>
      <span style={{fontSize:10,color:T.textMuted,fontFamily:M}}>{ft.length} trades analyzed</span>
    </FilterBar>

    {Object.values(cumPnl).some(a=>a.length>1)&&<Card T={T}><CTitle T={T}>Cumulative P/L Over Time</CTitle><ResponsiveContainer width="100%" height={220}><LineChart><CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/><XAxis dataKey="i" tick={false}/><YAxis tick={{fontSize:10,fill:T.textMuted}}/><Tooltip contentStyle={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:6,fontSize:11,color:T.text}}/>{AK.map((k,ki)=>cumPnl[k].length>1&&<Line key={k} data={cumPnl[k]} dataKey="pnl" name={AG[k].name} stroke={LINE_COLORS[ki%LINE_COLORS.length]} strokeWidth={2} dot={false}/>)}<Legend iconType="line" wrapperStyle={{fontSize:11}}/></LineChart></ResponsiveContainer></Card>}

    <Card T={T}><CTitle T={T}>Agent Comparison</CTitle><div style={{fontSize:9,color:T.textFaint,marginTop:-8,marginBottom:10}}>Sorted by expectancy — the true measure of edge</div>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["#","Agent","Trades","Avg Return","Expectancy","R:R","WR","Avg Win","Avg Loss","PF","P/L"].map(h=><TH key={h} T={T}>{h}</TH>)}</tr></thead><tbody>{agentComp.map((d,rank)=><tr key={d.k} style={{background:rank===0?`${T.positive}06`:"transparent"}}><TD T={T}><Mono style={{color:rank===0?T.positive:rank===agentComp.length-1?T.negative:T.textMuted,fontWeight:700}}>#{rank+1}</Mono></TD><TD T={T}><ABadge k={d.k} T={T}/></TD><TD T={T}><Mono>{d.n}</Mono></TD><TD T={T}><Mono style={{color:pc(d.avgReturn,T),fontWeight:700,fontSize:12}}>{d.avgReturn>=0?"+":""}{d.avgReturn.toFixed(2)}%</Mono></TD><TD T={T}><Mono style={{color:pc(d.expectancy,T),fontWeight:700,fontSize:12}}>{d.expectancy>=0?"+":""}{d.expectancy.toFixed(2)}%</Mono></TD><TD T={T}><Mono style={{color:d.rr>=1?T.positive:T.negative}}>{d.rr.toFixed(2)}x</Mono></TD><TD T={T}><Mono style={{color:pc(d.winRate-50,T)}}>{d.winRate.toFixed(1)}%</Mono></TD><TD T={T}><Mono style={{color:T.positive}}>+{d.avgWinPct.toFixed(1)}%</Mono></TD><TD T={T}><Mono style={{color:T.negative}}>{d.avgLossPct.toFixed(1)}%</Mono></TD><TD T={T}><Mono style={{color:d.profitFactor>=1?T.positive:T.negative}}>{d.profitFactor>0?d.profitFactor.toFixed(2):"---"}</Mono></TD><TD T={T}><PnL v={d.totalPnl} T={T}/></TD></tr>)}</tbody></table>
    </Card>

    <Card T={T}><CTitle color={T.warning} T={T}>Signal Strength x Agent</CTitle>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Agent","Str","Trades","Avg Return","Win Rate","P/L"].map(h=><TH key={h} T={T}>{h}</TH>)}</tr></thead><tbody>{strByAgent.map((d,i)=><tr key={i} style={{background:d.avg>=0?`${T.positive}06`:d.avg<-3?`${T.negative}06`:"transparent"}}><TD T={T}><ABadge k={d.agent} T={T}/></TD><TD T={T}><Mono style={{fontSize:14,fontWeight:800,color:d.str>=4?T.positive:d.str>=3?T.warning:d.str>=2?"#f97316":T.negative}}>{d.str}</Mono></TD><TD T={T}><Mono>{d.n}</Mono></TD><TD T={T}><Mono style={{color:pc(d.avg,T),fontWeight:700,fontSize:12}}>{d.avg>=0?"+":""}{d.avg.toFixed(2)}%</Mono></TD><TD T={T}><Mono style={{color:pc(d.wr-50,T)}}>{d.wr.toFixed(1)}%</Mono></TD><TD T={T}><PnL v={d.pnl} T={T}/></TD></tr>)}</tbody></table>
    </Card>

    <Card T={T}><CTitle T={T}>Signal Type x Agent</CTitle>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Agent","Signal","Trades","Avg Return","WR","P/L"].map(h=><TH key={h} T={T}>{h}</TH>)}</tr></thead><tbody>{stByAgent.map((d,i)=><tr key={i} style={{background:d.avg>=0?`${T.positive}06`:"transparent"}}><TD T={T}><ABadge k={d.agent} T={T}/></TD><TD T={T}><Badge color={d.avg>=0?T.positive:d.avg>=-2?T.warning:T.negative} T={T}>{d.type}</Badge></TD><TD T={T}><Mono>{d.n}</Mono></TD><TD T={T}><Mono style={{color:pc(d.avg,T),fontWeight:700,fontSize:12}}>{d.avg>=0?"+":""}{d.avg.toFixed(2)}%</Mono></TD><TD T={T}><Mono style={{color:pc(d.wr-50,T)}}>{d.wr.toFixed(1)}%</Mono></TD><TD T={T}><PnL v={d.pnl} T={T}/></TD></tr>)}</tbody></table>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card T={T}><CTitle color={T.positive} T={T}>Best Trades</CTitle><TradeTable trades={sortTrades(ft,{key:"pct",dir:"desc"})} limit={10} sort={{key:"pct",dir:"desc"}} onSort={()=>{}} T={T}/></Card>
      <Card T={T}><CTitle color={T.negative} T={T}>Worst Trades</CTitle><TradeTable trades={sortTrades(ft,{key:"pct",dir:"asc"})} limit={10} sort={{key:"pct",dir:"asc"}} onSort={()=>{}} T={T}/></Card>
    </div>
  </div>;
}

// ═══════════════════════════════
// AI ADVISOR PAGE
// ═══════════════════════════════
function AdvisorPage({ trades, signals, T }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).slice(2,7)}`);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Image helpers
  const addImage = useCallback((file) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 20 * 1024 * 1024) { alert("Image must be under 20MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      setPendingImages(prev => [...prev, { data: base64, mediaType: file.type, preview: dataUrl }]);
    };
    reader.readAsDataURL(file);
  }, []);
  const removeImage = useCallback((idx) => { setPendingImages(prev => prev.filter((_, i) => i !== idx)); }, []);

  // Auto-scroll to bottom
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load conversation history list
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api("/api/ai/conversations");
      setConversations(res.conversations || []);
    } catch (err) { console.error("Failed to load conversations:", err); }
    setLoadingHistory(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load a specific conversation
  const loadConversation = useCallback(async (id) => {
    try {
      const res = await api(`/api/ai/conversations/${id}`);
      const conv = res.conversation;
      setMessages((conv.messages || []).map(m => ({ role: m.role, content: m.content })));
      setConversationId(id);
      setShowHistory(false);
    } catch (err) { console.error("Failed to load conversation:", err); }
  }, []);

  // Start new conversation
  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(`conv_${Date.now()}_${Math.random().toString(36).slice(2,7)}`);
    setShowHistory(false);
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (id, e) => {
    e.stopPropagation();
    try {
      await api(`/api/ai/conversations/${id}`, { method: "DELETE" });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) newConversation();
    } catch (err) { console.error("Failed to delete:", err); }
  }, [conversationId, newConversation]);

  // Build context from current trading data
  const buildContext = useCallback(() => {
    const lines = [];
    lines.push("### Agent Performance Summary\n");
    lines.push("| Agent | Mode | Trades | Win Rate | Expectancy | R:R | Profit Factor | Total P/L | Edge Score |");
    lines.push("|-------|------|--------|----------|------------|-----|---------------|-----------|------------|");

    for (const k of AK) {
      const a = AG[k];
      for (const mode of ["live", "sim"]) {
        const ft = trades.filter(t => t.agent === k && t.mode === mode);
        if (!ft.length) continue;
        const s = calcStats(ft);
        lines.push(`| ${a.name} | ${mode} | ${s.n} | ${s.winRate.toFixed(1)}% | ${s.expectancy>=0?"+":""}${s.expectancy.toFixed(2)}% | ${s.rr.toFixed(2)}x | ${s.profitFactor.toFixed(2)} | $${s.totalPnl.toFixed(2)} | ${s.edgeScore.toFixed(2)} |`);
      }
      // All modes combined
      const allFt = trades.filter(t => t.agent === k);
      if (allFt.length) {
        const s = calcStats(allFt);
        lines.push(`| ${a.name} | **ALL** | ${s.n} | ${s.winRate.toFixed(1)}% | ${s.expectancy>=0?"+":""}${s.expectancy.toFixed(2)}% | ${s.rr.toFixed(2)}x | ${s.profitFactor.toFixed(2)} | $${s.totalPnl.toFixed(2)} | ${s.edgeScore.toFixed(2)} |`);
      }
    }

    // Signal analysis
    const signalTypes = [...new Set(trades.map(t => t.signalType).filter(Boolean))];
    if (signalTypes.length) {
      lines.push("\n### Signal Type Performance\n");
      lines.push("| Agent | Signal Type | Trades | Win Rate | Avg Return |");
      lines.push("|-------|-------------|--------|----------|------------|");
      for (const k of AK) {
        for (const st of signalTypes) {
          const ft = trades.filter(t => t.agent === k && t.signalType === st);
          if (ft.length < 2) continue;
          const s = calcStats(ft);
          lines.push(`| ${AG[k].name} | ${st} | ${s.n} | ${s.winRate.toFixed(1)}% | ${s.avgReturn>=0?"+":""}${s.avgReturn.toFixed(2)}% |`);
        }
      }
    }

    // Signal strength correlation
    const strengths = [...new Set(trades.map(t => t.signalStrength).filter(Boolean))].sort();
    if (strengths.length) {
      lines.push("\n### Signal Strength Correlation\n");
      lines.push("| Agent | Strength | Trades | Win Rate | Avg Return |");
      lines.push("|-------|----------|--------|----------|------------|");
      for (const k of AK) {
        for (const str of strengths) {
          const ft = trades.filter(t => t.agent === k && t.signalStrength === str);
          if (ft.length < 2) continue;
          const s = calcStats(ft);
          lines.push(`| ${AG[k].name} | ${str} | ${s.n} | ${s.winRate.toFixed(1)}% | ${s.avgReturn>=0?"+":""}${s.avgReturn.toFixed(2)}% |`);
        }
      }
    }

    // Totals
    lines.push(`\n### Overall: ${trades.length} total trades, ${signals.length} total signals`);
    const overall = calcStats(trades);
    if (overall.n) {
      lines.push(`Overall Win Rate: ${overall.winRate.toFixed(1)}%, Expectancy: ${overall.expectancy>=0?"+":""}${overall.expectancy.toFixed(2)}%, Total P/L: $${overall.totalPnl.toFixed(2)}`);
    }

    return lines.join("\n");
  }, [trades, signals]);

  // Send message
  const sendMessage = useCallback(async (text) => {
    const rawMsg = text || input.trim();
    const imgs = [...pendingImages];
    if ((!rawMsg && !imgs.length) || streaming) return;
    const msg = rawMsg || "Analyze this image";
    setInput("");
    setPendingImages([]);

    const newMessages = [...messages, { role: "user", content: msg, images: imgs.length ? imgs : undefined }];
    setMessages([...newMessages, { role: "assistant", content: "", streaming: true }]);
    setStreaming(true);

    try {
      const context = buildContext();
      // Build history for multi-turn (exclude the current message)
      const history = newMessages.slice(0, -1).map(m => ({
        role: m.role, content: m.content,
        images: m.images?.map(i => ({ data: i.data, mediaType: i.mediaType }))
      }));

      const payload = { message: msg, context, history, conversationId };
      if (imgs.length) payload.images = imgs.map(i => ({ data: i.data, mediaType: i.mediaType }));

      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") {
              fullText += data.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullText, streaming: true };
                return updated;
              });
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (parseErr) {
            if (parseErr.message !== "Unexpected end of JSON input") {
              console.error("SSE parse error:", parseErr);
            }
          }
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: fullText };
        return updated;
      });

      // Refresh conversation list
      loadConversations();
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `**Error:** ${err.message}`, error: true };
        return updated;
      });
    }
    setStreaming(false);
  }, [input, messages, streaming, pendingImages, buildContext, conversationId, loadConversations]);

  // Simple markdown renderer
  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split("\n");
    const elements = [];
    let inTable = false;
    let tableRows = [];
    let inCodeBlock = false;
    let codeLines = [];

    const processInline = (t) => {
      const parts = [];
      let remaining = t;
      while (remaining) {
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        if (boldMatch) {
          const before = remaining.slice(0, boldMatch.index);
          if (before) parts.push(before);
          parts.push(<strong key={parts.length} style={{color:T.text,fontWeight:700}}>{boldMatch[1]}</strong>);
          remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        } else {
          parts.push(remaining);
          remaining = "";
        }
      }
      return parts;
    };

    const flushTable = () => {
      if (!tableRows.length) return;
      const headers = tableRows[0];
      const dataRows = tableRows.slice(2);
      elements.push(
        <div key={elements.length} style={{overflowX:"auto",margin:"8px 0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,fontFamily:M}}>
            <thead><tr>{headers.map((h,i)=><th key={i} style={{padding:"5px 8px",background:T.bgTableHead,color:T.textSecondary,textAlign:"left",fontWeight:700,borderBottom:`2px solid ${T.border}`,whiteSpace:"nowrap"}}>{h.trim()}</th>)}</tr></thead>
            <tbody>{dataRows.map((row,ri)=><tr key={ri}>{row.map((cell,ci)=><td key={ci} style={{padding:"4px 8px",borderBottom:`1px solid ${T.borderLight}`,color:cell.trim().startsWith("+")||cell.trim().startsWith("$")&&!cell.includes("-")?T.positive:cell.trim().startsWith("-")?T.negative:T.textSecondary,whiteSpace:"nowrap"}}>{cell.trim()}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      tableRows = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          elements.push(<pre key={elements.length} style={{background:T.bgCodeBlock,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 14px",margin:"8px 0",fontSize:10,fontFamily:M,color:T.textSecondary,overflowX:"auto"}}>{codeLines.join("\n")}</pre>);
          codeLines = [];
          inCodeBlock = false;
        } else {
          flushTable();
          inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) { codeLines.push(line); continue; }

      // Tables
      if (line.includes("|") && line.trim().startsWith("|")) {
        if (!inTable) { flushTable(); inTable = true; }
        const cells = line.split("|").slice(1, -1);
        if (cells.some(c => /^[\s-:]+$/.test(c))) {
          tableRows.push(cells); // separator row
        } else {
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable();
        inTable = false;
      }

      // Headers
      if (line.startsWith("### ")) { elements.push(<div key={elements.length} style={{fontSize:13,fontWeight:700,color:T.text,margin:"14px 0 6px",letterSpacing:-.3}}>{processInline(line.slice(4))}</div>); continue; }
      if (line.startsWith("## ")) { elements.push(<div key={elements.length} style={{fontSize:14,fontWeight:800,color:T.text,margin:"16px 0 8px",letterSpacing:-.3}}>{processInline(line.slice(3))}</div>); continue; }
      if (line.startsWith("# ")) { elements.push(<div key={elements.length} style={{fontSize:16,fontWeight:800,color:T.text,margin:"18px 0 8px"}}>{processInline(line.slice(2))}</div>); continue; }

      // Bullet points
      if (line.match(/^[\s]*[-*]\s/)) {
        const indent = line.match(/^(\s*)/)[1].length;
        elements.push(<div key={elements.length} style={{paddingLeft:12+indent*8,position:"relative",margin:"3px 0",lineHeight:1.6}}><span style={{position:"absolute",left:indent*8,color:T.accent}}>&#8226;</span>{processInline(line.replace(/^[\s]*[-*]\s/,""))}</div>);
        continue;
      }

      // Numbered lists
      if (line.match(/^\d+\.\s/)) {
        const num = line.match(/^(\d+)\./)[1];
        elements.push(<div key={elements.length} style={{paddingLeft:20,position:"relative",margin:"3px 0",lineHeight:1.6}}><span style={{position:"absolute",left:0,color:T.accent,fontWeight:700,fontFamily:M,fontSize:10}}>{num}.</span>{processInline(line.replace(/^\d+\.\s/,""))}</div>);
        continue;
      }

      // Empty line
      if (!line.trim()) { elements.push(<div key={elements.length} style={{height:8}}/>); continue; }

      // Regular text
      elements.push(<div key={elements.length} style={{margin:"2px 0",lineHeight:1.6}}>{processInline(line)}</div>);
    }

    if (inTable) flushTable();
    return elements;
  };

  // Quick action buttons
  const quickActions = [
    { label: "Analyze All Agents", prompt: "Give me a comprehensive analysis of all my trading agents. Compare their performance, identify the best and worst performers, and explain WHY based on their settings. What patterns do you see?" },
    { label: "Best Strategy", prompt: "Based on my data, what is the optimal strategy configuration? If you could create the perfect agent using the best settings from each of my current agents, what would it look like? Be specific with every setting." },
    { label: "Improve Weakest", prompt: "Identify my worst-performing agent and provide a detailed improvement plan. List every setting change with the exact values I should use and explain why each change should help." },
    { label: "Signal Analysis", prompt: "Analyze the correlation between signal strength, signal types, and trading outcomes across all my agents. Which signals should I filter, which should I keep, and what min strength should each agent use?" },
  ];

  return <div style={{display:"flex",gap:0,height:"calc(100vh - 80px)",margin:"-14px -28px -40px -28px"}}>
    {/* Left: Conversation History Panel */}
    <div style={{width:showHistory?260:0,transition:"width .2s",overflow:"hidden",borderRight:`1px solid ${T.border}`,background:T.bgSidebar,flexShrink:0}}>
      <div style={{width:260,height:"100%",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"14px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:T.textMuted}}>History</span>
          <button onClick={newConversation} style={{background:T.bgInput,border:`1px solid ${T.borderInput}`,borderRadius:5,padding:"4px 10px",color:T.textSecondary,cursor:"pointer",fontSize:9,fontFamily:F}}>+ New</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px"}}>
          {loadingHistory && <div style={{padding:16,textAlign:"center",fontSize:10,color:T.textFaint}}>Loading...</div>}
          {conversations.map(c => (
            <div key={c.id} onClick={() => loadConversation(c.id)}
              style={{padding:"8px 10px",borderRadius:6,marginBottom:2,cursor:"pointer",background:c.id===conversationId?T.bgHover:"transparent",borderLeft:c.id===conversationId?`3px solid ${T.accent}`:"3px solid transparent"}}>
              <div style={{fontSize:11,color:c.id===conversationId?T.text:T.textSecondary,fontWeight:c.id===conversationId?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:3}}>
                <span style={{fontSize:8,color:T.textFaint,fontFamily:M}}>{c.messageCount} msgs | {new Date(c.updatedAt).toLocaleDateString()}</span>
                <button onClick={(e) => deleteConversation(c.id, e)}
                  style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:10,padding:"0 2px"}}
                  title="Delete">x</button>
              </div>
            </div>
          ))}
          {!loadingHistory && !conversations.length && <div style={{padding:16,textAlign:"center",fontSize:10,color:T.textFaint}}>No saved conversations</div>}
        </div>
      </div>
    </div>

    {/* Center: Chat Area */}
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      {/* Chat header */}
      <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.bgSidebar,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={() => setShowHistory(!showHistory)}
            style={{background:T.bgInput,border:`1px solid ${T.borderInput}`,borderRadius:5,padding:"4px 8px",color:T.textSecondary,cursor:"pointer",fontSize:11}}>
            {showHistory ? "<" : ">"} History
          </button>
          <span style={{fontSize:10,color:T.textMuted,fontFamily:M}}>
            {messages.filter(m=>m.role==="user").length} messages
          </span>
        </div>
        <button onClick={newConversation}
          style={{background:T.bgInput,border:`1px solid ${T.borderInput}`,borderRadius:5,padding:"4px 10px",color:T.textSecondary,cursor:"pointer",fontSize:10,fontFamily:F}}>
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
        {!messages.length && (
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:28,fontWeight:800,fontFamily:M,color:T.accent,marginBottom:12}}>AI</div>
            <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6}}>Nexgent AI Advisor</div>
            <div style={{fontSize:11,color:T.textSecondary,maxWidth:500,margin:"0 auto",lineHeight:1.6}}>
              I analyze your trading agent data and provide actionable recommendations. Ask me about agent performance, strategy optimization, signal analysis, or setting changes.
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:24}}>
              {quickActions.map(qa => (
                <button key={qa.label} onClick={() => sendMessage(qa.prompt)}
                  style={{background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 16px",color:T.textSecondary,cursor:"pointer",fontSize:11,fontFamily:F,maxWidth:200,textAlign:"left",transition:"all .15s"}}
                  onMouseEnter={e=>{e.target.style.borderColor=T.accent;e.target.style.color=T.text;}}
                  onMouseLeave={e=>{e.target.style.borderColor=T.border;e.target.style.color=T.textSecondary;}}>
                  {qa.label}
                </button>
              ))}
            </div>
            <div style={{marginTop:24,fontSize:9,color:T.textFaint,fontFamily:M}}>
              Powered by Claude Sonnet 4.6 | Conversations are saved automatically
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:12}}>
            <div style={{
              maxWidth:m.role==="user"?"70%":"85%",
              padding:m.role==="user"?"10px 14px":"14px 18px",
              borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",
              background:m.role==="user"?`${T.accent}18`:T.bgCard,
              border:m.role==="user"?`1px solid ${T.accent}30`:`1px solid ${m.error?`${T.negative}30`:T.border}`,
              fontSize:12,
              lineHeight:1.6,
              color:m.role==="user"?T.text:T.textSecondary,
            }}>
              {m.role === "user" && m.images?.length > 0 && (
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                  {m.images.map((img, j) => <img key={j} src={img.preview} alt="" style={{maxWidth:200,maxHeight:160,borderRadius:6,border:`1px solid ${T.border}`,cursor:"pointer",objectFit:"cover"}} onClick={()=>window.open(img.preview,"_blank")}/>)}
                </div>
              )}
              {m.role === "assistant" ? renderMarkdown(m.content) : m.content}
              {m.streaming && <span style={{display:"inline-block",width:6,height:14,background:T.accent,marginLeft:2,animation:"blink 1s infinite"}}/>}
            </div>
          </div>
        ))}
        <div ref={chatEndRef}/>
      </div>

      {/* Input area */}
      <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,background:T.bgSidebar,flexShrink:0}}
        onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
        onDrop={e=>{e.preventDefault();e.stopPropagation();[...e.dataTransfer.files].forEach(f=>f.type.startsWith("image/")&&addImage(f));}}>
        {messages.length > 0 && (
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
            {quickActions.map(qa => (
              <button key={qa.label} onClick={() => sendMessage(qa.prompt)} disabled={streaming}
                style={{background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:5,padding:"4px 10px",color:T.textMuted,cursor:streaming?"not-allowed":"pointer",fontSize:9,fontFamily:F,opacity:streaming?.5:1}}>
                {qa.label}
              </button>
            ))}
          </div>
        )}
        {pendingImages.length > 0 && (
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
            {pendingImages.map((img, i) => (
              <div key={i} style={{position:"relative"}}>
                <img src={img.preview} alt="" style={{width:48,height:48,borderRadius:6,objectFit:"cover",border:`1px solid ${T.border}`}}/>
                <button onClick={()=>removeImage(i)} style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:T.negative,border:"none",color:"#fff",fontSize:9,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,padding:0}}>x</button>
              </div>
            ))}
            <span style={{fontSize:8,color:T.textFaint}}>{pendingImages.length} image{pendingImages.length>1?"s":""}</span>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{[...e.target.files].forEach(addImage);e.target.value="";}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>fileInputRef.current?.click()} disabled={streaming} title="Attach image"
            style={{background:T.bgInput,border:`1px solid ${T.borderInput}`,borderRadius:8,padding:"10px 12px",color:pendingImages.length?T.accent:T.textMuted,cursor:streaming?"not-allowed":"pointer",fontSize:14,fontFamily:F,flexShrink:0,transition:"color .15s"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
            onPaste={e=>{const items=[...e.clipboardData.items];const imgItem=items.find(i=>i.type.startsWith("image/"));if(imgItem){e.preventDefault();addImage(imgItem.getAsFile());}}}
            placeholder={streaming?"AI is thinking...":pendingImages.length?"Add a message about this image...":"Ask about your trading agents..."}
            disabled={streaming}
            style={{flex:1,background:T.bgInput,border:`1px solid ${T.borderInput}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:12,fontFamily:F,outline:"none"}}/>
          <button onClick={() => sendMessage()} disabled={streaming || (!input.trim() && !pendingImages.length)}
            style={{background:streaming||(!input.trim()&&!pendingImages.length)?T.bgInput:T.accent,border:"none",borderRadius:8,padding:"10px 18px",color:streaming||(!input.trim()&&!pendingImages.length)?T.textMuted:"#fff",cursor:streaming||(!input.trim()&&!pendingImages.length)?"not-allowed":"pointer",fontSize:12,fontWeight:700,fontFamily:F}}>
            {streaming ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>

    {/* Right: Data Context Panel */}
    <div style={{width:280,borderLeft:`1px solid ${T.border}`,background:T.bgSidebar,overflowY:"auto",flexShrink:0}}>
      <div style={{padding:"14px 12px",borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:T.textMuted}}>Data Context</span>
        <div style={{fontSize:8,color:T.textFaint,fontFamily:M,marginTop:3}}>{trades.length} trades | {signals.length} signals</div>
      </div>

      <div style={{padding:"10px 12px"}}>
        {AK.map(k => {
          const a = AG[k];
          const ft = trades.filter(t => t.agent === k);
          if (!ft.length) return null;
          const s = calcStats(ft);
          const liveFt = ft.filter(t => t.mode === "live");
          const simFt = ft.filter(t => t.mode === "sim");
          return <div key={k} style={{marginBottom:12,padding:"10px",background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,borderLeft:`3px solid ${T.accent}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,color:T.accent}}>{a.abbr} {a.name}</span>
              <span style={{fontSize:8,fontFamily:M,color:T.textFaint}}>{ft.length} trades</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px",fontSize:9}}>
              <div><span style={{color:T.textMuted}}>WR: </span><span style={{fontFamily:M,color:pc(s.winRate-50,T)}}>{s.winRate.toFixed(1)}%</span></div>
              <div><span style={{color:T.textMuted}}>Exp: </span><span style={{fontFamily:M,color:pc(s.expectancy,T)}}>{s.expectancy>=0?"+":""}{s.expectancy.toFixed(2)}%</span></div>
              <div><span style={{color:T.textMuted}}>R:R: </span><span style={{fontFamily:M,color:s.rr>=1?T.positive:T.negative}}>{s.rr.toFixed(2)}x</span></div>
              <div><span style={{color:T.textMuted}}>PF: </span><span style={{fontFamily:M,color:s.profitFactor>=1?T.positive:T.negative}}>{s.profitFactor.toFixed(2)}</span></div>
              <div style={{gridColumn:"1/-1"}}><span style={{color:T.textMuted}}>P/L: </span><span style={{fontFamily:M,color:pc(s.totalPnl,T),fontWeight:700}}>{s.totalPnl>=0?"+":""}${s.totalPnl.toFixed(2)}</span></div>
              {liveFt.length > 0 && <div style={{gridColumn:"1/-1",fontSize:8,color:T.textFaint}}>Live: {liveFt.length} | Sim: {simFt.length}</div>}
            </div>
          </div>;
        })}

        {signals.length > 0 && <div style={{marginTop:8,padding:"10px",background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8}}>
          <div style={{fontSize:10,fontWeight:700,color:T.warning,marginBottom:6}}>Signals</div>
          <div style={{fontSize:9,color:T.textSecondary}}>{signals.length} total signals received</div>
          <div style={{fontSize:8,color:T.textFaint,fontFamily:M,marginTop:4}}>
            Types: {[...new Set(signals.map(s=>s.type).filter(Boolean))].join(", ") || "---"}
          </div>
        </div>}
      </div>
    </div>

    <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
  </div>;
}

// ═══════════════════════════════
// IMPORT PAGE
// ═══════════════════════════════
function ImportPage({ allTrades, allSignals, onRefresh, T }) {
  const [tradeFile, setTradeFile] = useState(null);
  const [signalFile, setSignalFile] = useState(null);
  const [tradeAgent, setTradeAgent] = useState("degen");
  const [tradeMode, setTradeMode] = useState("simulation");
  const [tradeParsed, setTradeParsed] = useState([]);
  const [signalParsed, setSignalParsed] = useState([]);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmClear, setConfirmClear] = useState(null);
  const tradeInputRef = useRef(null);
  const signalInputRef = useRef(null);

  const handleTradeFile = useCallback((file) => {
    if (!file) return;
    setTradeFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      const mapped = rows.map(r => mapTradeRow(r, AGENT_ID_REVERSE[tradeAgent], tradeMode));
      setTradeParsed(mapped);
    };
    reader.readAsText(file);
  }, [tradeAgent, tradeMode]);

  const handleSignalFile = useCallback((file) => {
    if (!file) return;
    setSignalFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      const mapped = rows.map(r => mapSignalRow(r));
      setSignalParsed(mapped);
    };
    reader.readAsText(file);
  }, []);

  // Re-parse when agent/mode changes
  useEffect(() => {
    if (!tradeFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      setTradeParsed(rows.map(r => mapTradeRow(r, AGENT_ID_REVERSE[tradeAgent], tradeMode)));
    };
    reader.readAsText(tradeFile);
  }, [tradeAgent, tradeMode, tradeFile]);

  const importTrades = useCallback(async () => {
    if (!tradeParsed.length) return;
    setImporting(true); setMsg(null);
    try {
      const res = await api("/api/trades/import", { method: "POST", body: JSON.stringify({ trades: tradeParsed, agentId: AGENT_ID_REVERSE[tradeAgent] }) });
      setMsg({ type: "success", text: `Imported ${res.saved} trades for ${AG[tradeAgent].name} (${tradeMode})` });
      setTradeParsed([]); setTradeFile(null);
      if (tradeInputRef.current) tradeInputRef.current.value = "";
      onRefresh();
    } catch (err) { setMsg({ type: "error", text: `Trade import failed: ${err.message}` }); }
    setImporting(false);
  }, [tradeParsed, tradeAgent, tradeMode, onRefresh]);

  const importSignals = useCallback(async () => {
    if (!signalParsed.length) return;
    setImporting(true); setMsg(null);
    try {
      const res = await api("/api/signals/import", { method: "POST", body: JSON.stringify({ signals: signalParsed }) });
      setMsg({ type: "success", text: `Imported ${res.saved} signals` });
      setSignalParsed([]); setSignalFile(null);
      if (signalInputRef.current) signalInputRef.current.value = "";
      onRefresh();
    } catch (err) { setMsg({ type: "error", text: `Signal import failed: ${err.message}` }); }
    setImporting(false);
  }, [signalParsed, onRefresh]);

  const clearData = useCallback(async (type) => {
    setImporting(true); setMsg(null);
    try {
      if (type === "trades" || type === "all") {
        const res = await api("/api/trades/clear", { method: "DELETE" });
        setMsg(prev => ({ type: "success", text: `${prev?.text ? prev.text + " | " : ""}Cleared ${res.deleted} trades` }));
      }
      if (type === "signals" || type === "all") {
        const res = await api("/api/signals/clear", { method: "DELETE" });
        setMsg(prev => ({ type: "success", text: `${prev?.text ? prev.text + " | " : ""}Cleared ${res.deleted} signals` }));
      }
      setConfirmClear(null);
      onRefresh();
    } catch (err) { setMsg({ type: "error", text: `Clear failed: ${err.message}` }); }
    setImporting(false);
  }, [onRefresh]);

  const dropZoneStyle = (active) => ({
    border: `2px dashed ${active ? T.accent : T.border}`, borderRadius: 10,
    padding: "28px 20px", textAlign: "center", cursor: "pointer",
    background: active ? T.accentBg : T.bgInput, transition: "all .2s",
    marginBottom: 14,
  });

  const agentCounts = useMemo(() => {
    const c = {};
    AK.forEach(k => { c[k] = { total: 0, live: 0, sim: 0 }; });
    allTrades.forEach(t => { if (c[t.agent]) { c[t.agent].total++; if (t.mode === "live") c[t.agent].live++; else c[t.agent].sim++; } });
    return c;
  }, [allTrades]);

  return <div>
    {msg && <div style={{ padding: "10px 16px", marginBottom: 16, borderRadius: 8, background: msg.type === "success" ? `${T.positive}10` : `${T.negative}10`, border: `1px solid ${msg.type === "success" ? `${T.positive}30` : `${T.negative}30`}`, color: msg.type === "success" ? T.positive : T.negative, fontSize: 12, fontFamily: M, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{msg.text}</span>
      <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14 }}>x</button>
    </div>}

    {/* Data Summary */}
    <Card T={T}>
      <CTitle T={T}>Current Data in Firebase</CTitle>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(AK.filter(k=>agentCounts[k].total>0).length+1,6)},1fr)`, gap: 10 }}>
        <div style={{ textAlign: "center", padding: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: M, color: T.text }}>{allTrades.length}</div>
          <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 3 }}>Total Trades</div>
        </div>
        {AK.filter(k=>agentCounts[k].total>0).map(k => <div key={k} style={{ textAlign: "center", padding: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: T.accent }}>{agentCounts[k].total}</div>
          <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 3 }}>{AG[k].abbr} {AG[k].name}</div>
          <div style={{ fontSize: 8, color: T.textFaint, fontFamily: M, marginTop: 2 }}>{agentCounts[k].live}L / {agentCounts[k].sim}S</div>
        </div>)}
      </div>
      <div style={{ textAlign: "center", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 11, fontFamily: M, color: T.textSecondary }}>{allSignals.length} signals</span>
      </div>
    </Card>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Trade Import */}
      <Card accent={T.accent} T={T}>
        <CTitle color={T.accent} T={T}>Trade History Import</CTitle>
        <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FilterLabel T={T}>Agent</FilterLabel>
            <Select value={tradeAgent} onChange={setTradeAgent} style={{ width: "100%", marginTop: 4 }} T={T}>
              {AK.map(k => <option key={k} value={k}>{AG[k].abbr} {AG[k].name}</option>)}
            </Select>
          </div>
          <div style={{ flex: 1 }}>
            <FilterLabel T={T}>Mode</FilterLabel>
            <Select value={tradeMode} onChange={setTradeMode} style={{ width: "100%", marginTop: 4 }} T={T}>
              <option value="simulation">Simulation</option>
              <option value="live">Live</option>
            </Select>
          </div>
        </div>

        <div style={dropZoneStyle(!!tradeFile)}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); handleTradeFile(e.dataTransfer.files[0]); }}
          onClick={() => tradeInputRef.current?.click()}>
          <input ref={tradeInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleTradeFile(e.target.files[0])} />
          {tradeFile ? <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, marginBottom: 4 }}>{tradeFile.name}</div>
            <div style={{ fontSize: 10, color: T.textSecondary }}>{tradeParsed.length} trades parsed</div>
          </div> : <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6 }}>CSV</div>
            <div style={{ fontSize: 11, color: T.textSecondary }}>Drop trade CSV here or click to browse</div>
            <div style={{ fontSize: 9, color: T.textFaint, marginTop: 4 }}>Nexgent Trade History format</div>
          </div>}
        </div>

        {tradeParsed.length > 0 && <div>
          <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 6, fontFamily: M }}>Preview (first 5 rows)</div>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Token", "P/L", "%", "Signal", "Time"].map(h => <th key={h} style={{ padding: "4px 8px", fontSize: 8, color: T.textMuted, textAlign: "left", borderBottom: `1px solid ${T.border}`, fontFamily: M, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>)}</tr></thead>
              <tbody>{tradeParsed.slice(0, 5).map((t, i) => <tr key={i}>
                <td style={{ padding: "3px 8px", fontSize: 10, color: T.text, fontFamily: M, fontWeight: 700 }}>{t.token}</td>
                <td style={{ padding: "3px 8px", fontSize: 10, fontFamily: M, color: pc(t.pnl, T) }}>{t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}</td>
                <td style={{ padding: "3px 8px", fontSize: 10, fontFamily: M, color: pc(t.pnlPercent, T) }}>{t.pnlPercent >= 0 ? "+" : ""}{t.pnlPercent.toFixed(1)}%</td>
                <td style={{ padding: "3px 8px", fontSize: 9, color: T.textMuted }}>{(t.signalType || "").slice(0, 30)}</td>
                <td style={{ padding: "3px 8px", fontSize: 8, color: T.textFaint, fontFamily: M }}>{new Date(t.timestamp).toLocaleDateString()}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <button onClick={importTrades} disabled={importing} style={{ width: "100%", padding: "10px", background: importing ? T.bgInput : T.accent, border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 700, cursor: importing ? "wait" : "pointer", fontFamily: F }}>
            {importing ? "Importing..." : `Import ${tradeParsed.length} Trades`}
          </button>
        </div>}
      </Card>

      {/* Signal Import */}
      <Card accent={T.warning} T={T}>
        <CTitle color={T.warning} T={T}>Signals Import</CTitle>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: T.textMuted, padding: "8px 0" }}>Signals are shared across all agents</div>
        </div>

        <div style={dropZoneStyle(!!signalFile)}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); handleSignalFile(e.dataTransfer.files[0]); }}
          onClick={() => signalInputRef.current?.click()}>
          <input ref={signalInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleSignalFile(e.target.files[0])} />
          {signalFile ? <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.warning, marginBottom: 4 }}>{signalFile.name}</div>
            <div style={{ fontSize: 10, color: T.textSecondary }}>{signalParsed.length} signals parsed</div>
          </div> : <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6 }}>CSV</div>
            <div style={{ fontSize: 11, color: T.textSecondary }}>Drop signals CSV here or click to browse</div>
            <div style={{ fontSize: 9, color: T.textFaint, marginTop: 4 }}>Nexgent Trading Signals format</div>
          </div>}
        </div>

        {signalParsed.length > 0 && <div>
          <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 6, fontFamily: M }}>Preview (first 5 rows)</div>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Token", "Strategy", "Str", "Time"].map(h => <th key={h} style={{ padding: "4px 8px", fontSize: 8, color: T.textMuted, textAlign: "left", borderBottom: `1px solid ${T.border}`, fontFamily: M, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>)}</tr></thead>
              <tbody>{signalParsed.slice(0, 5).map((s, i) => <tr key={i}>
                <td style={{ padding: "3px 8px", fontSize: 10, color: T.text, fontFamily: M, fontWeight: 700 }}>{s.token}</td>
                <td style={{ padding: "3px 8px", fontSize: 9, color: T.textMuted }}>{(s.tradingStrategy || "").slice(0, 30)}</td>
                <td style={{ padding: "3px 8px", fontSize: 11, fontFamily: M, fontWeight: 800, color: s.signalStrength >= 4 ? T.positive : s.signalStrength >= 3 ? T.warning : s.signalStrength >= 2 ? "#f97316" : T.negative }}>{s.signalStrength}</td>
                <td style={{ padding: "3px 8px", fontSize: 8, color: T.textFaint, fontFamily: M }}>{new Date(s.signalReceivedAt).toLocaleDateString()}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <button onClick={importSignals} disabled={importing} style={{ width: "100%", padding: "10px", background: importing ? T.bgInput : T.warning, border: "none", borderRadius: 6, color: "#000", fontSize: 12, fontWeight: 700, cursor: importing ? "wait" : "pointer", fontFamily: F }}>
            {importing ? "Importing..." : `Import ${signalParsed.length} Signals`}
          </button>
        </div>}
      </Card>
    </div>

    {/* Clear Data */}
    <Card style={{ marginTop: 8 }} T={T}>
      <CTitle color={T.negative} T={T}>Data Management</CTitle>
      <div style={{ display: "flex", gap: 10 }}>
        {confirmClear ? <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.negative }}>Clear {confirmClear}? This cannot be undone.</span>
          <button onClick={() => clearData(confirmClear)} disabled={importing} style={{ padding: "6px 16px", background: T.negative, border: "none", borderRadius: 4, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: F }}>Confirm</button>
          <button onClick={() => setConfirmClear(null)} style={{ padding: "6px 16px", background: T.bgInput, border: `1px solid ${T.borderInput}`, borderRadius: 4, color: T.textSecondary, fontSize: 10, cursor: "pointer", fontFamily: F }}>Cancel</button>
        </div> : <>
          <button onClick={() => setConfirmClear("trades")} style={{ padding: "6px 16px", background: T.bgInput, border: `1px solid ${T.negative}30`, borderRadius: 4, color: T.negative, fontSize: 10, cursor: "pointer", fontFamily: F }}>Clear All Trades</button>
          <button onClick={() => setConfirmClear("signals")} style={{ padding: "6px 16px", background: T.bgInput, border: `1px solid ${T.negative}30`, borderRadius: 4, color: T.negative, fontSize: 10, cursor: "pointer", fontFamily: F }}>Clear All Signals</button>
          <button onClick={() => setConfirmClear("all")} style={{ padding: "6px 16px", background: T.bgInput, border: `1px solid ${T.negative}30`, borderRadius: 4, color: T.negative, fontSize: 10, cursor: "pointer", fontFamily: F }}>Clear Everything</button>
        </>}
      </div>
    </Card>

    {/* CSV Format Help */}
    <Card style={{ marginTop: 8 }} T={T}>
      <CTitle color={T.textMuted} T={T}>CSV Format Reference</CTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginBottom: 6 }}>Trade History Columns</div>
          <div style={{ fontSize: 9, color: T.textMuted, lineHeight: 1.8, fontFamily: M }}>
            Time, Token Symbol, Token Address, Amount, Average Purchase Price (USD), Sale Price (USD), Profit / Loss (USD), Change (%), Signal ID, Signal Type, Activation Reason
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.warning, marginBottom: 6 }}>Signals Columns</div>
          <div style={{ fontSize: 9, color: T.textMuted, lineHeight: 1.8, fontFamily: M }}>
            Signal ID, Created At, Signal Strength, Token Symbol, Token Address, Trading Strategy, Activation Reason, Source, Updated At
          </div>
        </div>
      </div>
    </Card>
  </div>;
}

// ═══════════════════════════════
// MAIN APP
// ═══════════════════════════════
const NAV=[
  {key:"dashboard",label:"Dashboard"},
  {key:"trades",label:"Trades"},
  {key:"signals",label:"Signals"},
  {key:"analytics",label:"Analytics"},
  {key:"agents",label:"Agents"},
  {key:"import",label:"Import"},
  {key:"advisor",label:"AI Advisor"},
];

export default function App(){
  const [T,themeMode,toggleTheme]=useTheme();
  const [page,setPage]=useState("dashboard");
  const [mf,setMf]=useState("all");
  const [allTrades,setAllTrades]=useState([]);
  const [allSignals,setAllSignals]=useState([]);
  const [loading,setLoading]=useState(true);
  const [fetchError,setFetchError]=useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const [tradesRes, signalsRes] = await Promise.all([
        api("/api/trades/list?limit=5000&raw=true"),
        api("/api/signals/list?limit=5000"),
      ]);
      setAllTrades((tradesRes.trades || []).map(mapFirestoreTrade));
      setAllSignals((signalsRes.signals || []).map(mapFirestoreSignal));
    } catch (err) {
      console.error("Fetch error:", err);
      setFetchError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const lc = useMemo(() => allTrades.filter(t => t.mode === "live").length, [allTrades]);
  const sc = useMemo(() => allTrades.filter(t => t.mode === "sim").length, [allTrades]);

  return <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:F}}>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.borderLight};border-radius:3px}::-webkit-scrollbar-thumb:hover{background:${T.textMuted}}select:focus{border-color:${T.accent};box-shadow:0 0 0 1px ${T.accent}40}table{font-variant-numeric:tabular-nums}`}</style>

    <div style={{width:190,background:T.bgSidebar,borderRight:`1px solid ${T.border}`,position:"fixed",top:0,left:0,bottom:0,zIndex:100,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"20px 16px 14px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontSize:7,fontWeight:700,letterSpacing:3.5,color:T.textMuted,textTransform:"uppercase"}}>Nexgent AI</div>
        <div style={{fontSize:16,fontWeight:800,color:T.text,letterSpacing:-.5,marginTop:2}}>Analytics</div>
        <div style={{fontSize:9,color:T.textFaint,marginTop:6,fontFamily:M}}>{loading?"loading...":fetchError?"connection error":`${allTrades.length} trades · ${allSignals.length} signals`}</div>
      </div>

      <nav style={{padding:"12px 8px",flex:1}}>
        {NAV.map(n=><button key={n.key} onClick={()=>setPage(n.key)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 10px",marginBottom:2,border:"none",borderRadius:6,background:page===n.key?T.accentBg:"transparent",color:page===n.key?T.text:T.textMuted,cursor:"pointer",fontSize:11.5,fontWeight:page===n.key?700:400,fontFamily:F,textAlign:"left",borderLeft:page===n.key?`3px solid ${T.accent}`:"3px solid transparent",transition:"all .15s"}}>{n.label}</button>)}
      </nav>

      <div style={{padding:"12px 14px",borderTop:`1px solid ${T.border}`}}>
        <div style={{fontSize:7.5,fontWeight:700,letterSpacing:2,color:T.textFaint,textTransform:"uppercase",marginBottom:6}}>Data Mode</div>
        <Select value={mf} onChange={setMf} style={{width:"100%",fontSize:10}} T={T}>
          <option value="all">All ({allTrades.length})</option>
          <option value="live">Live ({lc})</option>
          <option value="sim">Sim ({sc})</option>
        </Select>
      </div>

      <div style={{padding:"10px 14px 14px",borderTop:`1px solid ${T.border}`}}>
        <div style={{fontSize:7.5,fontWeight:700,letterSpacing:2,color:T.textFaint,textTransform:"uppercase",marginBottom:6}}>Agents</div>
        {AK.map(k=>{const ag=AG[k],n=allTrades.filter(t=>t.agent===k).length,nl=allTrades.filter(t=>t.agent===k&&t.mode==="live").length;return <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"3px 0"}}><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:5,height:5,borderRadius:"50%",background:n>0?T.accent:T.borderLight}}/><span style={{fontSize:9,color:n>0?T.textSecondary:T.textFaint}}>{ag.name}</span></div><span style={{fontSize:8,fontFamily:M,color:T.textFaint}}>{nl>0?`${nl}L/`:""}{n-nl}S</span></div>;})}
      </div>

      <div style={{padding:"8px 14px 14px",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:8,color:T.textFaint,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>{themeMode==="light"?"Light":"Dark"}</span>
        <button onClick={toggleTheme} style={{background:T.bgInput,border:`1px solid ${T.borderInput}`,borderRadius:12,padding:"4px 10px",cursor:"pointer",fontSize:10,color:T.textSecondary,fontFamily:F,fontWeight:600,transition:"all .15s"}}>{themeMode==="light"?"Night":"Day"}</button>
      </div>
    </div>

    <div style={{marginLeft:190,padding:"0 28px 40px"}}>
      <div style={{padding:"22px 0 14px",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,color:T.text,margin:0,letterSpacing:-.3}}>{NAV.find(n=>n.key===page)?.label}</h1>
          <p style={{fontSize:10,color:T.textFaint,margin:"3px 0 0",fontFamily:M}}>
            {loading?"loading data from firebase...":fetchError?<span style={{color:T.negative}}>{fetchError}</span>:`${mf==="live"?"live only":mf==="sim"?"simulation only":"all data"} · ${allTrades.length} trades`}
          </p>
        </div>
        {!loading && <button onClick={fetchData} style={{background:T.bgInput,border:`1px solid ${T.borderInput}`,borderRadius:6,padding:"5px 12px",color:T.textSecondary,cursor:"pointer",fontSize:10,fontFamily:F}}>Refresh</button>}
      </div>
      {loading && <Card style={{textAlign:"center",padding:60}} T={T}><div style={{fontSize:14,color:T.textMuted}}>Loading data from Firebase...</div></Card>}
      {fetchError && !loading && <Card style={{textAlign:"center",padding:40}} T={T}><div style={{fontSize:13,color:T.negative,marginBottom:12}}>Could not connect to backend</div><div style={{fontSize:10,color:T.textMuted,fontFamily:M,marginBottom:16}}>{fetchError}</div><button onClick={fetchData} style={{background:T.bgInput,border:`1px solid ${T.borderInput}`,borderRadius:6,padding:"8px 20px",color:T.textSecondary,cursor:"pointer",fontSize:11,fontFamily:F}}>Retry</button></Card>}
      {!loading && !fetchError && <>
        {page==="dashboard"&&<Dashboard trades={allTrades} modeFilter={mf} T={T}/>}
        {page==="trades"&&<TradesPage trades={allTrades} modeFilter={mf} T={T}/>}
        {page==="signals"&&<SignalsPage signals={allSignals} T={T}/>}
        {page==="analytics"&&<AnalyticsPage trades={allTrades} modeFilter={mf} T={T}/>}
        {page==="agents"&&<AgentsPage trades={allTrades} modeFilter={mf} T={T}/>}
        {page==="import"&&<ImportPage allTrades={allTrades} allSignals={allSignals} onRefresh={fetchData} T={T}/>}
        {page==="advisor"&&<AdvisorPage trades={allTrades} signals={allSignals} T={T}/>}
      </>}
    </div>
  </div>;
}
