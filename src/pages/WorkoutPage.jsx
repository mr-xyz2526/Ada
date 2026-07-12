import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

function WorkoutPage({plan,user,generating,onGenerate,T}){
  const [open,setOpen]=useState({0:true});
  return(
    <div style={{animation:"fadeUp .3s ease"}}>
      {/* Hero Banner */}
      <div style={{
        position:"relative",borderRadius:12,overflow:"hidden",marginBottom:20,
        backgroundImage:"url('https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80')",
        backgroundSize:"cover",backgroundPosition:"center 25%",height:130,
      }}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1) 100%)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${T.accent},${T.teal})`,opacity:0.9}}/>
        <div style={{position:"relative",zIndex:1,padding:"22px 28px",height:"100%",display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{fontSize:9,fontWeight:700,color:T.accent,letterSpacing:".18em",textTransform:"uppercase",marginBottom:5}}>TRAINING</div>
          <h1 style={{fontSize:24,fontWeight:800,color:"#ffffff",letterSpacing:"-.5px",marginBottom:4}}>Workout Plan</h1>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{user.workoutType} · <span style={{color:T.teal,fontWeight:600}}>{user.workoutDays} days/week</span> · {user.workoutHours}h/day</div>
        </div>
      </div>
      {user.workoutType==="Gym"&&plan&&(
        <div style={{background:`${T.accent}10`,border:`1px solid ${T.accent}33`,borderRadius:6,padding:"9px 14px",marginBottom:14,fontSize:11,color:T.txtSec,fontFamily:"DM Mono"}}>
          📅 Mon=Chest · Tue=Back · Wed=Legs · Thu=Shoulders · Fri=Arms · Sat=Core
        </div>
      )}
      {!plan?(
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,textAlign:"center",padding:"72px 40px"}}>
          <div style={{fontSize:42,marginBottom:14}}>🏋️</div>
          <div style={{fontSize:14,fontWeight:600,color:T.txtPrim,marginBottom:6}}>No workout plan yet</div>
          <div style={{fontSize:12,color:T.txtSec,marginBottom:24}}>Generate a {user.workoutType==="Gym"?"6-day gym split":"home bodyweight"} program.</div>
          <BtnPrimary icon="▶" onClick={()=>onGenerate("workout")} disabled={generating==="workout"} T={T}>{generating==="workout"?"Generating…":"Run Workout Plan"}</BtnPrimary>
        </div>
      ):(
        <>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:12}}>
            {plan.map((day,di)=>(
              <button key={di} onClick={()=>setOpen(p=>({...p,[di]:!p[di]}))} style={{flex:"0 0 auto",padding:"6px 14px",borderRadius:5,border:`1px solid ${open[di]?day.col+"55":T.border}`,background:open[di]?`${day.col}18`:T.bgInput,color:open[di]?day.col:T.txtSec,fontSize:11,fontWeight:open[di]?600:400,cursor:"pointer",transition:"all .18s",fontFamily:"DM Sans"}}>
                {day.day} · {day.focus}
              </button>
            ))}
          </div>
          {plan.map((day,di)=>open[di]&&(
            <div key={di} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderLeft:`3px solid ${day.col}`,borderRadius:8,marginBottom:10}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:10,background:`${day.col}22`,color:day.col,border:`1px solid ${day.col}44`,borderRadius:4,padding:"2px 8px",fontFamily:"DM Mono",fontWeight:600}}>{day.day}</span>
                  <span style={{fontSize:13,fontWeight:600,color:T.txtPrim}}>{day.focus}</span>
                </div>
                <span style={{fontSize:10,color:T.txtTert}}>{day.exs.length} exercises</span>
              </div>
              <div style={{padding:"0 16px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 56px 80px 70px",gap:6,padding:"7px 0",fontSize:9,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em",fontWeight:600,borderBottom:`1px solid ${T.border}`}}>
                  <div>Exercise</div><div style={{textAlign:"center"}}>Sets</div><div style={{textAlign:"center"}}>Reps</div><div style={{textAlign:"center"}}>Rest</div>
                </div>
                {day.exs.map((ex,ei)=>(
                  <div key={ei} style={{display:"grid",gridTemplateColumns:"1fr 56px 80px 70px",gap:6,padding:"9px 0",borderBottom:`1px solid ${T.border}44`,alignItems:"center"}}>
                    <div style={{fontSize:12,color:T.txtPrim}}>{ex.name}</div>
                    <div style={{fontSize:11,fontFamily:"DM Mono",color:T.red,textAlign:"center",fontWeight:600}}>{ex.sets}</div>
                    <div style={{fontSize:11,fontFamily:"DM Mono",color:T.txtSec,textAlign:"center"}}>{ex.reps}</div>
                    <div style={{fontSize:11,fontFamily:"DM Mono",color:T.txtTert,textAlign:"center"}}>{ex.rest}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <BtnGhost sm icon="↺" onClick={()=>onGenerate("workout")} disabled={generating==="workout"} T={T}>{generating==="workout"?"Generating…":"Regenerate Plan"}</BtnGhost>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   AI ASSISTANT PAGE
════════════════════════════════════════════ */
