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
const AGENT_ID_MAP = { "nexgent-degen": "degen", "nexgent-pro": "pro", "nexgent-scalper": "scalper", "nexgent-base": "basetest" };
const AGENT_ID_REVERSE = { degen: "nexgent-degen", pro: "nexgent-pro", scalper: "nexgent-scalper", basetest: "nexgent-base" };
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

// ═══ CONSTANTS ═══
const AG = {
  degen:{name:"Degen",icon:"🔥",color:"#E94560",tag:"Max Risk · Max Reward"},
  pro:{name:"Pro",icon:"⚔️",color:"#0F9D58",tag:"Balanced · Smart Reward"},
  scalper:{name:"Scalper",icon:"⚡",color:"#4285F4",tag:"Tight Risk · Max WR"},
  basetest:{name:"Base Test",icon:"🧪",color:"#9C27B0",tag:"Control · Defaults"},
};
const AK = Object.keys(AG);
const F = `'Satoshi','DM Sans',system-ui,sans-serif`;
const M = `'JetBrains Mono','Fira Code',monospace`;
const pc = v => v>0?"#22c55e":v<0?"#ef4444":"#484868";

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
const selectBase = {
  appearance:"none", WebkitAppearance:"none", background:"#0e0e1e",
  border:"1px solid #1e1e38", borderRadius:6, padding:"6px 28px 6px 10px",
  color:"#c0c0d8", fontSize:11, fontFamily:F, cursor:"pointer", outline:"none",
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23505070'/%3E%3C/svg%3E")`,
  backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center",
};
const Select = ({value,onChange,children,style={}}) => (
  <select value={value} onChange={e=>onChange(e.target.value)} style={{...selectBase,...style}}>{children}</select>
);
const FilterBar = ({children}) => (
  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",padding:"12px 16px",background:"#0a0a18",border:"1px solid #1a1a30",borderRadius:8,marginBottom:16}}>{children}</div>
);
const FilterLabel = ({children}) => <span style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#404058",marginRight:-2}}>{children}</span>;
const FilterDivider = () => <div style={{width:1,height:20,background:"#1e1e38",margin:"0 4px"}}/>;
const Badge = ({color="#6b6b90",children}) => <span style={{display:"inline-block",padding:"2px 7px",borderRadius:4,background:`${color}18`,color,fontSize:10,fontWeight:600,fontFamily:M,letterSpacing:.3}}>{children}</span>;
const ABadge = ({k}) => {const a=AG[k]; return a?<Badge color={a.color}>{a.icon} {a.name}</Badge>:<Badge>{k}</Badge>;};
const Mono = ({children,style={}}) => <span style={{fontFamily:M,fontWeight:600,...style}}>{children}</span>;
const PnL = ({v,pct}) => <Mono style={{color:pc(v)}}>{v>=0?"+":""}{pct?`${v?.toFixed(1)}%`:`$${v?.toFixed(2)}`}</Mono>;
const Card = ({children,style={},accent}) => <div style={{background:"#0c0c1a",border:"1px solid #1a1a2e",borderRadius:10,padding:20,marginBottom:16,borderTop:accent?`3px solid ${accent}`:undefined,...style}}>{children}</div>;
const CTitle = ({children,color="#505070",right}) => <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color}}>{children}</div>{right&&<div>{right}</div>}</div>;
const Stat = ({label,value,color,sub}) => <div style={{textAlign:"center",padding:"10px 4px"}}><div style={{fontSize:22,fontWeight:800,fontFamily:M,color:color||"#e0e0e8",letterSpacing:-1}}>{value}</div><div style={{fontSize:8,color:"#484860",marginTop:3,letterSpacing:1.2,textTransform:"uppercase"}}>{label}</div>{sub&&<div style={{fontSize:9,color:"#383850",marginTop:1}}>{sub}</div>}</div>;

// ═══ SORTABLE TABLE ═══
const TH = ({children,sortKey,currentSort,onSort,align}) => {
  const active = sortKey && currentSort && currentSort.key === sortKey;
  const dir = active ? currentSort.dir : null;
  return <th onClick={sortKey?()=>onSort(sortKey):undefined} style={{
    padding:"8px 10px",background:"#0c0c1c",color:active?"#c0c0d8":"#606078",
    textAlign:align||"left",fontWeight:700,borderBottom:"2px solid #1a1a30",whiteSpace:"nowrap",
    fontFamily:M,fontSize:9,letterSpacing:1,textTransform:"uppercase",
    cursor:sortKey?"pointer":"default",userSelect:"none",position:"relative",
    transition:"color .15s",
  }}>
    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
      {children}
      {sortKey && <span style={{fontSize:8,color:active?"#8080b0":"#2a2a40",transition:"color .15s"}}>{dir==="asc"?"▲":dir==="desc"?"▼":"⇅"}</span>}
    </span>
  </th>;
};
const TD = ({children,style={}}) => <td style={{padding:"7px 10px",borderBottom:"1px solid #12122a",color:"#b0b0c0",fontSize:11,...style}}>{children}</td>;

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

function TradeTable({trades,limit,sort,onSort,showAgent=true,showMode=true}) {
  const d = limit ? trades.slice(0,limit) : trades;
  if(!d.length) return <div style={{textAlign:"center",padding:"40px",color:"#383850",fontSize:12}}>No trades match filters</div>;
  return <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
    <thead><tr>
      {showAgent&&<TH>Agent</TH>}
      {showMode&&<TH>Mode</TH>}
      <TH sortKey="token" currentSort={sort} onSort={onSort}>Token</TH>
      <TH>Signal</TH>
      <TH sortKey="str" currentSort={sort} onSort={onSort} align="center">Str</TH>
      <TH sortKey="pct" currentSort={sort} onSort={onSort} align="right">Δ%</TH>
      <TH sortKey="pnl" currentSort={sort} onSort={onSort} align="right">P/L</TH>
      <TH sortKey="time" currentSort={sort} onSort={onSort}>Time</TH>
    </tr></thead>
    <tbody>{d.map((t,i)=><tr key={t.id} style={{background:i%2?"#08081208":"transparent",transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background="#10102030"} onMouseLeave={e=>e.currentTarget.style.background=i%2?"#08081208":"transparent"}>
      {showAgent&&<TD><ABadge k={t.agent}/></TD>}
      {showMode&&<TD><Badge color={t.mode==="live"?"#eab308":"#585878"}>{t.mode}</Badge></TD>}
      <TD style={{fontWeight:700,color:"#e0e0e8",fontFamily:M,fontSize:11}}>{t.token}</TD>
      <TD><Badge>{(t.signalType||"").replace("Hyper Surge","HS").replace("Dormant Explosion","DE").replace("Price Reversal","PR").replace("Dex Boost","DB").replace(" (Pullback)"," ↩")}</Badge></TD>
      <TD style={{textAlign:"center"}}><Mono style={{color:t.signalStrength>=4?"#22c55e":t.signalStrength>=3?"#eab308":t.signalStrength>=2?"#f97316":"#ef4444",fontSize:12}}>{t.signalStrength||"—"}</Mono></TD>
      <TD style={{textAlign:"right"}}><PnL v={t.changePct} pct/></TD>
      <TD style={{textAlign:"right"}}><PnL v={t.pnlUsd}/></TD>
      <TD style={{fontSize:9,color:"#4a4a68",fontFamily:M,whiteSpace:"nowrap"}}>{t.time||"—"}</TD>
    </tr>)}</tbody>
  </table></div>;
}

// ═══════════════════════════════
// DASHBOARD
// ═══════════════════════════════
function Dashboard({trades,modeFilter}) {
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
  const chartData = AK.map(k=>({name:AG[k].name,exp:+stats[k].expectancy.toFixed(2),rr:+stats[k].rr.toFixed(2),avg:+stats[k].avgReturn.toFixed(2),pnl:+stats[k].totalPnl.toFixed(2),wr:+stats[k].winRate.toFixed(1),pf:+stats[k].profitFactor.toFixed(2),fill:AG[k].color}));
  const [sort,onSort] = useSort();

  return <div>
    <Card style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
      <Stat label="Trades" value={stats.all.n}/>
      <Stat label="Avg Return" value={`${stats.all.avgReturn>=0?"+":""}${stats.all.avgReturn.toFixed(2)}%`} color={pc(stats.all.avgReturn)} sub="per trade"/>
      <Stat label="Expectancy" value={`${stats.all.expectancy>=0?"+":""}${stats.all.expectancy.toFixed(2)}%`} color={pc(stats.all.expectancy)} sub="expected per trade"/>
      <Stat label="R:R Ratio" value={stats.all.rr>0?`${stats.all.rr.toFixed(2)}x`:"—"} color={stats.all.rr>=1?"#22c55e":"#ef4444"} sub={`+${stats.all.avgWinPct.toFixed(0)}% / ${stats.all.avgLossPct.toFixed(0)}%`}/>
      <Stat label="Win Rate" value={`${stats.all.winRate.toFixed(1)}%`} color={stats.all.winRate>=50?"#22c55e":"#ef4444"}/>
      <Stat label="Profit Factor" value={stats.all.profitFactor>0?stats.all.profitFactor.toFixed(2):"—"} color={stats.all.profitFactor>=1?"#22c55e":"#ef4444"} sub={`$${stats.all.grossWin.toFixed(0)} / $${stats.all.grossLoss.toFixed(0)}`}/>
      <Stat label="Total P/L" value={`${stats.all.totalPnl>=0?"+":""}$${stats.all.totalPnl.toFixed(0)}`} color={pc(stats.all.totalPnl)}/>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
      {AK.map(k=>({k,s:stats[k],a:AG[k]})).sort((a,b)=>b.s.expectancy-a.s.expectancy).map(({k,s,a},rank)=> <Card key={k} accent={a.color} style={{marginBottom:0,padding:16,position:"relative"}}>
        <div style={{position:"absolute",top:8,right:10,fontSize:9,fontFamily:M,fontWeight:700,color:rank===0?"#22c55e":rank===3?"#ef4444":"#484868"}}>#{rank+1}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><span style={{fontSize:16}}>{a.icon}</span><div><div style={{fontSize:12,fontWeight:700,color:a.color}}>{a.name}</div></div></div>
        <div style={{textAlign:"center",padding:"6px 0 10px",borderBottom:"1px solid #141428",marginBottom:8}}>
          <div style={{fontSize:20,fontWeight:800,fontFamily:M,color:pc(s.expectancy),letterSpacing:-1}}>{s.expectancy>=0?"+":""}{s.expectancy.toFixed(2)}%</div>
          <div style={{fontSize:8,color:"#484868",letterSpacing:1.5,textTransform:"uppercase",marginTop:2}}>Expectancy / Trade</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,fontSize:10}}>
          {[
            ["Avg Return",`${s.avgReturn>=0?"+":""}${s.avgReturn.toFixed(2)}%`,pc(s.avgReturn)],
            ["R:R Ratio",s.rr>0?`${s.rr.toFixed(2)}x`:"—",s.rr>=1?"#22c55e":"#ef4444"],
            ["Win Rate",`${s.winRate.toFixed(1)}%`,pc(s.winRate-50)],
            ["PF",s.profitFactor>0?s.profitFactor.toFixed(2):"—",s.profitFactor>=1?"#22c55e":"#ef4444"],
            ["Trades",s.n,"#c0c0d0"],
            ["P/L",`${s.totalPnl>=0?"+":""}$${s.totalPnl.toFixed(0)}`,pc(s.totalPnl)],
          ].map(([l,v,c])=><Fragment key={l}><div style={{color:"#484868",padding:"2px 0"}}>{l}</div><div style={{textAlign:"right",fontFamily:M,fontWeight:600,padding:"2px 0",color:c}}>{v}</div></Fragment>)}
        </div>
      </Card>)}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
      <Card><CTitle>Expectancy / Trade (%)</CTitle><ResponsiveContainer width="100%" height={180}><BarChart data={chartData} barSize={24}><CartesianGrid strokeDasharray="3 3" stroke="#141428"/><XAxis dataKey="name" tick={{fontSize:10,fill:"#484868"}}/><YAxis tick={{fontSize:10,fill:"#484868"}}/><Tooltip contentStyle={{background:"#0c0c1a",border:"1px solid #1a1a30",borderRadius:6,fontSize:11}} formatter={v=>[`${v}%`,"Expectancy"]}/><Bar dataKey="exp" radius={[4,4,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.exp>=0?d.fill:"#ef4444"}/>)}</Bar></BarChart></ResponsiveContainer><div style={{textAlign:"center",fontSize:9,color:"#303048",marginTop:-2}}>WR × Avg Win + (1-WR) × Avg Loss</div></Card>
      <Card><CTitle>R:R Ratio (Win Size / Loss Size)</CTitle><ResponsiveContainer width="100%" height={180}><BarChart data={chartData} barSize={24}><CartesianGrid strokeDasharray="3 3" stroke="#141428"/><XAxis dataKey="name" tick={{fontSize:10,fill:"#484868"}}/><YAxis tick={{fontSize:10,fill:"#484868"}} domain={[0,'auto']}/><Tooltip contentStyle={{background:"#0c0c1a",border:"1px solid #1a1a30",borderRadius:6,fontSize:11}} formatter={v=>[`${v}x`,"R:R"]}/><Bar dataKey="rr" radius={[4,4,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.rr>=1?d.fill:"#ef4444"}/>)}</Bar></BarChart></ResponsiveContainer><div style={{textAlign:"center",fontSize:9,color:"#303048",marginTop:-2}}>Above 1.0x = wins bigger than losses</div></Card>
      <Card><CTitle>Total P/L ($)</CTitle><ResponsiveContainer width="100%" height={180}><BarChart data={chartData} barSize={24}><CartesianGrid strokeDasharray="3 3" stroke="#141428"/><XAxis dataKey="name" tick={{fontSize:10,fill:"#484868"}}/><YAxis tick={{fontSize:10,fill:"#484868"}}/><Tooltip contentStyle={{background:"#0c0c1a",border:"1px solid #1a1a30",borderRadius:6,fontSize:11}} formatter={v=>[`$${v}`,"P/L"]}/><Bar dataKey="pnl" radius={[4,4,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.pnl>=0?d.fill:"#ef4444"}/>)}</Bar></BarChart></ResponsiveContainer></Card>
    </div>

    <Card><CTitle color="#eab308">⚠ Signal Strength vs Performance</CTitle>
      <div style={{fontSize:11,color:"#909098",marginBottom:14,lineHeight:1.6,padding:"10px 14px",background:"#eab30806",borderLeft:"3px solid #eab30860",borderRadius:"0 6px 6px 0"}}>
        <strong style={{color:"#eab308"}}>Counterintuitive:</strong> Higher strength = <em>worse</em> avg return. Str 4 has the worst expectancy despite being "strongest". Str 1-2 lose less per trade.
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Str","Trades","Win Rate","Avg Return","R:R","Avg Win","Avg Loss","Total P/L"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{strStats.filter(s=>s.str>0).map(s=><tr key={s.str}><TD><Mono style={{color:s.str>=4?"#22c55e":s.str>=3?"#eab308":s.str>=2?"#f97316":"#ef4444",fontSize:14,fontWeight:800}}>{s.str}</Mono></TD><TD><Mono>{s.n}</Mono></TD><TD><Mono style={{color:pc(s.wr-50)}}>{s.wr.toFixed(1)}%</Mono></TD><TD><Mono style={{color:pc(s.avg),fontWeight:700,fontSize:12}}>{s.avg>=0?"+":""}{s.avg.toFixed(2)}%</Mono></TD><TD><Mono style={{color:s.rr>=1?"#22c55e":"#ef4444"}}>{s.rr.toFixed(2)}x</Mono></TD><TD><Mono style={{color:"#22c55e"}}>+{s.aw.toFixed(1)}%</Mono></TD><TD><Mono style={{color:"#ef4444"}}>{s.al.toFixed(1)}%</Mono></TD><TD><PnL v={s.pnl}/></TD></tr>)}</tbody></table>
    </Card>

    <Card><CTitle>Signal Type Performance</CTitle>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Signal","Trades","Win Rate","Avg Return","Avg Win","Avg Loss","R:R","P/L"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{stStatsSorted.map(s=><tr key={s.type}><TD><Badge color={s.avg>=0?"#22c55e":s.avg>=-2?"#eab308":"#ef4444"}>{s.type}</Badge></TD><TD><Mono>{s.n}</Mono></TD><TD><Mono style={{color:pc(s.wr-50)}}>{s.wr.toFixed(1)}%</Mono></TD><TD><Mono style={{color:pc(s.avg),fontWeight:700,fontSize:12}}>{s.avg>=0?"+":""}{s.avg.toFixed(2)}%</Mono></TD><TD><Mono style={{color:"#22c55e"}}>+{s.aw.toFixed(1)}%</Mono></TD><TD><Mono style={{color:"#ef4444"}}>{s.al.toFixed(1)}%</Mono></TD><TD><Mono style={{color:s.rr>=1?"#22c55e":"#ef4444"}}>{s.rr.toFixed(2)}x</Mono></TD><TD><PnL v={s.pnl}/></TD></tr>)}</tbody></table>
    </Card>

    <Card><CTitle>Recent Trades</CTitle><TradeTable trades={sortTrades(ft,sort)} limit={20} sort={sort} onSort={onSort}/></Card>
  </div>;
}

// ═══════════════════════════════
// TRADES PAGE
// ═══════════════════════════════
function TradesPage({trades,modeFilter}) {
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
    <FilterBar>
      <FilterLabel>Agent</FilterLabel>
      <Select value={fa} onChange={setFa}>
        <option value="all">All Agents</option>
        {AK.map(k=><option key={k} value={k}>{AG[k].icon} {AG[k].name}</option>)}
      </Select>
      <FilterDivider/>
      <FilterLabel>Mode</FilterLabel>
      <Select value={fm} onChange={setFm}>
        <option value="all">All Modes</option>
        <option value="live">🟡 Live</option>
        <option value="sim">⚪ Simulation</option>
      </Select>
      <FilterDivider/>
      <FilterLabel>Outcome</FilterLabel>
      <Select value={fs} onChange={setFs}>
        <option value="all">All Outcomes</option>
        <option value="win">✅ Winners</option>
        <option value="loss">❌ Losers</option>
      </Select>
      <FilterDivider/>
      <FilterLabel>Signal</FilterLabel>
      <Select value={fst} onChange={setFst}>
        <option value="all">All Signals</option>
        {SIGNAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
      </Select>
      <FilterDivider/>
      <FilterLabel>Strength</FilterLabel>
      <Select value={fstr} onChange={setFstr}>
        <option value="all">Any</option>
        {[1,2,3,4].map(s=><option key={s} value={String(s)}>≥ {s}</option>)}
      </Select>
    </FilterBar>

    <Card style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,padding:14,marginBottom:14}}>
      <Stat label="Showing" value={filtered.length} sub={`of ${trades.length}`}/>
      <Stat label="Avg Return" value={`${st.avgReturn>=0?"+":""}${st.avgReturn.toFixed(2)}%`} color={pc(st.avgReturn)} sub="per trade"/>
      <Stat label="Expectancy" value={`${st.expectancy>=0?"+":""}${st.expectancy.toFixed(2)}%`} color={pc(st.expectancy)}/>
      <Stat label="R:R" value={st.rr>0?`${st.rr.toFixed(2)}x`:"—"} color={st.rr>=1?"#22c55e":"#ef4444"}/>
      <Stat label="Win Rate" value={`${st.winRate.toFixed(1)}%`} color={pc(st.winRate-50)}/>
      <Stat label="PF" value={st.profitFactor>0?st.profitFactor.toFixed(2):"—"} color={st.profitFactor>=1?"#22c55e":"#ef4444"}/>
      <Stat label="P/L" value={`${st.totalPnl>=0?"+":""}$${st.totalPnl.toFixed(0)}`} color={pc(st.totalPnl)}/>
    </Card>

    <Card><TradeTable trades={filtered} limit={limit} sort={sort} onSort={onSort}/></Card>
    {filtered.length>limit&&<div style={{textAlign:"center",padding:12}}>
      <button onClick={()=>setLimit(l=>l+50)} style={{background:"#1a1a30",border:"1px solid #2a2a48",borderRadius:6,padding:"8px 24px",color:"#808098",cursor:"pointer",fontSize:11,fontFamily:F}}>Load more ({filtered.length-limit} remaining)</button>
    </div>}
  </div>;
}

// ═══════════════════════════════
// SIGNALS PAGE
// ═══════════════════════════════
function SignalsPage({signals}) {
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
    <FilterBar>
      <FilterLabel>Signal Type</FilterLabel>
      <Select value={ft} onChange={setFt}>
        <option value="all">All Types ({signals.length})</option>
        {types.map(t=><option key={t.type} value={t.type}>{t.type} ({t.n})</option>)}
      </Select>
      <FilterDivider/>
      <FilterLabel>Strength</FilterLabel>
      <Select value={fstr} onChange={setFstr}>
        <option value="all">Any</option>
        {[1,2,3,4].map(s=><option key={s} value={String(s)}>{s}</option>)}
      </Select>
      <FilterDivider/>
      <FilterLabel>Sort</FilterLabel>
      <Select value={sort} onChange={setSort}>
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="str_desc">Strength ↓</option>
        <option value="str_asc">Strength ↑</option>
      </Select>
      <FilterDivider/>
      <span style={{fontSize:10,color:"#484868",fontFamily:M}}>{filtered.length} signals</span>
    </FilterBar>

    <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.max(types.length,1)},1fr)`,gap:10,marginBottom:16}}>
      {types.map(t=><Card key={t.type} style={{padding:12,marginBottom:0,cursor:"pointer",border:ft===t.type?`1px solid #6b6b90`:"1px solid #1a1a2e"}} onClick={()=>setFt(ft===t.type?"all":t.type)}>
        <div style={{fontSize:11,fontWeight:700,color:"#c0c0d8"}}>{t.type}</div>
        <div style={{display:"flex",gap:12,marginTop:4}}>
          <span style={{fontSize:9,color:"#606078"}}>{t.n} signals</span>
          <span style={{fontSize:9,color:"#606078"}}>avg str {t.avg}</span>
        </div>
      </Card>)}
    </div>

    <Card><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Type","Str","Token","Details","Time"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{filtered.slice(0,80).map((s,i)=><tr key={s.id||i} style={{background:i%2?"#08081208":"transparent"}}><TD><Badge>{s.type?.replace("Hyper Surge","HS").replace("Dormant Explosion","DE").replace("Price Reversal","PR").replace("Dex Boost","DB").replace(" (Pullback)"," ↩")}</Badge></TD><TD><Mono style={{color:s.strength>=4?"#22c55e":s.strength>=3?"#eab308":s.strength>=2?"#f97316":"#ef4444",fontSize:13,fontWeight:800}}>{s.strength}</Mono></TD><TD style={{fontWeight:700,color:"#e0e0e8",fontFamily:M,fontSize:11}}>{s.token}</TD><TD style={{fontSize:10,color:"#585878",maxWidth:320,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.reason||"—"}</TD><TD style={{fontSize:9,color:"#484868",fontFamily:M,whiteSpace:"nowrap"}}>{s.timestamp}</TD></tr>)}</tbody></table></div></Card>
  </div>;
}

// ═══════════════════════════════
// AGENTS PAGE
// ═══════════════════════════════
function AgentsPage({trades,modeFilter}) {
  const [sel,setSel]=useState("degen");
  const [tab,setTab]=useState("Purchase & Position");
  const a = AG[sel];
  const ft=useMemo(()=>(modeFilter==="all"?trades:trades.filter(t=>t.mode===modeFilter)).filter(t=>t.agent===sel),[trades,modeFilter,sel]);
  const s=useMemo(()=>calcStats(ft),[ft]);
  const TABS=["Purchase & Position","Signals","Risk Management","Stop Loss","Take-Profit","DCA","Stale Trade"];
  const configs={
    degen:{"Purchase & Position":[{l:"Max Slippage",v:"3%",n:"Tight — prevents overpaying"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2",n:"0.2–3 SOL"},{l:"Medium from",v:"3",n:"3–7 SOL ← ~3.3 here"},{l:"Large from",v:"7",n:"7+ SOL"},{d:"Position Size per Range"},{l:"Small",v:"0.3–0.5",n:"Up to ~25% of balance"},{l:"Medium",v:"0.5–1.0",n:"Up to ~30% per trade"},{l:"Large",v:"1.0–1.5"},{l:"Randomization",v:"✅ ON"}],
      Signals:[{l:"Min Strength",v:"1 (All)",n:"Every signal triggers"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"No Filter"},{d:"Token Metrics"},{l:"Min Mcap",v:"—"},{l:"Min Liq",v:"—"},{l:"Min Holders",v:"—"},{i:"Pure exposure — trades everything."}],
      "Stop Loss":[{l:"Enabled",v:"✅ ON"},{l:"Default",v:"-20%"},{l:"Strategy",v:"Custom"},{i:"Custom levels avoid Exponential Decay clustering."},{d:"Custom Levels (desc)"},{t:[["Price ↑","SL%"],["300%","92%"],["200%","85%"],["100%","65%"],["50%","20%"],["25%","3%"]]}],
      "Take-Profit":[{l:"Enabled",v:"✅ ON"},{l:"Strategy",v:"Custom"},{d:"Levels"},{t:[["Target","Sell%"],["100%","20%"],["200%","20%"],["400%","20%"],["600%","20%"]]},{i:"80% sold. 20% moon bag at 400%."},{l:"Moon Bag",v:"✅ ON — 20% at 400%"}],
      DCA:[{l:"Enabled",v:"❌ OFF"},{i:"DCA multiplies losses on rugs."}],
      "Stale Trade":[{l:"Enabled",v:"❌ OFF"},{i:"Moonshots take hours — never cut short."}]},
    pro:{"Purchase & Position":[{l:"Max Slippage",v:"3%"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2"},{l:"Medium from",v:"3",n:"← here"},{l:"Large from",v:"7"},{d:"Position Size"},{l:"Small",v:"0.2–0.3"},{l:"Medium",v:"0.3–0.5",n:"~10-15% per trade"},{l:"Large",v:"0.5–1.0"},{l:"Randomization",v:"✅ ON"}],
      Signals:[{l:"Min Strength",v:"2",n:"Filters weakest ~20%"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"No Filter (uses metrics)"},{d:"Token Metrics"},{l:"Min Mcap",v:"$50,000"},{l:"Min Liq",v:"$15,000"},{l:"Min Holders",v:"200"},{i:"Strict — filters rugs and bots."}],
      "Stop Loss":[{l:"Enabled",v:"✅ ON"},{l:"Default",v:"-15%"},{l:"Strategy",v:"Custom"},{i:"Offset from Step-Based Zones to avoid cascades."},{d:"Custom Levels"},{t:[["Price ↑","SL%"],["250%","88%"],["120%","60%"],["60%","28%"],["30%","10%"],["15%","2%"]]}],
      "Take-Profit":[{l:"Enabled",v:"✅ ON"},{l:"Strategy",v:"Custom"},{i:"Exits before Moderate preset walls."},{d:"Levels"},{t:[["Target","Sell%"],["40%","25%"],["130%","25%"],["270%","25%"],["370%","15%"]]},{i:"90% sold. 10% moon bag at 270%."},{l:"Moon Bag",v:"✅ ON — 10% at 270%"}],
      DCA:[{l:"Enabled",v:"❌ OFF"}],
      "Stale Trade":[{l:"Enabled",v:"✅ ON"},{l:"Hold Time",v:"120 min"},{l:"P/L Range",v:"1%–10%"},{i:"After 2hrs, 1–10% trades auto-closed."}]},
    scalper:{"Purchase & Position":[{l:"Max Slippage",v:"3%"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2"},{l:"Medium from",v:"3",n:"← here"},{l:"Large from",v:"7"},{d:"Position Size"},{l:"Small",v:"0.2–0.3"},{l:"Medium",v:"0.3–0.5",n:"-10% SL caps risk to ~1.5%"},{l:"Large",v:"0.5–1.0"},{l:"Randomization",v:"✅ ON"}],
      Signals:[{l:"Min Strength",v:"3",n:"Quality — filters bottom ~40%"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"No Filter (uses metrics)"},{d:"Token Metrics"},{l:"Min Mcap",v:"$10,000"},{l:"Min Liq",v:"$5,000"},{l:"Min Holders",v:"50"}],
      "Stop Loss":[{l:"Enabled",v:"✅ ON"},{l:"Default",v:"-10%",n:"Tightest of all"},{l:"Strategy",v:"Custom"},{d:"Custom Levels"},{t:[["Price ↑","SL%"],["150%","85%"],["100%","65%"],["50%","30%"],["20%","8%"],["10%","2%"]]},{i:"Once up 10%, can NEVER lose money."}],
      "Take-Profit":[{l:"Enabled",v:"✅ ON"},{l:"Strategy",v:"Custom — ultra-aggressive"},{d:"Levels"},{t:[["Target","Sell%"],["5%","30%"],["15%","30%"],["35%","25%"],["60%","15%"]]},{i:"100% sold. No moon bag."},{l:"Moon Bag",v:"❌ OFF"}],
      DCA:[{l:"Enabled",v:"❌ OFF"}],
      "Stale Trade":[{l:"Enabled",v:"✅ ON"},{l:"Hold Time",v:"60 min"},{l:"P/L Range",v:"1%–8%"},{i:"After 1hr, 1–8% trades auto-closed."}]},
    basetest:{"Purchase & Position":[{l:"Max Slippage",v:"5%",n:"Default — wider than custom (3%)"},{d:"Balance Boundaries"},{l:"Small from",v:"0.2",n:"0.2–5 SOL ← here"},{l:"Medium from",v:"5"},{l:"Large from",v:"10"},{d:"Position Size"},{l:"Small",v:"0.2–0.5"},{l:"Medium",v:"0.5–1.0"},{l:"Large",v:"1.0–1.5"},{l:"Randomization",v:"✅ ON"}],
      Signals:[{l:"Min Strength",v:"1 (All)",n:"Same as Degen"},{l:"Signal Types",v:"All accepted"}],
      "Risk Management":[{l:"Filter Mode",v:"No Filter"},{d:"Token Metrics"},{l:"Min Mcap",v:"—"},{l:"Min Liq",v:"—"},{l:"Min Holders",v:"—"},{i:"No filters — benchmark."}],
      "Stop Loss":[{l:"Enabled",v:"✅ ON"},{l:"Default",v:"-32%",n:"Wider than custom agents"},{l:"Strategy",v:"Exponential Decay (PRESET)"},{i:"Same preset most users run."},{d:"Behavior"},{t:[["Price ↑","SL Set At"],["+10%","-32%"],["+25%","3.7%"],["+50%","30.8%"],["+100%","90%"]]}],
      "Take-Profit":[{l:"Enabled",v:"❌ OFF"},{i:"No TP — relies on stop loss only."}],
      DCA:[{l:"Enabled",v:"❌ OFF"}],
      "Stale Trade":[{l:"Enabled",v:"✅ ON"},{l:"Hold Time",v:"60 min"},{l:"P/L Range",v:"1%–10%"}]},
  };
  const renderField=(f,i)=>{
    if(f.d)return <div key={i} style={{padding:"9px 0 3px",borderBottom:`1px solid ${a.color}25`}}><span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:a.color,fontFamily:M}}>{f.d}</span></div>;
    if(f.i)return <div key={i} style={{margin:"6px 0",padding:"8px 12px",background:`${a.color}06`,borderLeft:`3px solid ${a.color}40`,borderRadius:"0 6px 6px 0",fontSize:11,color:"#808098",lineHeight:1.5,fontStyle:"italic"}}>{f.i}</div>;
    if(f.t)return <div key={i} style={{margin:"6px 0"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{f.t[0].map((h,j)=><th key={j} style={{padding:"5px 10px",background:`${a.color}14`,color:"#c0c0d0",textAlign:"left",fontWeight:700,borderBottom:`2px solid ${a.color}20`,fontFamily:M,fontSize:10}}>{h}</th>)}</tr></thead><tbody>{f.t.slice(1).map((row,ri)=><tr key={ri}>{row.map((cell,ci)=><td key={ci} style={{padding:"4px 10px",borderBottom:"1px solid #141428",color:ci===0?a.color:"#a0a0b8",fontFamily:M,fontSize:11,fontWeight:ci===0?700:400}}>{cell}</td>)}</tr>)}</tbody></table></div>;
    return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:"7px 0",borderBottom:"1px solid #10102a",alignItems:"center"}}>
      <div><div style={{fontSize:11.5,color:"#b0b0c8",fontWeight:500}}>{f.l}</div>{f.n&&<div style={{fontSize:9.5,color:"#484868",marginTop:1}}>{f.n}</div>}</div>
      <div style={{fontFamily:M,fontSize:11.5,fontWeight:700,textAlign:"right",padding:"4px 10px",background:"#08081440",borderRadius:4,border:`1px solid ${a.color}18`,color:f.v?.startsWith("✅")?"#22c55e":f.v?.startsWith("❌")?"#ef4444":f.v==="—"?"#383850":a.color}}>{f.v}</div>
    </div>;
  };
  return <div>
    <FilterBar>
      <FilterLabel>Agent</FilterLabel>
      <Select value={sel} onChange={v=>{setSel(v);setTab("Purchase & Position");}}>
        {AK.map(k=><option key={k} value={k}>{AG[k].icon} {AG[k].name}</option>)}
      </Select>
      <FilterDivider/>
      <FilterLabel>Tab</FilterLabel>
      <Select value={tab} onChange={setTab}>
        {TABS.map(t=><option key={t} value={t}>{t}</option>)}
      </Select>
      <FilterDivider/>
      {s.n>0&&<span style={{fontSize:10,color:"#606078"}}>{s.n} trades · Exp: <Mono style={{color:pc(s.expectancy)}}>{s.expectancy>=0?"+":""}{s.expectancy.toFixed(2)}%</Mono> · R:R: <Mono style={{color:s.rr>=1?"#22c55e":"#ef4444"}}>{s.rr.toFixed(2)}x</Mono> · P/L: <PnL v={s.totalPnl}/></span>}
    </FilterBar>
    <div style={{margin:"0 0 12px",padding:"10px 14px",background:`${a.color}06`,borderLeft:`3px solid ${a.color}`,borderRadius:"0 6px 6px 0",fontSize:11,color:"#808098",lineHeight:1.5}}>
      <span style={{fontWeight:700,color:a.color}}>{a.icon} {a.name}</span>{" — "}
      {sel==="degen"?"Accept every signal, trade anything, ride to big multipliers.":sel==="pro"?"Balanced — strict filters, offset stop losses, stale trade closure.":sel==="scalper"?"Quick in/out — tight stops, ultra-early profit-taking.":"Control benchmark — all defaults, Exponential Decay, no TP."}
    </div>
    <Card accent={a.color}>{(configs[sel]?.[tab]||[]).map(renderField)}</Card>
  </div>;
}

// ═══════════════════════════════
// ANALYTICS PAGE
// ═══════════════════════════════
function AnalyticsPage({trades,modeFilter}) {
  const SIGNAL_TYPES = useMemo(() => [...new Set(trades.map(t=>t.signalType).filter(Boolean))], [trades]);
  const [fm,setFm]=useState(modeFilter);
  const [fst,setFst]=useState("all");
  const ft=useMemo(()=>{let r=fm==="all"?[...trades]:trades.filter(t=>t.mode===fm);if(fst!=="all")r=r.filter(t=>t.signalType===fst);return r;},[trades,fm,fst]);
  const agentComp=useMemo(()=>AK.map(k=>({k,...calcStats(ft.filter(t=>t.agent===k))})).filter(d=>d.n>0).sort((a,b)=>b.expectancy-a.expectancy),[ft]);
  const stByAgent=useMemo(()=>{const m={};ft.forEach(t=>{const k=`${t.agent}|${t.signalType}`;if(!m[k])m[k]={agent:t.agent,type:t.signalType,n:0,w:0,pnl:0,pct:0};m[k].n++;if(t.pnlUsd>0)m[k].w++;m[k].pnl+=t.pnlUsd;m[k].pct+=t.changePct;});return Object.values(m).map(d=>({...d,wr:d.n?d.w/d.n*100:0,avg:d.n?d.pct/d.n:0})).filter(d=>d.n>=3).sort((a,b)=>b.avg-a.avg);},[ft]);
  const strByAgent=useMemo(()=>{const m={};ft.forEach(t=>{if(!t.signalStrength)return;const k=`${t.agent}|${t.signalStrength}`;if(!m[k])m[k]={agent:t.agent,str:t.signalStrength,n:0,w:0,pnl:0,pct:0};m[k].n++;if(t.pnlUsd>0)m[k].w++;m[k].pnl+=t.pnlUsd;m[k].pct+=t.changePct;});return Object.values(m).map(d=>({...d,wr:d.n?d.w/d.n*100:0,avg:d.n?d.pct/d.n:0})).sort((a,b)=>a.str===b.str?a.agent.localeCompare(b.agent):a.str-b.str);},[ft]);
  const cumPnl=useMemo(()=>{const by={};AK.forEach(k=>{by[k]=[];});const sorted=[...ft].sort((a,b)=>new Date(a.time||0)-new Date(b.time||0));const run={};AK.forEach(k=>{run[k]=0;});sorted.forEach((t,i)=>{if(!run.hasOwnProperty(t.agent))return;run[t.agent]+=t.pnlUsd;by[t.agent].push({i,pnl:+run[t.agent].toFixed(2)});});return by;},[ft]);
  const [sort,onSort]=useSort("pct","desc");

  return <div>
    <FilterBar>
      <FilterLabel>Mode</FilterLabel>
      <Select value={fm} onChange={setFm}>
        <option value="all">All Modes</option>
        <option value="live">🟡 Live</option>
        <option value="sim">⚪ Simulation</option>
      </Select>
      <FilterDivider/>
      <FilterLabel>Signal</FilterLabel>
      <Select value={fst} onChange={setFst}>
        <option value="all">All Signals</option>
        {SIGNAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
      </Select>
      <FilterDivider/>
      <span style={{fontSize:10,color:"#484868",fontFamily:M}}>{ft.length} trades analyzed</span>
    </FilterBar>

    {Object.values(cumPnl).some(a=>a.length>1)&&<Card><CTitle>Cumulative P/L Over Time</CTitle><ResponsiveContainer width="100%" height={220}><LineChart><CartesianGrid strokeDasharray="3 3" stroke="#141428"/><XAxis dataKey="i" tick={false}/><YAxis tick={{fontSize:10,fill:"#484868"}}/><Tooltip contentStyle={{background:"#0c0c1a",border:"1px solid #1a1a30",borderRadius:6,fontSize:11}}/>{AK.map(k=>cumPnl[k].length>1&&<Line key={k} data={cumPnl[k]} dataKey="pnl" name={AG[k].name} stroke={AG[k].color} strokeWidth={2} dot={false}/>)}<Legend iconType="line" wrapperStyle={{fontSize:11}}/></LineChart></ResponsiveContainer></Card>}

    <Card><CTitle>Agent Comparison</CTitle><div style={{fontSize:9,color:"#383850",marginTop:-8,marginBottom:10}}>Sorted by expectancy — the true measure of edge</div>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["#","Agent","Trades","Avg Return","Expectancy","R:R","WR","Avg Win","Avg Loss","PF","P/L"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{agentComp.map((d,rank)=><tr key={d.k} style={{background:rank===0?"#22c55e06":"transparent"}}><TD><Mono style={{color:rank===0?"#22c55e":rank===agentComp.length-1?"#ef4444":"#484868",fontWeight:700}}>#{rank+1}</Mono></TD><TD><ABadge k={d.k}/></TD><TD><Mono>{d.n}</Mono></TD><TD><Mono style={{color:pc(d.avgReturn),fontWeight:700,fontSize:12}}>{d.avgReturn>=0?"+":""}{d.avgReturn.toFixed(2)}%</Mono></TD><TD><Mono style={{color:pc(d.expectancy),fontWeight:700,fontSize:12}}>{d.expectancy>=0?"+":""}{d.expectancy.toFixed(2)}%</Mono></TD><TD><Mono style={{color:d.rr>=1?"#22c55e":"#ef4444"}}>{d.rr.toFixed(2)}x</Mono></TD><TD><Mono style={{color:pc(d.winRate-50)}}>{d.winRate.toFixed(1)}%</Mono></TD><TD><Mono style={{color:"#22c55e"}}>+{d.avgWinPct.toFixed(1)}%</Mono></TD><TD><Mono style={{color:"#ef4444"}}>{d.avgLossPct.toFixed(1)}%</Mono></TD><TD><Mono style={{color:d.profitFactor>=1?"#22c55e":"#ef4444"}}>{d.profitFactor>0?d.profitFactor.toFixed(2):"—"}</Mono></TD><TD><PnL v={d.totalPnl}/></TD></tr>)}</tbody></table>
    </Card>

    <Card><CTitle color="#eab308">Signal Strength × Agent</CTitle>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Agent","Str","Trades","Avg Return","Win Rate","P/L"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{strByAgent.map((d,i)=><tr key={i} style={{background:d.avg>=0?"#22c55e06":d.avg<-3?"#ef444406":"transparent"}}><TD><ABadge k={d.agent}/></TD><TD><Mono style={{fontSize:14,fontWeight:800,color:d.str>=4?"#22c55e":d.str>=3?"#eab308":d.str>=2?"#f97316":"#ef4444"}}>{d.str}</Mono></TD><TD><Mono>{d.n}</Mono></TD><TD><Mono style={{color:pc(d.avg),fontWeight:700,fontSize:12}}>{d.avg>=0?"+":""}{d.avg.toFixed(2)}%</Mono></TD><TD><Mono style={{color:pc(d.wr-50)}}>{d.wr.toFixed(1)}%</Mono></TD><TD><PnL v={d.pnl}/></TD></tr>)}</tbody></table>
    </Card>

    <Card><CTitle>Signal Type × Agent</CTitle>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Agent","Signal","Trades","Avg Return","WR","P/L"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{stByAgent.map((d,i)=><tr key={i} style={{background:d.avg>=0?"#22c55e06":"transparent"}}><TD><ABadge k={d.agent}/></TD><TD><Badge color={d.avg>=0?"#22c55e":d.avg>=-2?"#eab308":"#ef4444"}>{d.type}</Badge></TD><TD><Mono>{d.n}</Mono></TD><TD><Mono style={{color:pc(d.avg),fontWeight:700,fontSize:12}}>{d.avg>=0?"+":""}{d.avg.toFixed(2)}%</Mono></TD><TD><Mono style={{color:pc(d.wr-50)}}>{d.wr.toFixed(1)}%</Mono></TD><TD><PnL v={d.pnl}/></TD></tr>)}</tbody></table>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card><CTitle color="#22c55e">🏆 Best Trades</CTitle><TradeTable trades={sortTrades(ft,{key:"pct",dir:"desc"})} limit={10} sort={{key:"pct",dir:"desc"}} onSort={()=>{}}/></Card>
      <Card><CTitle color="#ef4444">💀 Worst Trades</CTitle><TradeTable trades={sortTrades(ft,{key:"pct",dir:"asc"})} limit={10} sort={{key:"pct",dir:"asc"}} onSort={()=>{}}/></Card>
    </div>
  </div>;
}

// ═══════════════════════════════
// AI ADVISOR PAGE
// ═══════════════════════════════
function AdvisorPage({ trades, signals }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).slice(2,7)}`);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

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
    const msg = text || input.trim();
    if (!msg || streaming) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: msg }];
    setMessages([...newMessages, { role: "assistant", content: "", streaming: true }]);
    setStreaming(true);

    try {
      const context = buildContext();
      // Build history for multi-turn (exclude the current message)
      const history = newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, context, history, conversationId }),
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
  }, [input, messages, streaming, buildContext, conversationId, loadConversations]);

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
      // Bold
      const parts = [];
      let remaining = t;
      while (remaining) {
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        if (boldMatch) {
          const before = remaining.slice(0, boldMatch.index);
          if (before) parts.push(before);
          parts.push(<strong key={parts.length} style={{color:"#e0e0f0",fontWeight:700}}>{boldMatch[1]}</strong>);
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
      const dataRows = tableRows.slice(2); // skip separator
      elements.push(
        <div key={elements.length} style={{overflowX:"auto",margin:"8px 0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,fontFamily:M}}>
            <thead><tr>{headers.map((h,i)=><th key={i} style={{padding:"5px 8px",background:"#141428",color:"#808098",textAlign:"left",fontWeight:700,borderBottom:"2px solid #1e1e38",whiteSpace:"nowrap"}}>{h.trim()}</th>)}</tr></thead>
            <tbody>{dataRows.map((row,ri)=><tr key={ri}>{row.map((cell,ci)=><td key={ci} style={{padding:"4px 8px",borderBottom:"1px solid #10102a",color:cell.trim().startsWith("+")||cell.trim().startsWith("$")&&!cell.includes("-")?"#22c55e":cell.trim().startsWith("-")?"#ef4444":"#a0a0b8",whiteSpace:"nowrap"}}>{cell.trim()}</td>)}</tr>)}</tbody>
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
          elements.push(<pre key={elements.length} style={{background:"#08081a",border:"1px solid #1a1a30",borderRadius:6,padding:"10px 14px",margin:"8px 0",fontSize:10,fontFamily:M,color:"#a0a0c0",overflowX:"auto"}}>{codeLines.join("\n")}</pre>);
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
      if (line.startsWith("### ")) { elements.push(<div key={elements.length} style={{fontSize:13,fontWeight:700,color:"#e0e0f0",margin:"14px 0 6px",letterSpacing:-.3}}>{processInline(line.slice(4))}</div>); continue; }
      if (line.startsWith("## ")) { elements.push(<div key={elements.length} style={{fontSize:14,fontWeight:800,color:"#fff",margin:"16px 0 8px",letterSpacing:-.3}}>{processInline(line.slice(3))}</div>); continue; }
      if (line.startsWith("# ")) { elements.push(<div key={elements.length} style={{fontSize:16,fontWeight:800,color:"#fff",margin:"18px 0 8px"}}>{processInline(line.slice(2))}</div>); continue; }

      // Bullet points
      if (line.match(/^[\s]*[-*]\s/)) {
        const indent = line.match(/^(\s*)/)[1].length;
        elements.push(<div key={elements.length} style={{paddingLeft:12+indent*8,position:"relative",margin:"3px 0",lineHeight:1.6}}><span style={{position:"absolute",left:indent*8,color:"#4285F4"}}>•</span>{processInline(line.replace(/^[\s]*[-*]\s/,""))}</div>);
        continue;
      }

      // Numbered lists
      if (line.match(/^\d+\.\s/)) {
        const num = line.match(/^(\d+)\./)[1];
        elements.push(<div key={elements.length} style={{paddingLeft:20,position:"relative",margin:"3px 0",lineHeight:1.6}}><span style={{position:"absolute",left:0,color:"#4285F4",fontWeight:700,fontFamily:M,fontSize:10}}>{num}.</span>{processInline(line.replace(/^\d+\.\s/,""))}</div>);
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
    <div style={{width:showHistory?260:0,transition:"width .2s",overflow:"hidden",borderRight:"1px solid #141428",background:"#08080f",flexShrink:0}}>
      <div style={{width:260,height:"100%",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"14px 12px",borderBottom:"1px solid #141428",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#404058"}}>History</span>
          <button onClick={newConversation} style={{background:"#1a1a30",border:"1px solid #2a2a48",borderRadius:5,padding:"4px 10px",color:"#808098",cursor:"pointer",fontSize:9,fontFamily:F}}>+ New</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px"}}>
          {loadingHistory && <div style={{padding:16,textAlign:"center",fontSize:10,color:"#383850"}}>Loading...</div>}
          {conversations.map(c => (
            <div key={c.id} onClick={() => loadConversation(c.id)}
              style={{padding:"8px 10px",borderRadius:6,marginBottom:2,cursor:"pointer",background:c.id===conversationId?"#12122a":"transparent",borderLeft:c.id===conversationId?"3px solid #4285F4":"3px solid transparent"}}>
              <div style={{fontSize:11,color:c.id===conversationId?"#e0e0e8":"#808098",fontWeight:c.id===conversationId?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:3}}>
                <span style={{fontSize:8,color:"#383850",fontFamily:M}}>{c.messageCount} msgs · {new Date(c.updatedAt).toLocaleDateString()}</span>
                <button onClick={(e) => deleteConversation(c.id, e)}
                  style={{background:"none",border:"none",color:"#383850",cursor:"pointer",fontSize:10,padding:"0 2px"}}
                  title="Delete">×</button>
              </div>
            </div>
          ))}
          {!loadingHistory && !conversations.length && <div style={{padding:16,textAlign:"center",fontSize:10,color:"#383850"}}>No saved conversations</div>}
        </div>
      </div>
    </div>

    {/* Center: Chat Area */}
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      {/* Chat header */}
      <div style={{padding:"10px 16px",borderBottom:"1px solid #141428",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#0a0a14",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={() => setShowHistory(!showHistory)}
            style={{background:"#1a1a30",border:"1px solid #2a2a48",borderRadius:5,padding:"4px 8px",color:"#808098",cursor:"pointer",fontSize:11}}>
            {showHistory ? "◀" : "▶"} History
          </button>
          <span style={{fontSize:10,color:"#484868",fontFamily:M}}>
            {messages.filter(m=>m.role==="user").length} messages
          </span>
        </div>
        <button onClick={newConversation}
          style={{background:"#1a1a30",border:"1px solid #2a2a48",borderRadius:5,padding:"4px 10px",color:"#808098",cursor:"pointer",fontSize:10,fontFamily:F}}>
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
        {!messages.length && (
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:40,marginBottom:12}}>🧠</div>
            <div style={{fontSize:16,fontWeight:700,color:"#e0e0e8",marginBottom:6}}>Nexgent AI Advisor</div>
            <div style={{fontSize:11,color:"#606078",maxWidth:500,margin:"0 auto",lineHeight:1.6}}>
              I analyze your trading agent data and provide actionable recommendations. Ask me about agent performance, strategy optimization, signal analysis, or setting changes.
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:24}}>
              {quickActions.map(qa => (
                <button key={qa.label} onClick={() => sendMessage(qa.prompt)}
                  style={{background:"#0e0e1e",border:"1px solid #1e1e38",borderRadius:8,padding:"10px 16px",color:"#a0a0b8",cursor:"pointer",fontSize:11,fontFamily:F,maxWidth:200,textAlign:"left",transition:"all .15s"}}
                  onMouseEnter={e=>{e.target.style.borderColor="#4285F4";e.target.style.color="#e0e0e8";}}
                  onMouseLeave={e=>{e.target.style.borderColor="#1e1e38";e.target.style.color="#a0a0b8";}}>
                  {qa.label}
                </button>
              ))}
            </div>
            <div style={{marginTop:24,fontSize:9,color:"#303048",fontFamily:M}}>
              Powered by Claude Sonnet 4.6 · Conversations are saved automatically
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:12}}>
            <div style={{
              maxWidth:m.role==="user"?"70%":"85%",
              padding:m.role==="user"?"10px 14px":"14px 18px",
              borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",
              background:m.role==="user"?"#1a2a4a":"#0c0c1a",
              border:m.role==="user"?"1px solid #2a3a5a":`1px solid ${m.error?"#3a1a1a":"#1a1a2e"}`,
              fontSize:12,
              lineHeight:1.6,
              color:m.role==="user"?"#d0d8f0":"#b0b0c8",
            }}>
              {m.role === "assistant" ? renderMarkdown(m.content) : m.content}
              {m.streaming && <span style={{display:"inline-block",width:6,height:14,background:"#4285F4",marginLeft:2,animation:"blink 1s infinite"}}/>}
            </div>
          </div>
        ))}
        <div ref={chatEndRef}/>
      </div>

      {/* Input area */}
      <div style={{padding:"12px 16px",borderTop:"1px solid #141428",background:"#0a0a14",flexShrink:0}}>
        {messages.length > 0 && (
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
            {quickActions.map(qa => (
              <button key={qa.label} onClick={() => sendMessage(qa.prompt)} disabled={streaming}
                style={{background:"#0e0e1e",border:"1px solid #1a1a30",borderRadius:5,padding:"4px 10px",color:"#606078",cursor:streaming?"not-allowed":"pointer",fontSize:9,fontFamily:F,opacity:streaming?.5:1}}>
                {qa.label}
              </button>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
            placeholder={streaming?"AI is thinking...":"Ask about your trading agents..."}
            disabled={streaming}
            style={{flex:1,background:"#0e0e1e",border:"1px solid #1e1e38",borderRadius:8,padding:"10px 14px",color:"#c0c0d8",fontSize:12,fontFamily:F,outline:"none"}}/>
          <button onClick={() => sendMessage()} disabled={streaming || !input.trim()}
            style={{background:streaming||!input.trim()?"#1a1a30":"#4285F4",border:"none",borderRadius:8,padding:"10px 18px",color:streaming||!input.trim()?"#484868":"#fff",cursor:streaming||!input.trim()?"not-allowed":"pointer",fontSize:12,fontWeight:700,fontFamily:F}}>
            {streaming ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>

    {/* Right: Data Context Panel */}
    <div style={{width:280,borderLeft:"1px solid #141428",background:"#08080f",overflowY:"auto",flexShrink:0}}>
      <div style={{padding:"14px 12px",borderBottom:"1px solid #141428"}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#404058"}}>Data Context</span>
        <div style={{fontSize:8,color:"#303040",fontFamily:M,marginTop:3}}>{trades.length} trades · {signals.length} signals</div>
      </div>

      <div style={{padding:"10px 12px"}}>
        {AK.map(k => {
          const a = AG[k];
          const ft = trades.filter(t => t.agent === k);
          if (!ft.length) return null;
          const s = calcStats(ft);
          const liveFt = ft.filter(t => t.mode === "live");
          const simFt = ft.filter(t => t.mode === "sim");
          return <div key={k} style={{marginBottom:12,padding:"10px",background:"#0c0c1a",border:"1px solid #141428",borderRadius:8,borderLeft:`3px solid ${a.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,color:a.color}}>{a.icon} {a.name}</span>
              <span style={{fontSize:8,fontFamily:M,color:"#383850"}}>{ft.length} trades</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px",fontSize:9}}>
              <div><span style={{color:"#484860"}}>WR: </span><span style={{fontFamily:M,color:pc(s.winRate-50)}}>{s.winRate.toFixed(1)}%</span></div>
              <div><span style={{color:"#484860"}}>Exp: </span><span style={{fontFamily:M,color:pc(s.expectancy)}}>{s.expectancy>=0?"+":""}{s.expectancy.toFixed(2)}%</span></div>
              <div><span style={{color:"#484860"}}>R:R: </span><span style={{fontFamily:M,color:s.rr>=1?"#22c55e":"#ef4444"}}>{s.rr.toFixed(2)}x</span></div>
              <div><span style={{color:"#484860"}}>PF: </span><span style={{fontFamily:M,color:s.profitFactor>=1?"#22c55e":"#ef4444"}}>{s.profitFactor.toFixed(2)}</span></div>
              <div style={{gridColumn:"1/-1"}}><span style={{color:"#484860"}}>P/L: </span><span style={{fontFamily:M,color:pc(s.totalPnl),fontWeight:700}}>{s.totalPnl>=0?"+":""}${s.totalPnl.toFixed(2)}</span></div>
              {liveFt.length > 0 && <div style={{gridColumn:"1/-1",fontSize:8,color:"#383850"}}>Live: {liveFt.length} · Sim: {simFt.length}</div>}
            </div>
          </div>;
        })}

        {signals.length > 0 && <div style={{marginTop:8,padding:"10px",background:"#0c0c1a",border:"1px solid #141428",borderRadius:8}}>
          <div style={{fontSize:10,fontWeight:700,color:"#eab308",marginBottom:6}}>📡 Signals</div>
          <div style={{fontSize:9,color:"#606078"}}>{signals.length} total signals received</div>
          <div style={{fontSize:8,color:"#383850",fontFamily:M,marginTop:4}}>
            Types: {[...new Set(signals.map(s=>s.type).filter(Boolean))].join(", ") || "—"}
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
function ImportPage({ allTrades, allSignals, onRefresh }) {
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
    border: `2px dashed ${active ? "#4285F4" : "#1e1e38"}`, borderRadius: 10,
    padding: "28px 20px", textAlign: "center", cursor: "pointer",
    background: active ? "#4285F410" : "#0a0a18", transition: "all .2s",
    marginBottom: 14,
  });

  const agentCounts = useMemo(() => {
    const c = {};
    AK.forEach(k => { c[k] = { total: 0, live: 0, sim: 0 }; });
    allTrades.forEach(t => { if (c[t.agent]) { c[t.agent].total++; if (t.mode === "live") c[t.agent].live++; else c[t.agent].sim++; } });
    return c;
  }, [allTrades]);

  return <div>
    {msg && <div style={{ padding: "10px 16px", marginBottom: 16, borderRadius: 8, background: msg.type === "success" ? "#22c55e10" : "#ef444410", border: `1px solid ${msg.type === "success" ? "#22c55e30" : "#ef444430"}`, color: msg.type === "success" ? "#22c55e" : "#ef4444", fontSize: 12, fontFamily: M, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{msg.text}</span>
      <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", color: "#606078", cursor: "pointer", fontSize: 14 }}>x</button>
    </div>}

    {/* Data Summary */}
    <Card>
      <CTitle>Current Data in Firebase</CTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
        <div style={{ textAlign: "center", padding: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: M, color: "#e0e0e8" }}>{allTrades.length}</div>
          <div style={{ fontSize: 8, color: "#484860", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 3 }}>Total Trades</div>
        </div>
        {AK.map(k => <div key={k} style={{ textAlign: "center", padding: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: AG[k].color }}>{agentCounts[k].total}</div>
          <div style={{ fontSize: 8, color: "#484860", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 3 }}>{AG[k].icon} {AG[k].name}</div>
          <div style={{ fontSize: 8, color: "#303048", fontFamily: M, marginTop: 2 }}>{agentCounts[k].live}L / {agentCounts[k].sim}S</div>
        </div>)}
      </div>
      <div style={{ textAlign: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid #141428" }}>
        <span style={{ fontSize: 11, fontFamily: M, color: "#606078" }}>{allSignals.length} signals</span>
      </div>
    </Card>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Trade Import */}
      <Card accent="#4285F4">
        <CTitle color="#4285F4">Trade History Import</CTitle>
        <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FilterLabel>Agent</FilterLabel>
            <Select value={tradeAgent} onChange={setTradeAgent} style={{ width: "100%", marginTop: 4 }}>
              {AK.map(k => <option key={k} value={k}>{AG[k].icon} {AG[k].name}</option>)}
            </Select>
          </div>
          <div style={{ flex: 1 }}>
            <FilterLabel>Mode</FilterLabel>
            <Select value={tradeMode} onChange={setTradeMode} style={{ width: "100%", marginTop: 4 }}>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4285F4", marginBottom: 4 }}>{tradeFile.name}</div>
            <div style={{ fontSize: 10, color: "#606078" }}>{tradeParsed.length} trades parsed</div>
          </div> : <div>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
            <div style={{ fontSize: 11, color: "#606078" }}>Drop trade CSV here or click to browse</div>
            <div style={{ fontSize: 9, color: "#383850", marginTop: 4 }}>Nexgent Trade History format</div>
          </div>}
        </div>

        {tradeParsed.length > 0 && <div>
          <div style={{ fontSize: 9, color: "#484868", marginBottom: 6, fontFamily: M }}>Preview (first 5 rows)</div>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Token", "P/L", "%", "Signal", "Time"].map(h => <th key={h} style={{ padding: "4px 8px", fontSize: 8, color: "#606078", textAlign: "left", borderBottom: "1px solid #1a1a30", fontFamily: M, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>)}</tr></thead>
              <tbody>{tradeParsed.slice(0, 5).map((t, i) => <tr key={i}>
                <td style={{ padding: "3px 8px", fontSize: 10, color: "#c0c0d8", fontFamily: M, fontWeight: 700 }}>{t.token}</td>
                <td style={{ padding: "3px 8px", fontSize: 10, fontFamily: M, color: pc(t.pnl) }}>{t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}</td>
                <td style={{ padding: "3px 8px", fontSize: 10, fontFamily: M, color: pc(t.pnlPercent) }}>{t.pnlPercent >= 0 ? "+" : ""}{t.pnlPercent.toFixed(1)}%</td>
                <td style={{ padding: "3px 8px", fontSize: 9, color: "#585878" }}>{(t.signalType || "").slice(0, 30)}</td>
                <td style={{ padding: "3px 8px", fontSize: 8, color: "#383850", fontFamily: M }}>{new Date(t.timestamp).toLocaleDateString()}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <button onClick={importTrades} disabled={importing} style={{ width: "100%", padding: "10px", background: importing ? "#1a1a30" : "#4285F4", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 700, cursor: importing ? "wait" : "pointer", fontFamily: F }}>
            {importing ? "Importing..." : `Import ${tradeParsed.length} Trades`}
          </button>
        </div>}
      </Card>

      {/* Signal Import */}
      <Card accent="#eab308">
        <CTitle color="#eab308">Signals Import</CTitle>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "#585878", padding: "8px 0" }}>Signals are shared across all agents</div>
        </div>

        <div style={dropZoneStyle(!!signalFile)}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); handleSignalFile(e.dataTransfer.files[0]); }}
          onClick={() => signalInputRef.current?.click()}>
          <input ref={signalInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleSignalFile(e.target.files[0])} />
          {signalFile ? <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#eab308", marginBottom: 4 }}>{signalFile.name}</div>
            <div style={{ fontSize: 10, color: "#606078" }}>{signalParsed.length} signals parsed</div>
          </div> : <div>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📡</div>
            <div style={{ fontSize: 11, color: "#606078" }}>Drop signals CSV here or click to browse</div>
            <div style={{ fontSize: 9, color: "#383850", marginTop: 4 }}>Nexgent Trading Signals format</div>
          </div>}
        </div>

        {signalParsed.length > 0 && <div>
          <div style={{ fontSize: 9, color: "#484868", marginBottom: 6, fontFamily: M }}>Preview (first 5 rows)</div>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Token", "Strategy", "Str", "Time"].map(h => <th key={h} style={{ padding: "4px 8px", fontSize: 8, color: "#606078", textAlign: "left", borderBottom: "1px solid #1a1a30", fontFamily: M, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>)}</tr></thead>
              <tbody>{signalParsed.slice(0, 5).map((s, i) => <tr key={i}>
                <td style={{ padding: "3px 8px", fontSize: 10, color: "#c0c0d8", fontFamily: M, fontWeight: 700 }}>{s.token}</td>
                <td style={{ padding: "3px 8px", fontSize: 9, color: "#585878" }}>{(s.tradingStrategy || "").slice(0, 30)}</td>
                <td style={{ padding: "3px 8px", fontSize: 11, fontFamily: M, fontWeight: 800, color: s.signalStrength >= 4 ? "#22c55e" : s.signalStrength >= 3 ? "#eab308" : s.signalStrength >= 2 ? "#f97316" : "#ef4444" }}>{s.signalStrength}</td>
                <td style={{ padding: "3px 8px", fontSize: 8, color: "#383850", fontFamily: M }}>{new Date(s.signalReceivedAt).toLocaleDateString()}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <button onClick={importSignals} disabled={importing} style={{ width: "100%", padding: "10px", background: importing ? "#1a1a30" : "#eab308", border: "none", borderRadius: 6, color: "#000", fontSize: 12, fontWeight: 700, cursor: importing ? "wait" : "pointer", fontFamily: F }}>
            {importing ? "Importing..." : `Import ${signalParsed.length} Signals`}
          </button>
        </div>}
      </Card>
    </div>

    {/* Clear Data */}
    <Card style={{ marginTop: 8 }}>
      <CTitle color="#ef4444">Data Management</CTitle>
      <div style={{ display: "flex", gap: 10 }}>
        {confirmClear ? <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#ef4444" }}>Clear {confirmClear}? This cannot be undone.</span>
          <button onClick={() => clearData(confirmClear)} disabled={importing} style={{ padding: "6px 16px", background: "#ef4444", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: F }}>Confirm</button>
          <button onClick={() => setConfirmClear(null)} style={{ padding: "6px 16px", background: "#1a1a30", border: "1px solid #2a2a48", borderRadius: 4, color: "#808098", fontSize: 10, cursor: "pointer", fontFamily: F }}>Cancel</button>
        </div> : <>
          <button onClick={() => setConfirmClear("trades")} style={{ padding: "6px 16px", background: "#1a1a30", border: "1px solid #ef444430", borderRadius: 4, color: "#ef4444", fontSize: 10, cursor: "pointer", fontFamily: F }}>Clear All Trades</button>
          <button onClick={() => setConfirmClear("signals")} style={{ padding: "6px 16px", background: "#1a1a30", border: "1px solid #ef444430", borderRadius: 4, color: "#ef4444", fontSize: 10, cursor: "pointer", fontFamily: F }}>Clear All Signals</button>
          <button onClick={() => setConfirmClear("all")} style={{ padding: "6px 16px", background: "#1a1a30", border: "1px solid #ef444430", borderRadius: 4, color: "#ef4444", fontSize: 10, cursor: "pointer", fontFamily: F }}>Clear Everything</button>
        </>}
      </div>
    </Card>

    {/* CSV Format Help */}
    <Card style={{ marginTop: 8 }}>
      <CTitle color="#505070">CSV Format Reference</CTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#4285F4", marginBottom: 6 }}>Trade History Columns</div>
          <div style={{ fontSize: 9, color: "#585878", lineHeight: 1.8, fontFamily: M }}>
            Time, Token Symbol, Token Address, Amount, Average Purchase Price (USD), Sale Price (USD), Profit / Loss (USD), Change (%), Signal ID, Signal Type, Activation Reason
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#eab308", marginBottom: 6 }}>Signals Columns</div>
          <div style={{ fontSize: 9, color: "#585878", lineHeight: 1.8, fontFamily: M }}>
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
  {key:"dashboard",label:"Dashboard",icon:"📊"},
  {key:"trades",label:"Trades",icon:"💰"},
  {key:"signals",label:"Signals",icon:"📡"},
  {key:"analytics",label:"Analytics",icon:"📈"},
  {key:"agents",label:"Agents",icon:"🤖"},
  {key:"import",label:"Import",icon:"📥"},
  {key:"advisor",label:"AI Advisor",icon:"🧠"},
];

export default function App(){
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

  const SIGNAL_TYPES = useMemo(() => [...new Set(allTrades.map(t => t.signalType).filter(Boolean))], [allTrades]);
  const lc = useMemo(() => allTrades.filter(t => t.mode === "live").length, [allTrades]);
  const sc = useMemo(() => allTrades.filter(t => t.mode === "sim").length, [allTrades]);

  return <div style={{minHeight:"100vh",background:"#06060e",color:"#c0c0d8",fontFamily:F}}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:#06060e}::-webkit-scrollbar-thumb{background:#1e1e38;border-radius:3px}::-webkit-scrollbar-thumb:hover{background:#2a2a48}select:focus{border-color:#3a3a60;box-shadow:0 0 0 1px #3a3a6040}table{font-variant-numeric:tabular-nums}`}</style>

    <div style={{width:190,background:"#0a0a14",borderRight:"1px solid #141428",position:"fixed",top:0,left:0,bottom:0,zIndex:100,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"20px 16px 14px",borderBottom:"1px solid #141428"}}>
        <div style={{fontSize:7,fontWeight:700,letterSpacing:3.5,color:"#303048",textTransform:"uppercase"}}>Nexgent AI</div>
        <div style={{fontSize:16,fontWeight:800,color:"#fff",letterSpacing:-.5,marginTop:2}}>Analytics</div>
        <div style={{fontSize:9,color:"#282840",marginTop:6,fontFamily:M}}>{loading?"loading...":fetchError?"connection error":`${allTrades.length} trades · ${allSignals.length} signals`}</div>
      </div>

      <nav style={{padding:"12px 8px",flex:1}}>
        {NAV.map(n=><button key={n.key} onClick={()=>setPage(n.key)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 10px",marginBottom:2,border:"none",borderRadius:6,background:page===n.key?"#12122440":"transparent",color:page===n.key?"#e0e0e8":"#484868",cursor:"pointer",fontSize:11.5,fontWeight:page===n.key?700:400,fontFamily:F,textAlign:"left",borderLeft:page===n.key?`3px solid #4285F4`:"3px solid transparent",transition:"all .15s"}}><span style={{fontSize:13}}>{n.icon}</span>{n.label}</button>)}
      </nav>

      <div style={{padding:"12px 14px",borderTop:"1px solid #141428"}}>
        <div style={{fontSize:7.5,fontWeight:700,letterSpacing:2,color:"#282840",textTransform:"uppercase",marginBottom:6}}>Data Mode</div>
        <Select value={mf} onChange={setMf} style={{width:"100%",fontSize:10}}>
          <option value="all">All ({allTrades.length})</option>
          <option value="live">🟡 Live ({lc})</option>
          <option value="sim">⚪ Sim ({sc})</option>
        </Select>
      </div>

      <div style={{padding:"10px 14px 14px",borderTop:"1px solid #141428"}}>
        <div style={{fontSize:7.5,fontWeight:700,letterSpacing:2,color:"#282840",textTransform:"uppercase",marginBottom:6}}>Agents</div>
        {AK.map(k=>{const ag=AG[k],n=allTrades.filter(t=>t.agent===k).length,nl=allTrades.filter(t=>t.agent===k&&t.mode==="live").length;return <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"3px 0"}}><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:5,height:5,borderRadius:"50%",background:ag.color}}/><span style={{fontSize:9,color:"#505068"}}>{ag.name}</span></div><span style={{fontSize:8,fontFamily:M,color:"#303048"}}>{nl>0?`${nl}L/`:""}{n-nl}S</span></div>;})}
      </div>
    </div>

    <div style={{marginLeft:190,padding:"0 28px 40px"}}>
      <div style={{padding:"22px 0 14px",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,color:"#fff",margin:0,letterSpacing:-.3}}>{NAV.find(n=>n.key===page)?.icon} {NAV.find(n=>n.key===page)?.label}</h1>
          <p style={{fontSize:10,color:"#383850",margin:"3px 0 0",fontFamily:M}}>
            {loading?"loading data from firebase...":fetchError?<span style={{color:"#ef4444"}}>{fetchError}</span>:`${mf==="live"?"live only":mf==="sim"?"simulation only":"all data"} · ${allTrades.length} trades`}
          </p>
        </div>
        {!loading && <button onClick={fetchData} style={{background:"#1a1a30",border:"1px solid #2a2a48",borderRadius:6,padding:"5px 12px",color:"#808098",cursor:"pointer",fontSize:10,fontFamily:F}}>Refresh</button>}
      </div>
      {loading && <Card style={{textAlign:"center",padding:60}}><div style={{fontSize:14,color:"#484868"}}>Loading data from Firebase...</div></Card>}
      {fetchError && !loading && <Card style={{textAlign:"center",padding:40}}><div style={{fontSize:13,color:"#ef4444",marginBottom:12}}>Could not connect to backend</div><div style={{fontSize:10,color:"#484868",fontFamily:M,marginBottom:16}}>{fetchError}</div><button onClick={fetchData} style={{background:"#1a1a30",border:"1px solid #2a2a48",borderRadius:6,padding:"8px 20px",color:"#808098",cursor:"pointer",fontSize:11,fontFamily:F}}>Retry</button></Card>}
      {!loading && !fetchError && <>
        {page==="dashboard"&&<Dashboard trades={allTrades} modeFilter={mf}/>}
        {page==="trades"&&<TradesPage trades={allTrades} modeFilter={mf}/>}
        {page==="signals"&&<SignalsPage signals={allSignals}/>}
        {page==="analytics"&&<AnalyticsPage trades={allTrades} modeFilter={mf}/>}
        {page==="agents"&&<AgentsPage trades={allTrades} modeFilter={mf}/>}
        {page==="import"&&<ImportPage allTrades={allTrades} allSignals={allSignals} onRefresh={fetchData}/>}
        {page==="advisor"&&<AdvisorPage trades={allTrades} signals={allSignals}/>}
      </>}
    </div>
  </div>;
}
