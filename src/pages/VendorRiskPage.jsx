import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

function VendorRiskPage({T}){
  const [activeTab,setActiveTab]=useState("overview");
  const [selectedId,setSelectedId]=useState(null);

  const VENDORS=[
    {id:"V001",name:"GymFuel Nutrition",cat:"Supplements",risk:"HIGH",score:72,issues:4,spend:"₹18,200/mo",compliance:58,lastAudit:"Jan 20, 2026",trend:"up",icon:"💊",
      issues_list:["Undisclosed allergens in 2 products","Expiry date discrepancy batch #GF2201","Missing FSSAI certification renewal","Delivery SLA breach (3×)"]},
    {id:"V002",name:"IronClad Equipment",cat:"Equipment",risk:"MEDIUM",score:54,issues:2,spend:"₹42,500/mo",compliance:74,lastAudit:"Jan 15, 2026",trend:"down",icon:"🏋️",
      issues_list:["Warranty claim response >14 days","Product spec mismatch on 2 SKUs"]},
    {id:"V003",name:"FlexWear Apparel",cat:"Apparel",risk:"LOW",score:22,issues:0,spend:"₹9,800/mo",compliance:95,lastAudit:"Jan 25, 2026",trend:"stable",icon:"👕",
      issues_list:[]},
    {id:"V004",name:"RecoveryTech Labs",cat:"Recovery",risk:"CRITICAL",score:88,issues:6,spend:"₹31,000/mo",compliance:41,lastAudit:"Dec 10, 2025",trend:"up",icon:"💆",
      issues_list:["3 products in market recall","FDA warning letter unresolved","Forged quality certifications","Financial instability — credit downgrade","2 unresolved injury claims","Audit access denied Q4 2025"]},
    {id:"V005",name:"HydroSports Drinks",cat:"Nutrition",risk:"MEDIUM",score:48,issues:1,spend:"₹14,600/mo",compliance:81,lastAudit:"Jan 18, 2026",trend:"stable",icon:"🥤",
      issues_list:["Sugar content labelling inaccuracy"]},
    {id:"V006",name:"ProTech Wearables",cat:"Technology",risk:"LOW",score:18,issues:0,spend:"₹27,300/mo",compliance:97,lastAudit:"Jan 22, 2026",trend:"stable",icon:"📱",
      issues_list:[]},
  ];

  const riskColor={CRITICAL:"#e05555",HIGH:"#e8a83a",MEDIUM:"#e07a35",LOW:"#4db882"};
  const trendIcon={up:"↑",down:"↓",stable:"→"};
  const trendColor={up:"#e05555",down:"#4db882",stable:T.txtTert};
  const totals={critical:VENDORS.filter(v=>v.risk==="CRITICAL").length,high:VENDORS.filter(v=>v.risk==="HIGH").length,medium:VENDORS.filter(v=>v.risk==="MEDIUM").length,low:VENDORS.filter(v=>v.risk==="LOW").length};
  const selected=VENDORS.find(v=>v.id===selectedId)||null;
  const TABS=[["overview","📊 Overview"],["vendors","🏢 Vendors"],["issues","⚠️ Issues"],["compliance","✅ Compliance"]];

  return(
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={{position:"relative",borderRadius:12,overflow:"hidden",marginBottom:20,backgroundImage:"url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80')",backgroundSize:"cover",backgroundPosition:"center 35%",height:130}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#e8a83a,#e05555)"}}/>
        <div style={{position:"relative",zIndex:1,padding:"22px 28px",height:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:"#e8a83a",letterSpacing:".18em",textTransform:"uppercase",marginBottom:5}}>RISK MANAGEMENT</div>
            <h1 style={{fontSize:24,fontWeight:800,color:"#fff",letterSpacing:"-.5px",marginBottom:3}}>Vendor Risk</h1>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Monitor supplier health · <span style={{color:"#e05555",fontWeight:600}}>{totals.critical} critical</span> · <span style={{color:"#e8a83a",fontWeight:600}}>{totals.high} high</span></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {[["🔴",totals.critical+" Critical","#e05555"],["🟠",totals.high+" High","#e8a83a"],["🟡",totals.medium+" Medium","#e07a35"],["🟢",totals.low+" Low","#4db882"]].map(([ic,lb,cl])=>(
              <div key={lb} style={{background:"rgba(0,0,0,0.5)",border:`1px solid ${cl}44`,borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:13}}>{ic}</div>
                <div style={{fontSize:9,color:cl,fontWeight:600,marginTop:2,whiteSpace:"nowrap"}}>{lb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:2,background:T.bgCard,borderRadius:8,padding:4,marginBottom:16,border:`1px solid ${T.border}`}}>
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>{setActiveTab(id);setSelectedId(null);}} style={{flex:1,padding:"8px 12px",borderRadius:6,fontSize:11,fontWeight:activeTab===id?600:400,background:activeTab===id?T.bgActive:"transparent",color:activeTab===id?T.txtPrim:T.txtSec,border:`1px solid ${activeTab===id?T.borderAct:"transparent"}`,cursor:"pointer",fontFamily:"DM Sans",transition:"all .15s"}}>{label}</button>
        ))}
      </div>

      {activeTab==="overview"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
            {[["Critical",totals.critical,"#e05555"],["High Risk",totals.high,"#e8a83a"],["Medium",totals.medium,"#e07a35"],["Low Risk",totals.low,"#4db882"]].map(([l,v,c])=>(
              <div key={l} style={{background:T.bgCard,border:`1px solid ${c}44`,borderTop:`3px solid ${c}`,borderRadius:8,padding:"16px",textAlign:"center"}}>
                <div style={{fontSize:28,fontWeight:800,color:c,lineHeight:1,marginBottom:4}}>{v}</div>
                <div style={{fontSize:10,color:T.txtTert,textTransform:"uppercase",letterSpacing:".07em"}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:20,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,color:T.txtPrim,marginBottom:16}}>Vendor Risk Scores</div>
            {[...VENDORS].sort((a,b)=>b.score-a.score).map(v=>(
              <div key={v.id} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13}}>{v.icon}</span>
                    <span style={{fontSize:11,fontWeight:500,color:T.txtPrim}}>{v.name}</span>
                    <span style={{fontSize:10,color:T.txtTert}}>{v.cat}</span>
                    <span style={{fontSize:11,fontWeight:700,color:trendColor[v.trend]}}>{trendIcon[v.trend]}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,fontWeight:700,color:riskColor[v.risk],fontFamily:"DM Mono"}}>{v.score}/100</span>
                    <span style={{fontSize:9,fontWeight:700,color:riskColor[v.risk],background:`${riskColor[v.risk]}18`,border:`1px solid ${riskColor[v.risk]}44`,borderRadius:4,padding:"2px 8px"}}>{v.risk}</span>
                  </div>
                </div>
                <div style={{height:7,background:T.bgInput,borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${v.score}%`,background:`linear-gradient(90deg,${riskColor[v.risk]},${riskColor[v.risk]}88)`,borderRadius:4}}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:20}}>
            <div style={{fontSize:13,fontWeight:600,color:T.txtPrim,marginBottom:14}}>Spend vs Risk Exposure</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[["Total Monthly","₹1,43,400","#5b7cf5"],["At-Risk Spend","₹49,200","#e05555"],["Compliant Spend","₹94,200","#4db882"]].map(([l,v,c])=>(
                <div key={l} style={{background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 16px",textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:700,color:c,marginBottom:4}}>{v}</div>
                  <div style={{fontSize:10,color:T.txtTert}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab==="vendors"&&(
        <div style={{display:"grid",gridTemplateColumns:selected?"1fr 1fr":"1fr",gap:12}}>
          <div>
            {VENDORS.map((v,i)=>(
              <div key={v.id} onClick={()=>setSelectedId(selectedId===v.id?null:v.id)}
                style={{background:selectedId===v.id?T.bgActive:T.bgCard,border:`1px solid ${selectedId===v.id?T.borderAct:T.border}`,borderLeft:`4px solid ${riskColor[v.risk]}`,borderRadius:10,padding:"16px 18px",cursor:"pointer",marginBottom:8,transition:"all .15s",animation:`fadeUp .3s ease ${i*0.05}s both`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:38,height:38,borderRadius:9,background:`${riskColor[v.risk]}18`,border:`1px solid ${riskColor[v.risk]}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{v.icon}</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:T.txtPrim}}>{v.name}</div>
                      <div style={{fontSize:10,color:T.txtTert,marginTop:2}}>{v.cat} · {v.spend} · Audit: {v.lastAudit}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {v.issues>0&&<span style={{fontSize:10,fontWeight:700,color:"#e05555",background:"#e0555518",border:"1px solid #e0555544",borderRadius:4,padding:"2px 8px"}}>{v.issues} issues</span>}
                    <span style={{fontSize:10,fontWeight:700,color:riskColor[v.risk],background:`${riskColor[v.risk]}18`,border:`1px solid ${riskColor[v.risk]}44`,borderRadius:4,padding:"3px 10px"}}>{v.risk}</span>
                    <span style={{color:T.txtTert,fontSize:11}}>{selectedId===v.id?"▲":"▼"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selected&&(
            <div style={{background:T.bgCard,border:`1px solid ${riskColor[selected.risk]}44`,borderRadius:10,padding:20,alignSelf:"start"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,paddingBottom:14,borderBottom:`1px solid ${T.border}`}}>
                <div style={{width:44,height:44,borderRadius:10,background:`${riskColor[selected.risk]}18`,border:`1px solid ${riskColor[selected.risk]}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{selected.icon}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:T.txtPrim}}>{selected.name}</div>
                  <div style={{fontSize:10,color:T.txtTert}}>{selected.id} · {selected.cat}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                {[["Risk Score",selected.score+"/100",riskColor[selected.risk]],["Risk Level",selected.risk,riskColor[selected.risk]],["Compliance",selected.compliance+"%",selected.compliance>80?"#4db882":selected.compliance>60?"#e8a83a":"#e05555"],["Monthly Spend",selected.spend,"#5b7cf5"],["Open Issues",selected.issues,selected.issues>0?"#e05555":"#4db882"],["Last Audit",selected.lastAudit,T.txtSec]].map(([l,v,c])=>(
                  <div key={l} style={{background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:7,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
              {selected.issues_list.length>0
                ?selected.issues_list.map((iss,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"8px 10px",background:"#e0555510",border:"1px solid #e0555530",borderRadius:6,marginBottom:6,fontSize:11,color:T.txtSec}}>
                    <span style={{color:"#e05555",flexShrink:0}}>●</span>{iss}
                  </div>
                ))
                :<div style={{textAlign:"center",padding:"16px 0",color:"#4db882",fontSize:12,fontWeight:500}}>✓ No open issues</div>
              }
            </div>
          )}
        </div>
      )}

      {activeTab==="issues"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {VENDORS.flatMap(v=>v.issues_list.map((iss,i)=>({vendor:v.name,icon:v.icon,risk:v.risk,iss,key:`${v.id}-${i}`}))).map((item,i)=>(
            <div key={item.key} style={{background:T.bgCard,border:`1px solid ${riskColor[item.risk]}33`,borderLeft:`4px solid ${riskColor[item.risk]}`,borderRadius:8,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,animation:`fadeUp .3s ease ${i*0.04}s both`}}>
              <div style={{width:36,height:36,borderRadius:8,background:`${riskColor[item.risk]}18`,border:`1px solid ${riskColor[item.risk]}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>{item.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:500,color:T.txtPrim,marginBottom:3}}>{item.iss}</div>
                <div style={{fontSize:10,color:T.txtTert}}>Vendor: <span style={{color:T.txtSec}}>{item.vendor}</span></div>
              </div>
              <span style={{fontSize:10,fontWeight:700,color:riskColor[item.risk],background:`${riskColor[item.risk]}18`,border:`1px solid ${riskColor[item.risk]}44`,borderRadius:4,padding:"3px 10px",flexShrink:0}}>{item.risk}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab==="compliance"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:20}}>
            <div style={{fontSize:13,fontWeight:600,color:T.txtPrim,marginBottom:16}}>Compliance Scores</div>
            {[...VENDORS].sort((a,b)=>a.compliance-b.compliance).map(v=>{
              const c=v.compliance>80?"#4db882":v.compliance>60?"#e8a83a":"#e05555";
              return(
                <div key={v.id} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:11,fontWeight:500,color:T.txtPrim}}>{v.icon} {v.name} <span style={{color:T.txtTert,fontSize:10}}>· {v.cat}</span></span>
                    <span style={{fontSize:12,fontWeight:700,color:c,fontFamily:"DM Mono"}}>{v.compliance}%</span>
                  </div>
                  <div style={{height:8,background:T.bgInput,borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${v.compliance}%`,background:`linear-gradient(90deg,${c},${c}aa)`,borderRadius:4}}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:20}}>
            <div style={{fontSize:13,fontWeight:600,color:T.txtPrim,marginBottom:14}}>Compliance Checklist</div>
            {[
              ["FSSAI Certification","All nutrition vendors",true],
              ["Quality Audit Passed","Annual requirement",true],
              ["SLA Agreement Signed","All active vendors",true],
              ["Financial Health Review","Quarterly",false],
              ["Insurance Verification","Annual",false],
              ["RecoveryTech FDA Response","Critical · Overdue",false],
            ].map(([req,note,done])=>(
              <div key={req} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${T.border}44`}}>
                <div style={{width:22,height:22,borderRadius:5,background:done?"#4db88222":"#e0555518",border:`1px solid ${done?"#4db88244":"#e0555544"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:11,color:done?"#4db882":"#e05555"}}>{done?"✓":"✕"}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:500,color:T.txtPrim}}>{req}</div>
                  <div style={{fontSize:10,color:T.txtTert,marginTop:1}}>{note}</div>
                </div>
                <span style={{fontSize:9,fontWeight:600,color:done?"#4db882":"#e05555",background:done?"#4db88218":"#e0555518",border:`1px solid ${done?"#4db88244":"#e0555544"}`,borderRadius:4,padding:"2px 8px"}}>{done?"DONE":"PENDING"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   LEADERBOARD PAGE
════════════════════════════════════════════ */
