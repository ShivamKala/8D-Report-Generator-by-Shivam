
// API calls go through Netlify Function — key is safe on server
const callAI = async (systemPrompt, userPrompt) => {
  const res = await fetch("/.netlify/functions/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userPrompt })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `❌ Error ${res.status}`);
  }
  const data = await res.json();
  return data.text || "";
};

const DISCIPLINES = [
  { id: "D0", title: "Emergency Response",           color: "#ef4444", desc: "Immediate actions taken within first 24-48h" },
  { id: "D1", title: "Team Formation",               color: "#f97316", desc: "Cross-functional team with roles & responsibilities" },
  { id: "D2", title: "Problem Description",          color: "#eab308", desc: "IS / IS NOT — What, Where, When, How Many" },
  { id: "D3", title: "Interim Containment",          color: "#22c55e", desc: "Short-term actions to protect the customer" },
  { id: "D4", title: "Root Cause Analysis",          color: "#06b6d4", desc: "5-Why + Fishbone Diagram" },
  { id: "D5", title: "Permanent Corrective Actions", color: "#3b82f6", desc: "Select & verify best permanent solutions" },
  { id: "D6", title: "Implementation & Validation",  color: "#8b5cf6", desc: "Implement PCAs and validate effectiveness" },
  { id: "D7", title: "Preventive Actions",           color: "#ec4899", desc: "Prevent recurrence across similar systems" },
  { id: "D8", title: "Team Recognition",             color: "#14b8a6", desc: "Recognize team contributions & close 8D" },
];

const TIPS = {
  D0: "Immediate response: who was notified, what was quarantined, customer communication sent.",
  D1: "List team members: Name, Role, Department. Identify Team Leader and Management Champion.",
  D2: "IS/IS NOT: What is the defect? On which product? Where found? When first seen? How many?",
  D3: "Containment actions: 100% inspection, sorting, rework, hold inventory, customer notification.",
  D4: "Use 5-Why + Fishbone below to identify root cause and escape point.",
  D5: "Select best corrective actions, define verification criteria, assign owner and due date.",
  D6: "Implement PCA, collect validation data, confirm problem is solved with evidence.",
  D7: "Update FMEA, Control Plan, Work Instructions. Share lessons learned across similar processes.",
  D8: "Recognize team, document lessons learned, obtain management sign-off, close the report.",
};

const FISH_CATS = ["Man","Machine","Method","Material","Measurement","Environment"];

const INIT = {
  reportNumber:"", date:"", product:"", customer:"", partNumber:"", defectQty:"", severity:"",
  D0:"", D0title:"",
  D1:"",D2:"",D3:"",D5:"",D6:"",D7:"",D8:"",
  whyWhy:[{why:"",because:""},{why:"",because:""},{why:"",because:""},{why:"",because:""},{why:"",because:""}],
  fishbone: Object.fromEntries(FISH_CATS.map(c=>[c,""])),
  rcaSummary:"",
  failureImages:[], failureVideoLink:"",
  correctionImages:[], correctionVideoLink:"",
};

const toBase64 = f => new Promise(r=>{ const fr=new FileReader(); fr.onload=e=>r(e.target.result); fr.readAsDataURL(f); });
const esc = s => (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

function downloadReport(form) {
  const html = buildHTML(form);
  // Inject form data as hidden JSON inside the HTML so it can be reloaded later
  const htmlWithData = html.replace(
    "<\/body>",
    `<script id="8d-data" type="application/json">${JSON.stringify(form)}<\/script><\/body>`
  );
  const b64  = btoa(unescape(encodeURIComponent(htmlWithData)));
  const a    = document.createElement("a");
  a.href     = "data:text/html;base64," + b64;
  a.download = `8D_Report_${(form.reportNumber||"draft").replace(/\s+/g,"_")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Parse a previously downloaded HTML report back into form data
function loadReportFromHTML(htmlText) {
  try {
    const match = htmlText.match(/<script id="8d-data" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    // Make sure all required fields exist (backwards compat)
    return { ...INIT, ...data,
      whyWhy: data.whyWhy || INIT.whyWhy,
      fishbone: { ...INIT.fishbone, ...(data.fishbone||{}) },
      failureImages: data.failureImages || [],
      correctionImages: data.correctionImages || [],
    };
  } catch { return null; }
}

function buildHTML(form) {
  const whyRows = form.whyWhy.filter(w=>w.why||w.because);
  const fishRows = FISH_CATS.filter(c=>form.fishbone[c]);
  const imgBlock = imgs => imgs.map(i=>`<img src="${i.data}" style="max-width:160px;max-height:120px;border-radius:6px;border:1px solid #e2e8f0;margin:4px"/>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>8D Report ${esc(form.reportNumber)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#1e293b;padding:32px;font-size:13px}
.hdr{background:linear-gradient(135deg,#1e293b,#0f172a);color:#fff;padding:24px 28px;border-radius:10px;margin-bottom:16px}
.hdr h1{font-size:20px;font-weight:800;margin-bottom:3px}.hdr p{font-size:11px;opacity:.6;margin-bottom:12px}
.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.mi{background:rgba(255,255,255,.1);padding:8px 10px;border-radius:6px}
.mi label{font-size:8px;text-transform:uppercase;opacity:.6;display:block;margin-bottom:2px}
.mi span{font-size:12px;font-weight:700}
.card{background:#fff;border-radius:8px;padding:16px 18px;margin-bottom:12px;border-left:5px solid var(--c);box-shadow:0 1px 3px rgba(0,0,0,.07);page-break-inside:avoid}
.dh{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.badge{width:28px;height:28px;border-radius:50%;background:var(--c);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:9px;flex-shrink:0}
.dt{font-weight:700;font-size:14px}
.dtitle{font-size:12px;color:#64748b;margin-bottom:8px;padding-left:38px;font-style:italic}
.dc{color:#475569;line-height:1.7;white-space:pre-wrap;font-size:12.5px}
.empty{color:#cbd5e1;font-style:italic}
.stitle{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin:10px 0 6px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
th{background:#f1f5f9;padding:6px 10px;text-align:left;font-weight:700;border:1px solid #e2e8f0;font-size:11px}
td{padding:6px 10px;border:1px solid #e2e8f0;vertical-align:top}
.imgs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.foot{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0}
a{color:#3b82f6}
@media print{body{background:#fff;padding:20px}.card{break-inside:avoid}}
</style></head><body>
<div class="hdr">
  <h1>8D Problem Solving Report</h1>
  ${form.D0title ? `<div style="font-size:14px;font-weight:600;color:#fca5a5;margin:4px 0 2px;">📌 ${esc(form.D0title)}</div>` : ""}
  <p>Structured Quality Problem Resolution</p>
  <div class="meta">
    <div class="mi"><label>Report #</label><span>${esc(form.reportNumber)||"—"}</span></div>
    <div class="mi"><label>Date</label><span>${esc(form.date)||"—"}</span></div>
    <div class="mi"><label>Severity</label><span>${esc(form.severity)||"—"}</span></div>
    <div class="mi"><label>Product</label><span>${esc(form.product)||"—"}</span></div>
    <div class="mi"><label>Customer</label><span>${esc(form.customer)||"—"}</span></div>
    <div class="mi"><label>Part Number</label><span>${esc(form.partNumber)||"—"}</span></div>
    <div class="mi"><label>Defect Qty</label><span>${esc(form.defectQty)||"—"}</span></div>
  </div>
</div>

<div class="card" style="--c:#ef4444">
  <div class="dh"><div class="badge">D0</div><div class="dt">Emergency Response</div></div>
  ${form.D0title ? `<div class="dtitle">📌 ${esc(form.D0title)}</div>` : ""}
  <div class="dc ${form.D0?"":"empty"}">${form.D0 ? esc(form.D0) : "Not completed"}</div>
</div>

${["D1","D2","D3"].map(id=>{
  const d=DISCIPLINES.find(x=>x.id===id);
  return `<div class="card" style="--c:${d.color}"><div class="dh"><div class="badge">${id}</div><div class="dt">${d.title}</div></div><div class="dc ${form[id]?"":"empty"}">${form[id]?esc(form[id]):"Not completed"}</div></div>`;
}).join("")}

<div class="card" style="--c:#06b6d4">
  <div class="dh"><div class="badge">D4</div><div class="dt">Root Cause Analysis</div></div>
  ${whyRows.length?`<div class="stitle">5-Why Analysis</div><table><tr><th>#</th><th>Why?</th><th>Because…</th></tr>${whyRows.map((w,i)=>`<tr><td style="font-weight:700;color:#06b6d4;text-align:center">${i+1}</td><td>${esc(w.why)}</td><td>${esc(w.because)}</td></tr>`).join("")}</table>`:""}
  ${fishRows.length?`<div class="stitle" style="margin-top:12px">Fishbone Causes</div><table><tr><th>Category</th><th>Cause Identified</th></tr>${fishRows.map(c=>`<tr><td style="font-weight:700">${c}</td><td>${esc(form.fishbone[c])}</td></tr>`).join("")}</table>`:""}
  ${form.rcaSummary?`<div class="stitle" style="margin-top:12px">Root Cause Summary</div><div class="dc">${esc(form.rcaSummary)}</div>`:""}
  ${!whyRows.length&&!fishRows.length&&!form.rcaSummary?`<div class="dc empty">Root cause analysis not completed</div>`:""}
</div>

${["D5","D6","D7","D8"].map(id=>{
  const d=DISCIPLINES.find(x=>x.id===id);
  return `<div class="card" style="--c:${d.color}"><div class="dh"><div class="badge">${id}</div><div class="dt">${d.title}</div></div><div class="dc ${form[id]?"":"empty"}">${form[id]?esc(form[id]):"Not completed"}</div></div>`;
}).join("")}

<div class="card" style="--c:#64748b">
  <div class="dh"><div class="badge" style="font-size:14px;background:#334155">📎</div><div class="dt">Evidence & Media</div></div>
  ${form.failureImages.length?`<div class="stitle">Failure Images</div><div class="imgs">${imgBlock(form.failureImages)}</div>`:""}
  ${form.failureVideoLink?`<div class="stitle">Failure Video</div><a href="${esc(form.failureVideoLink)}" target="_blank">${esc(form.failureVideoLink)}</a><br/>`:""}
  ${form.correctionImages.length?`<div class="stitle" style="margin-top:10px">Correction Images</div><div class="imgs">${imgBlock(form.correctionImages)}</div>`:""}
  ${form.correctionVideoLink?`<div class="stitle">Correction Video</div><a href="${esc(form.correctionVideoLink)}" target="_blank">${esc(form.correctionVideoLink)}</a>`:""}
  ${!form.failureImages.length&&!form.failureVideoLink&&!form.correctionImages.length&&!form.correctionVideoLink?`<div class="dc empty">No evidence attached yet</div>`:""}
</div>

<div class="foot">8D Report Generator &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString()}</div>
<\/body><\/html>`;
}

function ImageUploader({ label, images, onChange, color }) {
  const ref = useRef();
  const add = async files => {
    const news = await Promise.all(Array.from(files).map(async f=>({name:f.name, data:await toBase64(f)})));
    onChange([...images, ...news]);
  };
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:6,fontWeight:600}}>{label}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:6}}>
        {images.map((img,i)=>(
          <div key={i} style={{position:"relative"}}>
            <img src={img.data} alt={img.name} style={{width:72,height:56,objectFit:"cover",borderRadius:6,border:`2px solid ${color}55`}}/>
            <button onClick={()=>onChange(images.filter((_,j)=>j!==i))} style={{position:"absolute",top:-5,right:-5,background:"#ef4444",color:"#fff",border:"none",borderRadius:"50%",width:16,height:16,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button>
          </div>
        ))}
        <button onClick={()=>ref.current.click()} style={{width:72,height:56,background:"#1e293b",border:`2px dashed ${color}55`,borderRadius:6,color:"#64748b",cursor:"pointer",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>add(e.target.files)}/>
    </div>
  );
}

function Fishbone({ data, color }) {
  const L = FISH_CATS.slice(0,3), R = FISH_CATS.slice(3);
  return (
    <svg viewBox="0 0 580 240" style={{width:"100%",display:"block",margin:"8px 0"}}>
      <line x1="40" y1="120" x2="520" y2="120" stroke={color} strokeWidth="2.5"/>
      <rect x="488" y="102" width="72" height="36" rx="6" fill={color} opacity=".15" stroke={color} strokeWidth="1.5"/>
      <text x="524" y="124" textAnchor="middle" fontSize="10" fontWeight="800" fill={color}>DEFECT</text>
      <polygon points="520,120 510,114 510,126" fill={color}/>
      {L.map((cat,i)=>{ const x=100+i*130,has=data[cat]; return(
        <g key={cat}>
          <line x1={x} y1="50" x2={x+50} y2="120" stroke={has?color:"#2d3f55"} strokeWidth="1.8"/>
          <text x={x-2} y="44" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={has?color:"#4a5568"}>{cat}</text>
          {has&&<text x={x+18} y="84" fontSize="8.5" fill="#64748b" textAnchor="middle">{data[cat].length>16?data[cat].slice(0,16)+"…":data[cat]}</text>}
        </g>
      );})}
      {R.map((cat,i)=>{ const x=100+i*130,has=data[cat]; return(
        <g key={cat}>
          <line x1={x} y1="190" x2={x+50} y2="120" stroke={has?color:"#2d3f55"} strokeWidth="1.8"/>
          <text x={x-2} y="206" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={has?color:"#4a5568"}>{cat}</text>
          {has&&<text x={x+18} y="162" fontSize="8.5" fill="#64748b" textAnchor="middle">{data[cat].length>16?data[cat].slice(0,16)+"…":data[cat]}</text>}
        </g>
      );})}
    </svg>
  );
}

function App() {
  const [form, setForm]   = useState(INIT);
  const [activeD, setActiveD] = useState("D0");
  const [loading, setLoading] = useState({});
  const [tab, setTab]     = useState("editor");
  const [toast, setToast] = useState("");
  const loadRef           = useRef();

  // Load a previously downloaded HTML report back into the editor
  const handleLoadReport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = loadReportFromHTML(ev.target.result);
      if (parsed) {
        setForm(parsed);
        setActiveD("D0");
        setTab("editor");
        setToast("✅ Report loaded successfully! You can now edit it.");
        setTimeout(()=>setToast(""), 4000);
      } else {
        setToast("❌ Could not load — only HTML reports downloaded from this app can be loaded.");
        setTimeout(()=>setToast(""), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset so same file can be reloaded
  };

  const set     = (k,v) => setForm(f=>({...f,[k]:v}));
  const setWhy  = (i,field,v) => setForm(f=>{ const w=[...f.whyWhy]; w[i]={...w[i],[field]:v}; return {...f,whyWhy:w}; });
  const setFish = (cat,v) => setForm(f=>({...f,fishbone:{...f.fishbone,[cat]:v}}));

  const doPrint = () => {
    downloadReport(form);
    setToast("✅ Downloaded! Open the .html file in your browser, then press Ctrl+P (or Cmd+P) to save as PDF.");
    setTimeout(()=>setToast(""), 6000);
  };

  const generate = async (dId) => {
    const d = DISCIPLINES.find(x=>x.id===dId);
    setLoading(l=>({...l,[dId]:true}));

    if (!GROQ_API_KEY || GROQ_API_KEY.includes("PASTE")) {
      set(dId, "⚠️ Please add your free Groq API key at line 4 of App.jsx\nGet it free at: console.groq.com → Sign Up → API Keys → Create Key");
      setLoading(l=>({...l,[dId]:false}));
      return;
    }

    try {
      const text = await callAI(
        `You are an expert quality engineer specializing in 8D problem-solving. Generate professional content for ${d.title} (${dId}). Be specific, actionable, industry-standard. Return plain text only, no headers, no markdown.`,
        `Generate ${dId} - ${d.title} for this report:\nProduct:${form.product||"N/A"} Customer:${form.customer||"N/A"} Part:${form.partNumber||"N/A"} Defects:${form.defectQty||"N/A"}\nProblem:${form.D2||"not described"}\nCurrent content:${form[dId]||"none"}`
      );
      set(dId, text);

      if (dId === "D4") {
        const rcaText = await callAI(
          `You are an expert quality engineer. Return ONLY valid JSON, no markdown, no explanation:\n{"whyWhy":[{"why":"...","because":"..."},{"why":"...","because":"..."},{"why":"...","because":"..."},{"why":"...","because":"..."},{"why":"...","because":"..."}],"fishbone":{"Man":"...","Machine":"...","Method":"...","Material":"...","Measurement":"...","Environment":"..."},"rcaSummary":"..."}`,
          `Generate 5-Why and Fishbone analysis:\nProduct:${form.product||"N/A"} Problem:${form.D2||"defect found"} Qty:${form.defectQty||"N/A"}`
        );
        try {
          const j = JSON.parse(rcaText.replace(/```json|```/g,"").trim());
          setForm(f=>({...f, whyWhy:j.whyWhy||f.whyWhy, fishbone:j.fishbone||f.fishbone, rcaSummary:j.rcaSummary||f.rcaSummary}));
        } catch {}
      }
    } catch(err) {
      console.error("AI Error:", err);
      set(dId, err.message || "❌ Network error. Open app in a new browser tab and try again.");
    }
    setLoading(l=>({...l,[dId]:false}));
  };

  const generateAll = async () => { for(const d of DISCIPLINES) await generate(d.id); };

  const ad   = DISCIPLINES.find(d=>d.id===activeD);
  const done = DISCIPLINES.filter(d=>d.id==="D4"?(form.rcaSummary||form.whyWhy.some(w=>w.why)):form[d.id]).length;
  const pct  = Math.round(done/DISCIPLINES.length*100);

  const S = {
    inp:  {width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"6px 9px",color:"#e2e8f0",fontSize:11,boxSizing:"border-box"},
    ta:   {width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:12,color:"#e2e8f0",fontSize:13,lineHeight:1.7,resize:"vertical",fontFamily:"inherit",boxSizing:"border-box",outline:"none"},
    btn:  (bg,c="#fff",p="8px 14px")=>({background:bg,color:c,border:"none",borderRadius:7,padding:p,fontWeight:700,cursor:"pointer",fontSize:12,whiteSpace:"nowrap"}),
    dBtn: (a,c)=>({width:"100%",padding:"8px 12px",border:"none",background:a?"#1e293b":"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:8,textAlign:"left",borderLeft:`3px solid ${a?c:"transparent"}`}),
  };

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#0f172a",color:"#e2e8f0",fontFamily:"'Segoe UI',sans-serif",overflow:"hidden"}}>

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:"#1e293b",border:"1px solid #22c55e",color:"#e2e8f0",padding:"12px 20px",borderRadius:10,fontSize:12,zIndex:9999,maxWidth:480,textAlign:"center",boxShadow:"0 4px 24px rgba(0,0,0,.4)"}}>
          {toast}
        </div>
      )}

      {/* TOP BAR */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"8px 14px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <div style={{background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",borderRadius:8,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>⚙️</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:800}}>8D Report Generator</div>
          <div style={{fontSize:9,color:"#475569"}}>AI-Powered Quality Tool</div>
        </div>
        <div style={{display:"flex",background:"#0f172a",borderRadius:7,padding:3,gap:2}}>
          {[["editor","✏️ Editor"],["preview","👁 Preview"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?"#3b82f6":"transparent",color:tab===t?"#fff":"#64748b",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontWeight:700,fontSize:11}}>{l}</button>
          ))}
        </div>
        <button onClick={generateAll} style={S.btn("linear-gradient(135deg,#3b82f6,#8b5cf6)")}>✨ AI All</button>
        <button onClick={()=>loadRef.current.click()} style={S.btn("#f59e0b")}>📂 Load Report</button>
        <button onClick={doPrint} style={S.btn("#22c55e")}>⬇ Download Report</button>
        <input ref={loadRef} type="file" accept=".html" style={{display:"none"}} onChange={handleLoadReport}/>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* SIDEBAR */}
        <div style={{width:210,background:"#0a1628",borderRight:"1px solid #1e293b",display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
          <div style={{padding:"12px 11px",borderBottom:"1px solid #1e293b",overflowY:"auto"}}>
            <div style={{fontSize:9,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Report Info</div>
            {[["reportNumber","Report #"],["date","Date"],["product","Product"],["customer","Customer"],["partNumber","Part No."],["defectQty","Defect Qty"],["severity","Severity"]].map(([k,label])=>(
              <div key={k} style={{marginBottom:6}}>
                <div style={{fontSize:9,color:"#64748b",marginBottom:2}}>{label}</div>
                <input type={k==="date"?"date":"text"} value={form[k]} onChange={e=>set(k,e.target.value)} style={S.inp}/>
              </div>
            ))}
            <div style={{marginTop:10,background:"#1e293b",borderRadius:7,padding:"9px 11px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:9,color:"#64748b"}}>Progress</span>
                <span style={{fontSize:14,fontWeight:800,color:"#3b82f6"}}>{pct}%</span>
              </div>
              <div style={{height:3,background:"#334155",borderRadius:2}}>
                <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#3b82f6,#8b5cf6)",borderRadius:2,transition:"width .4s"}}/>
              </div>
              <div style={{fontSize:9,color:"#475569",marginTop:3}}>{done}/{DISCIPLINES.length} sections</div>
            </div>
          </div>
          <div style={{overflowY:"auto",flex:1,paddingTop:4}}>
            {DISCIPLINES.map(d=>(
              <button key={d.id} onClick={()=>{setActiveD(d.id);setTab("editor");}} style={S.dBtn(activeD===d.id&&tab==="editor",d.color)}>
                <div style={{width:20,height:20,borderRadius:"50%",background:d.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:900,color:"#fff",flexShrink:0}}>{d.id}</div>
                <div style={{fontSize:10,fontWeight:600,color:activeD===d.id?"#e2e8f0":"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.title}</div>
                {loading[d.id]&&<span style={{fontSize:10,marginLeft:"auto"}}>⏳</span>}
              </button>
            ))}
            <button onClick={()=>{setActiveD("EV");setTab("editor");}} style={S.dBtn(activeD==="EV","#64748b")}>
              <div style={{width:20,height:20,borderRadius:"50%",background:"#334155",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0}}>📎</div>
              <div style={{fontSize:10,fontWeight:600,color:activeD==="EV"?"#e2e8f0":"#94a3b8"}}>Evidence & Media</div>
            </button>
          </div>
        </div>

        {/* MAIN */}
        {tab==="editor" ? (
          <div style={{flex:1,overflowY:"auto",padding:"18px 22px"}}>

            {/* Evidence */}
            {activeD==="EV" && (
              <div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:"#334155",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📎</div>
                  <div><h2 style={{margin:0,fontSize:17,fontWeight:800}}>Evidence & Media</h2><p style={{margin:0,color:"#64748b",fontSize:11}}>Attach images and video links for failure and correction</p></div>
                </div>
                <div style={{background:"#1e293b",borderRadius:10,padding:16,marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#ef4444",marginBottom:12}}>🔴 Failure Evidence</div>
                  <ImageUploader label="Failure Images" images={form.failureImages} onChange={v=>set("failureImages",v)} color="#ef4444"/>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>Failure Video Link (YouTube / SharePoint / Teams)</div>
                  <input value={form.failureVideoLink} onChange={e=>set("failureVideoLink",e.target.value)} placeholder="https://..." style={S.inp}/>
                </div>
                <div style={{background:"#1e293b",borderRadius:10,padding:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#22c55e",marginBottom:12}}>🟢 Correction Evidence</div>
                  <ImageUploader label="Correction Images" images={form.correctionImages} onChange={v=>set("correctionImages",v)} color="#22c55e"/>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>Correction Video Link</div>
                  <input value={form.correctionVideoLink} onChange={e=>set("correctionVideoLink",e.target.value)} placeholder="https://..." style={S.inp}/>
                </div>
              </div>
            )}

            {/* D4 Root Cause */}
            {activeD==="D4" && (
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:40,height:40,borderRadius:"50%",background:"#06b6d4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff"}}>D4</div>
                    <div><h2 style={{margin:0,fontSize:17,fontWeight:800}}>Root Cause Analysis</h2><p style={{margin:0,color:"#64748b",fontSize:11}}>5-Why + Fishbone Diagram</p></div>
                  </div>
                  <button onClick={()=>generate("D4")} disabled={!!loading["D4"]} style={S.btn(loading["D4"]?"#1e293b":"linear-gradient(135deg,#06b6d4,#0891b2)")}>
                    {loading["D4"]?"⏳ Generating...":"✨ AI Generate RCA"}
                  </button>
                </div>
                <div style={{background:"#1e293b",borderRadius:10,padding:14,marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#06b6d4",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>🔍 5-Why Analysis</div>
                  {form.whyWhy.map((row,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:"#06b6d4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#fff",flexShrink:0,marginTop:5}}>{i+1}</div>
                      <div style={{flex:1,display:"flex",gap:6}}>
                        <input value={row.why} onChange={e=>setWhy(i,"why",e.target.value)} placeholder={`Why ${i+1}?`} style={{...S.inp,flex:1}}/>
                        <input value={row.because} onChange={e=>setWhy(i,"because",e.target.value)} placeholder="Because…" style={{...S.inp,flex:1.2}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{background:"#1e293b",borderRadius:10,padding:14,marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#06b6d4",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>🦴 Fishbone Diagram</div>
                  <Fishbone data={form.fishbone} color="#06b6d4"/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:8}}>
                    {FISH_CATS.map(cat=>(
                      <div key={cat}>
                        <div style={{fontSize:9,color:"#64748b",marginBottom:2,fontWeight:600}}>{cat}</div>
                        <input value={form.fishbone[cat]} onChange={e=>setFish(cat,e.target.value)} placeholder={`${cat} cause…`} style={{...S.inp,fontSize:10}}/>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{background:"#1e293b",borderRadius:10,padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#06b6d4",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>📌 Root Cause Summary</div>
                  <textarea value={form.rcaSummary} onChange={e=>set("rcaSummary",e.target.value)} placeholder="State the verified root cause and escape point…" rows={4} style={S.ta}/>
                </div>
              </div>
            )}

            {/* D0 — with extra Title field */}
            {activeD==="D0" && (
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:40,height:40,borderRadius:"50%",background:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff"}}>D0</div>
                    <div><h2 style={{margin:0,fontSize:17,fontWeight:800}}>Emergency Response</h2><p style={{margin:0,color:"#64748b",fontSize:11}}>Immediate actions taken within first 24-48h</p></div>
                  </div>
                  <button onClick={()=>generate("D0")} disabled={!!loading["D0"]} style={S.btn(loading["D0"]?"#1e293b":"linear-gradient(135deg,#ef4444,#dc2626)")}>
                    {loading["D0"]?"⏳ Generating...":"✨ AI Generate"}
                  </button>
                </div>
                <div style={{background:"#1e293b",border:"1px solid #ef444433",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#ef4444",marginBottom:3,textTransform:"uppercase"}}>💡 What to include</div>
                  <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.6}}>{TIPS["D0"]}</div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:5,fontWeight:600}}>📌 Emergency Response Title / Subject</div>
                  <input value={form.D0title} onChange={e=>set("D0title",e.target.value)} placeholder="e.g. Brake caliper dimensional non-conformance — urgent customer hold" style={{...S.inp,fontSize:12,padding:"9px 12px"}}/>
                </div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:5,fontWeight:600}}>Response Details</div>
                <textarea value={form.D0||""} onChange={e=>set("D0",e.target.value)} placeholder="Describe the emergency response actions taken…" rows={10} style={S.ta}
                  onFocus={e=>e.target.style.borderColor="#ef4444"} onBlur={e=>e.target.style.borderColor="#334155"}/>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
                  <button onClick={()=>setActiveD("D1")} style={{...S.btn("#f97316"),marginLeft:"auto"}}>Next →</button>
                </div>
              </div>
            )}

            {/* All other D panels */}
            {activeD!=="D0" && activeD!=="D4" && activeD!=="EV" && ad && (
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:40,height:40,borderRadius:"50%",background:ad.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff"}}>{ad.id}</div>
                    <div><h2 style={{margin:0,fontSize:17,fontWeight:800}}>{ad.title}</h2><p style={{margin:0,color:"#64748b",fontSize:11}}>{ad.desc}</p></div>
                  </div>
                  <button onClick={()=>generate(activeD)} disabled={!!loading[activeD]} style={S.btn(loading[activeD]?"#1e293b":`linear-gradient(135deg,${ad.color},${ad.color}cc)`)}>
                    {loading[activeD]?"⏳ Generating...":"✨ AI Generate"}
                  </button>
                </div>
                <div style={{background:"#1e293b",border:`1px solid ${ad.color}33`,borderRadius:8,padding:"10px 14px",marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:700,color:ad.color,marginBottom:3,textTransform:"uppercase"}}>💡 What to include</div>
                  <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.6}}>{TIPS[activeD]}</div>
                </div>
                <textarea value={form[activeD]||""} onChange={e=>set(activeD,e.target.value)} placeholder={`Enter ${ad.id} – ${ad.title}…`} rows={10} style={S.ta}
                  onFocus={e=>e.target.style.borderColor=ad.color} onBlur={e=>e.target.style.borderColor="#334155"}/>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
                  {DISCIPLINES.findIndex(d=>d.id===activeD)>0&&(
                    <button onClick={()=>setActiveD(DISCIPLINES[DISCIPLINES.findIndex(d=>d.id===activeD)-1].id)} style={S.btn("#1e293b","#94a3b8")}>← Prev</button>
                  )}
                  {DISCIPLINES.findIndex(d=>d.id===activeD)<DISCIPLINES.length-1&&(
                    <button onClick={()=>setActiveD(DISCIPLINES[DISCIPLINES.findIndex(d=>d.id===activeD)+1].id)} style={{...S.btn(ad.color),marginLeft:"auto"}}>Next →</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* LIVE PREVIEW */
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"7px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
              <span style={{fontSize:11,color:"#64748b"}}>📄 Live Preview — updates as you fill the form</span>
              <button onClick={doPrint} style={S.btn("#22c55e","#fff","6px 14px")}>⬇ Download Report</button>
            </div>
            <iframe srcDoc={buildHTML(form)} style={{flex:1,border:"none",background:"#fff"}} title="8D Preview" sandbox="allow-same-origin allow-scripts"/>
          </div>
        )}
      </div>
    </div>
  );
}
