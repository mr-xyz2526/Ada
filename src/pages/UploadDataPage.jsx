import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

function UploadDataPage({user,T}){
  const [activeTab,setActiveTab]=useState("manual");
  const [dragOver,setDragOver]=useState(false);
  const [dataType,setDataType]=useState("weight");
  const [formVals,setFormVals]=useState({weight:"",calories:"",water:"",sleep:"",notes:"",date:new Date().toISOString().split("T")[0]});
  const [saveStatus,setSaveStatus]=useState(null); // null | "saving" | "saved"
  const [uploadedFiles,setUploadedFiles]=useState([
    {name:"workout_log_jan2026.csv",size:"14 KB",rows:42,status:"success",date:"Jan 30, 2026",type:"Workout"},
    {name:"diet_tracker_dec2025.csv",size:"8 KB",rows:31,status:"success",date:"Dec 28, 2025",type:"Nutrition"},
    {name:"weight_history_2025.csv",size:"3 KB",rows:12,status:"error",date:"Dec 10, 2025",type:"Weight"},
  ]);
  const [recentEntries,setRecentEntries]=useState([
    {label:"Weight",val:"80.0 kg",date:"Today",color:"#5b7cf5"},
    {label:"Water",val:"2.4 L",date:"Today",color:"#38b4b4"},
    {label:"Sleep",val:"7.5 hrs",date:"Yesterday",color:"#4db882"},
    {label:"Calories Burned",val:"320 kcal",date:"Yesterday",color:"#e8a83a"},
  ]);

  const setFV=(k,v)=>setFormVals(p=>({...p,[k]:v}));

  const handleSave=()=>{
    setSaveStatus("saving");
    setTimeout(()=>{
      const newEntry={label:DATA_TYPES.find(d=>d.id===dataType).label,val:formVals.weight||formVals.calories||formVals.water||"—",date:"Just now",color:DATA_TYPES.find(d=>d.id===dataType).color};
      setRecentEntries(p=>[newEntry,...p.slice(0,3)]);
      setFormVals({weight:"",calories:"",water:"",sleep:"",notes:"",date:new Date().toISOString().split("T")[0]});
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus(null),2000);
    },800);
  };

  const handleFileDrop=(e)=>{
    e.preventDefault();
    setDragOver(false);
    const file=e.dataTransfer?.files?.[0];
    if(file){
      const newFile={name:file.name,size:Math.round(file.size/1024)+" KB",rows:Math.floor(Math.random()*50+10),status:"success",date:"Just now",type:"Custom"};
      setUploadedFiles(p=>[newFile,...p]);
    }
  };

  const DATA_TYPES=[
    {id:"weight",label:"Body Weight",icon:"⚖️",color:"#5b7cf5",fields:[{k:"weight",l:"Weight (kg)",t:"number"}]},
    {id:"nutrition",label:"Nutrition Log",icon:"🥗",color:"#4db882",fields:[{k:"calories",l:"Calories (kcal)",t:"number"}]},
    {id:"workout",label:"Workout Session",icon:"🏋️",color:"#e8a83a",fields:[{k:"calories",l:"Calories burned",t:"number"}]},
    {id:"wellness",label:"Wellness",icon:"💧",color:"#38b4b4",fields:[{k:"water",l:"Water (L)",t:"number"},{k:"sleep",l:"Sleep (hrs)",t:"number"}]},
  ];
  const activeType=DATA_TYPES.find(d=>d.id===dataType)||DATA_TYPES[0];

  const TABS=[["manual","✏️ Manual Entry"],["csv","📁 CSV Import"],["history","🕒 Import History"],["format","📋 Format Guide"]];
  const TYPE_ICONS={Workout:"🏋️",Nutrition:"🥗",Weight:"⚖️",Custom:"📄"};

  return(
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={{position:"relative",borderRadius:12,overflow:"hidden",marginBottom:20,
        backgroundImage:"url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80')",
        backgroundSize:"cover",backgroundPosition:"center 40%",height:130}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#00d4aa,#5b7cf5)"}}/>
        <div style={{position:"relative",zIndex:1,padding:"22px 28px",height:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:"#00d4aa",letterSpacing:".18em",textTransform:"uppercase",marginBottom:5}}>DATA IMPORT</div>
            <h1 style={{fontSize:24,fontWeight:800,color:"#fff",letterSpacing:"-.5px",marginBottom:3}}>Upload Data</h1>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Import CSV files or log data manually · <span style={{color:"#00d4aa",fontWeight:600}}>{uploadedFiles.filter(u=>u.status==="success").length} files imported</span></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {[["📁",uploadedFiles.length+" Files","#5b7cf5"],["✅",uploadedFiles.filter(u=>u.status==="success").length+" OK","#4db882"],["❌",uploadedFiles.filter(u=>u.status==="error").length+" Failed","#e05555"]].map(([ic,lb,cl])=>(
              <div key={lb} style={{background:"rgba(0,0,0,0.5)",border:`1px solid ${cl}44`,borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:13}}>{ic}</div>
                <div style={{fontSize:9,color:cl,fontWeight:600,marginTop:2,whiteSpace:"nowrap"}}>{lb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,background:T.bgCard,borderRadius:8,padding:4,marginBottom:16,border:`1px solid ${T.border}`}}>
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{flex:1,padding:"8px 10px",borderRadius:6,fontSize:11,fontWeight:activeTab===id?600:400,background:activeTab===id?T.bgActive:"transparent",color:activeTab===id?T.txtPrim:T.txtSec,border:`1px solid ${activeTab===id?T.borderAct:"transparent"}`,cursor:"pointer",fontFamily:"DM Sans",transition:"all .15s"}}>{label}</button>
        ))}
      </div>

      {/* MANUAL ENTRY */}
      {activeTab==="manual"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:T.txtSec,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Select Data Type</div>
            {DATA_TYPES.map(dt=>(
              <div key={dt.id} onClick={()=>setDataType(dt.id)} style={{background:dataType===dt.id?`${dt.color}18`:T.bgCard,border:`1px solid ${dataType===dt.id?dt.color+"55":T.border}`,borderLeft:`4px solid ${dataType===dt.id?dt.color:T.border}`,borderRadius:9,padding:"13px 16px",cursor:"pointer",transition:"all .18s",display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <div style={{width:36,height:36,borderRadius:8,background:`${dt.color}18`,border:`1px solid ${dt.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{dt.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:dataType===dt.id?dt.color:T.txtPrim}}>{dt.label}</div>
                  <div style={{fontSize:10,color:T.txtTert,marginTop:1}}>Log {dt.label.toLowerCase()} manually</div>
                </div>
                {dataType===dt.id&&<span style={{color:dt.color,fontSize:16,fontWeight:700}}>✓</span>}
              </div>
            ))}
          </div>

          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${T.border}`}}>
              <div style={{width:36,height:36,borderRadius:8,background:`${activeType.color}18`,border:`1px solid ${activeType.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{activeType.icon}</div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:T.txtPrim}}>Log {activeType.label}</div>
                <div style={{fontSize:10,color:T.txtTert}}>Fill in the fields below</div>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:500,color:T.txtSec,marginBottom:5}}>Date</div>
              <input type="date" value={formVals.date} onChange={e=>setFV("date",e.target.value)}/>
            </div>
            {activeType.fields.map(({k,l,t})=>(
              <div key={k} style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:500,color:T.txtSec,marginBottom:5}}>{l}</div>
                <input type={t} placeholder={`Enter ${l.toLowerCase()}`} value={formVals[k]||""} onChange={e=>setFV(k,e.target.value)}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:500,color:T.txtSec,marginBottom:5}}>Notes (optional)</div>
              <input type="text" placeholder="Add notes…" value={formVals.notes} onChange={e=>setFV("notes",e.target.value)}/>
            </div>
            <button onClick={handleSave} disabled={saveStatus==="saving"} style={{width:"100%",padding:"11px",borderRadius:7,fontSize:12,fontWeight:600,background:saveStatus==="saved"?"#4db882":activeType.color,color:"#fff",border:"none",cursor:saveStatus==="saving"?"not-allowed":"pointer",transition:"background .3s",fontFamily:"DM Sans",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:saveStatus==="saving"?0.7:1}}>
              {saveStatus==="saving"&&<span style={{display:"inline-block",width:12,height:12,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}
              {saveStatus==="saved"?"✓ Saved!":saveStatus==="saving"?"Saving…":`Save ${activeType.label}`}
            </button>
            <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
              <div style={{fontSize:10,fontWeight:600,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Recent Entries</div>
              {recentEntries.map((e,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}44`}}>
                  <span style={{fontSize:11,color:T.txtSec}}>{e.label}</span>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:700,color:e.color,fontFamily:"DM Mono"}}>{e.val}</span>
                    <span style={{fontSize:9,color:T.txtTert}}>{e.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CSV IMPORT */}
      {activeTab==="csv"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleFileDrop}
            style={{background:dragOver?`${T.accent}10`:T.bgCard,border:`2px dashed ${dragOver?T.accent:T.border}`,borderRadius:12,padding:"48px 32px",textAlign:"center",transition:"all .2s",cursor:"pointer"}}>
            <div style={{fontSize:48,marginBottom:12}}>📁</div>
            <div style={{fontSize:15,fontWeight:700,color:T.txtPrim,marginBottom:6}}>Drop your CSV file here</div>
            <div style={{fontSize:12,color:T.txtSec,marginBottom:18}}>Supports weight logs, workout history, nutrition data · Max 10 MB</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:16}}>
              {["Weight Log","Workout History","Nutrition Data","Sleep Data"].map(t=>(
                <span key={t} style={{fontSize:10,background:`${T.accent}18`,color:T.accentLt,border:`1px solid ${T.accent}33`,borderRadius:4,padding:"4px 10px",fontWeight:500}}>{t}</span>
              ))}
            </div>
            <div style={{fontSize:11,color:T.txtTert,marginBottom:12}}>— or —</div>
            <label style={{background:T.accent,color:"#fff",border:"none",borderRadius:7,padding:"10px 24px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"DM Sans",display:"inline-block"}}>
              Browse Files
              <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>{
                const file=e.target.files?.[0];
                if(file){const nf={name:file.name,size:Math.round(file.size/1024)+" KB",rows:Math.floor(Math.random()*50+10),status:"success",date:"Just now",type:"Custom"};setUploadedFiles(p=>[nf,...p]);}
              }}/>
            </label>
          </div>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:18}}>
            <div style={{fontSize:12,fontWeight:600,color:T.txtPrim,marginBottom:12}}>📥 Download CSV Templates</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[
                {name:"Weight Log",cols:"date, weight_kg, body_fat_%, notes",color:"#5b7cf5",icon:"⚖️"},
                {name:"Workout",cols:"date, exercise, sets, reps, weight_kg, duration_min",color:"#e8a83a",icon:"🏋️"},
                {name:"Nutrition",cols:"date, meal, food_item, calories, protein_g, carbs_g, fat_g",color:"#4db882",icon:"🥗"},
                {name:"Sleep & Wellness",cols:"date, sleep_hrs, water_L, steps, mood",color:"#38b4b4",icon:"💧"},
              ].map(t=>(
                <div key={t.name} style={{background:T.bgInput,border:`1px solid ${t.color}33`,borderRadius:8,padding:"12px 14px",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:16}}>{t.icon}</span>
                    <span style={{fontSize:11,fontWeight:600,color:T.txtPrim}}>{t.name}</span>
                  </div>
                  <div style={{fontSize:9,color:T.txtTert,fontFamily:"DM Mono",lineHeight:1.5,marginBottom:8}}>{t.cols}</div>
                  <div style={{fontSize:10,color:t.color,fontWeight:600}}>⬇ Download .csv</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {activeTab==="history"&&(
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:T.txtPrim}}>Import History</div>
            <span style={{fontSize:10,background:`${T.accent}18`,color:T.accentLt,border:`1px solid ${T.accent}33`,borderRadius:4,padding:"2px 8px",fontFamily:"DM Mono"}}>{uploadedFiles.length} imports</span>
          </div>
          {uploadedFiles.map((f,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"36px 1fr 70px 100px 70px",gap:12,padding:"14px 18px",borderBottom:`1px solid ${T.border}44`,alignItems:"center"}}>
              <div style={{width:34,height:34,borderRadius:7,background:f.status==="success"?"#4db88218":"#e0555518",border:`1px solid ${f.status==="success"?"#4db88244":"#e0555544"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{TYPE_ICONS[f.type]||"📄"}</div>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.txtPrim}}>{f.name}</div>
                <div style={{fontSize:10,color:T.txtTert,marginTop:2}}>{f.rows} rows · {f.type}</div>
              </div>
              <div style={{fontSize:10,color:T.txtTert,fontFamily:"DM Mono"}}>{f.size}</div>
              <div style={{fontSize:10,color:T.txtTert}}>{f.date}</div>
              <span style={{fontSize:9,fontWeight:700,color:f.status==="success"?"#4db882":"#e05555",background:f.status==="success"?"#4db88218":"#e0555518",border:`1px solid ${f.status==="success"?"#4db88244":"#e0555544"}`,borderRadius:4,padding:"3px 8px",textAlign:"center"}}>{f.status==="success"?"✓ OK":"✕ FAIL"}</span>
            </div>
          ))}
        </div>
      )}

      {/* FORMAT GUIDE */}
      {activeTab==="format"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {title:"Weight Log",color:"#5b7cf5",icon:"⚖️",headers:["date","weight_kg","body_fat_%","notes"],sample:[["2026-01-30","79.5","18.2","Morning fasted"],["2026-01-23","80.0","18.5","After gym"]]},
            {title:"Workout Log",color:"#e8a83a",icon:"🏋️",headers:["date","exercise","sets","reps","weight_kg","duration_min"],sample:[["2026-01-30","Bench Press","4","8","80","60"],["2026-01-30","Squat","4","6","100","60"]]},
            {title:"Nutrition Log",color:"#4db882",icon:"🥗",headers:["date","meal","food_item","calories","protein_g","carbs_g","fat_g"],sample:[["2026-01-30","Lunch","Chicken Breast","220","35","0","5"],["2026-01-30","Dinner","Brown Rice","165","3","34","1"]]},
          ].map(fmt=>(
            <div key={fmt.title} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"13px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,background:`${fmt.color}08`}}>
                <span style={{fontSize:16}}>{fmt.icon}</span>
                <span style={{fontSize:12,fontWeight:600,color:T.txtPrim}}>{fmt.title}</span>
                <span style={{marginLeft:"auto",fontSize:9,color:fmt.color,background:`${fmt.color}18`,border:`1px solid ${fmt.color}33`,borderRadius:4,padding:"2px 8px",fontWeight:600}}>{fmt.headers.length} columns</span>
              </div>
              <div style={{overflowX:"auto",padding:14}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr>{fmt.headers.map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",background:T.bgInput,color:fmt.color,fontFamily:"DM Mono",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`1px solid ${T.border}`}}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fmt.sample.map((row,ri)=>(
                      <tr key={ri}>{row.map((cell,ci)=><td key={ci} style={{padding:"8px 10px",color:ci===0?T.accentLt:T.txtSec,fontFamily:ci===0?"DM Mono":"DM Sans",fontSize:11,borderBottom:`1px solid ${T.border}44`}}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   INTEGRATIONS PAGE
════════════════════════════════════════════ */
