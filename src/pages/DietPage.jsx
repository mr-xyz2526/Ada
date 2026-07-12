import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

function DietPage({plan,metrics,generating,onGenerate,onReplace,T}){
  const [openAlt,setOpenAlt]=useState(null);
  const totals=plan?{cal:plan.reduce((s,m)=>s+m.total_cal,0),prot:plan.reduce((s,m)=>s+m.total_prot,0)}:null;
  const mColors=[T.accent,T.yellow,T.green,T.purple];

  return(
    <div style={{animation:"fadeUp .3s ease"}}>
      {/* Hero Banner */}
      <div style={{
        position:"relative",borderRadius:12,overflow:"hidden",marginBottom:20,
        backgroundImage:"url('https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80')",
        backgroundSize:"cover",backgroundPosition:"center 40%",height:130,
      }}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1) 100%)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${T.yellow},${T.green})`,opacity:0.9}}/>
        <div style={{position:"relative",zIndex:1,padding:"22px 28px",height:"100%",display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{fontSize:9,fontWeight:700,color:T.yellow,letterSpacing:".18em",textTransform:"uppercase",marginBottom:5}}>NUTRITION</div>
          <h1 style={{fontSize:24,fontWeight:800,color:"#ffffff",letterSpacing:"-.5px",marginBottom:4}}>Diet Plan</h1>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Target: <span style={{color:T.yellow,fontWeight:600}}>{metrics.target.toLocaleString()} kcal</span> · Protein: <span style={{color:"#00d4aa",fontWeight:600}}>{metrics.prot}g</span></div>
        </div>
      </div>
      {!plan?(
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,textAlign:"center",padding:"72px 40px"}}>
          <div style={{fontSize:42,marginBottom:14}}>🥗</div>
          <div style={{fontSize:14,fontWeight:600,color:T.txtPrim,marginBottom:6}}>No diet plan generated yet</div>
          <div style={{fontSize:12,color:T.txtSec,marginBottom:24,lineHeight:1.6}}>Generate a personalized meal plan calibrated to your calorie and protein targets.</div>
          <BtnPrimary icon="▶" onClick={()=>onGenerate("diet")} disabled={generating==="diet"} T={T}>{generating==="diet"?"Generating…":"Run Diet Plan"}</BtnPrimary>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
            {[
              ["Total Calories",totals.cal+" kcal",T.yellow],
              ["Total Protein",totals.prot+"g",T.accentLt],
              ["Target",metrics.target+" kcal",T.txtSec],
              [Math.abs(totals.cal-metrics.target)<100?"On Track":totals.cal>metrics.target?"Over Budget":"Under Budget",Math.abs(totals.cal-metrics.target)+" kcal",Math.abs(totals.cal-metrics.target)<100?T.green:T.red]
            ].map(([l,v,c])=>(
              <div key={l} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderLeft:`3px solid ${c}`,borderRadius:7,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{l}</div>
                <div style={{fontSize:16,fontWeight:700,color:c}}>{v}</div>
              </div>
            ))}
          </div>
          {plan.map((meal,mi)=>(
            <div key={mi} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderLeft:`3px solid ${mColors[mi%4]}`,borderRadius:8,marginBottom:10}}>
              <div style={{padding:"13px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:15}}>{meal.emoji}</span>
                  <span style={{fontSize:13,fontWeight:600,color:T.txtPrim}}>{meal.name}</span>
                  <span style={{fontSize:10,color:T.txtTert,fontFamily:"DM Mono"}}>{meal.time}</span>
                </div>
                <div style={{fontSize:11,color:T.txtSec}}>
                  <span style={{color:T.yellow}}>{meal.total_cal} kcal</span>
                  <span style={{color:T.txtTert,margin:"0 6px"}}>·</span>
                  <span style={{color:T.accentLt}}>{meal.total_prot}g prot</span>
                </div>
              </div>
              <div style={{padding:"0 16px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 80px",gap:6,padding:"7px 0",fontSize:9,fontWeight:600,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`1px solid ${T.border}`}}>
                  <div>Food Item</div><div style={{textAlign:"right"}}>Kcal</div><div style={{textAlign:"right"}}>Prot</div><div style={{textAlign:"right"}}>Swap</div>
                </div>
                {meal.foods.map((food,fi)=>{
                  const key=`${mi}-${fi}`;const alts=getAlts({...food,cal:food.calories||food.cal,prot:food.protein||food.prot});const open=openAlt===key;
                  return(
                    <div key={fi}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 80px",gap:6,padding:"8px 0",borderBottom:`1px solid ${T.border}44`,alignItems:"center"}}>
                        <div style={{fontSize:12,color:T.txtPrim}}>{food.name}</div>
                        <div style={{fontSize:11,fontFamily:"DM Mono",color:T.yellow,textAlign:"right"}}>{food.calories||food.cal}</div>
                        <div style={{fontSize:11,fontFamily:"DM Mono",color:T.accentLt,textAlign:"right"}}>{food.protein||food.prot}g</div>
                        <div style={{textAlign:"right"}}>
                          {alts.length>0&&(
                            <button onClick={()=>setOpenAlt(open?null:key)} style={{background:open?`${T.red}18`:"transparent",border:`1px solid ${open?T.red:T.border}`,color:open?T.red:T.txtTert,padding:"3px 8px",borderRadius:4,fontSize:9,cursor:"pointer",fontFamily:"DM Sans",transition:"all .15s"}}>
                              {open?"✕ Close":"Modify"}
                            </button>
                          )}
                        </div>
                      </div>
                      {open&&(
                        <div style={{background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",margin:"6px 0",animation:"fadeUp .15s ease"}}>
                          <div style={{fontSize:9,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Alternatives · ±65 kcal · ±9g protein</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                            {alts.map((alt,ai)=>(
                              <button key={ai} onClick={()=>{onReplace(mi,fi,{...alt,calories:alt.cal,protein:alt.prot});setOpenAlt(null);}} style={{background:T.bgCard,border:`1px solid ${T.border}`,color:T.txtSec,padding:"5px 10px",borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:"DM Sans",transition:"all .15s",display:"flex",gap:8,alignItems:"center"}}>
                                {alt.name}<span style={{color:T.yellow,fontSize:9,fontFamily:"DM Mono"}}>{alt.cal}</span><span style={{color:T.accentLt,fontSize:9,fontFamily:"DM Mono"}}>{alt.prot}g</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <BtnGhost sm icon="↺" onClick={()=>onGenerate("diet")} disabled={generating==="diet"} T={T}>{generating==="diet"?"Generating…":"Regenerate Plan"}</BtnGhost>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   WORKOUT PAGE
════════════════════════════════════════════ */
