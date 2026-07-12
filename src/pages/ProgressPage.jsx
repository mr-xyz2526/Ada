import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

function ProgressPage({history,user,metrics,onUpdate,T}){
  const totalChange=history.length?+(user.weight-history[0].w).toFixed(1):null;
  const chartData=history.map(p=>({name:p.date.replace(" 20","'"),weight:p.w,bmi:p.bmi}));
  return(
    <div style={{animation:"fadeUp .3s ease"}}>
      {/* Hero Banner */}
      <div style={{
        position:"relative",borderRadius:12,overflow:"hidden",marginBottom:20,
        backgroundImage:"url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80')",
        backgroundSize:"cover",backgroundPosition:"center 30%",height:130,
        flexShrink:0,
      }}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1) 100%)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${T.green},${T.teal})`,opacity:0.9}}/>
        <div style={{position:"relative",zIndex:1,padding:"22px 28px",height:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:T.green,letterSpacing:".18em",textTransform:"uppercase",marginBottom:5}}>TRACKING</div>
            <h1 style={{fontSize:24,fontWeight:800,color:"#ffffff",letterSpacing:"-.5px",marginBottom:3}}>Progress</h1>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Monthly weight tracking and plan recalibration</div>
          </div>
          <BtnPrimary sm icon="+" onClick={onUpdate} T={T} style={{flexShrink:0}}>Log Weight Update</BtnPrimary>
        </div>
      </div>
      {history.length===0?(
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,textAlign:"center",padding:"72px 40px"}}>
          <div style={{fontSize:42,marginBottom:14}}>📈</div>
          <div style={{fontSize:14,fontWeight:600,color:T.txtPrim,marginBottom:6}}>No progress data yet</div>
          <div style={{fontSize:12,color:T.txtSec,marginBottom:24}}>Log your first weight update to start tracking.</div>
          <BtnPrimary icon="+" onClick={onUpdate} T={T}>Log Weight Update</BtnPrimary>
        </div>
      ):(
        <>
          {history.length>=2&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:14}}>
              {[["Total Change",(totalChange>0?"+":"")+totalChange+"kg",totalChange<0?T.green:T.red],["Current BMI",""+metrics.bmi,T.txtPrim],["Target Cal",metrics.target+" kcal",T.yellow],["Check-ins",""+history.length,T.txtPrim],["Protein Goal",metrics.prot+"g",T.accentLt]].map(([l,v,c])=>(
                <div key={l} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderTop:`2px solid ${c}`,borderRadius:7,padding:"12px 14px",textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                  <div style={{fontSize:9,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>{l}</div>
                </div>
              ))}
            </div>
          )}
          {chartData.length>1&&(
            <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,padding:"16px",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:500,color:T.txtPrim,marginBottom:12}}>Weight Trend</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{top:4,right:4,left:-24,bottom:0}}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.accent} stopOpacity={.3}/>
                      <stop offset="100%" stopColor={T.accent} stopOpacity={.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:T.txtTert}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:T.txtTert}} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
                  <Tooltip content={<ChartTip T={T}/>}/>
                  <Area type="monotone" dataKey="weight" stroke={T.accent} strokeWidth={2} fill="url(#pg)" dot={{fill:T.accent,r:3}} name="Weight kg"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8}}>
            <div style={{padding:"13px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:12,fontWeight:500,color:T.txtPrim}}>History Table</div>
              <span style={{fontSize:10,background:`${T.accent}18`,color:T.accentLt,border:`1px solid ${T.accent}33`,borderRadius:4,padding:"2px 8px",fontFamily:"DM Mono"}}>{history.length} entries</span>
            </div>
            <div style={{padding:"0 16px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1.2fr 1fr",gap:6,padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:9,fontWeight:600,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em"}}>
                <div>Date</div><div>Weight</div><div>BMI</div><div>Target Cal</div><div>Δ Change</div>
              </div>
              {[...history].reverse().map((p,i,arr)=>{
                const prev=arr[i+1];const delta=prev?+(p.w-prev.w).toFixed(1):null;
                return(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1.2fr 1fr",gap:6,padding:"9px 0",borderBottom:`1px solid ${T.border}44`,fontSize:12,alignItems:"center"}}>
                    <div style={{fontFamily:"DM Mono",fontSize:10,color:T.txtSec}}>{p.date}</div>
                    <div style={{fontWeight:700,color:T.txtPrim}}>{p.w}<span style={{fontSize:10,color:T.txtTert,fontWeight:400}}> kg</span></div>
                    <div style={{fontFamily:"DM Mono",fontSize:11,color:T.txtSec}}>{p.bmi}</div>
                    <div style={{fontFamily:"DM Mono",fontSize:11,color:T.yellow}}>{p.cal}</div>
                    <div style={{fontFamily:"DM Mono",fontSize:11,fontWeight:600,color:delta==null?T.border:delta<0?T.green:T.red}}>{delta!=null?(delta>0?"+":"")+delta+"kg":"—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   PROFILE PAGE
════════════════════════════════════════════ */
