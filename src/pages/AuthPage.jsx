import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

function AuthPage({onLogin,isDark,onToggleTheme,T}){
  const [mode,setMode]=useState("login");
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({name:"",email:"",age:25,gender:"Male",height:170,weight:70,goal:"Fat Loss",activityLevel:"Moderately Active",workoutType:"Gym",workoutHours:1,workoutDays:4});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden",
      backgroundImage:"url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80')",
      backgroundSize:"cover",backgroundPosition:"center"}}>
      {/* Dark overlay */}
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.72)",backdropFilter:"blur(2px)"}}/>
      {/* Gradient accent overlays */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${T.accent},#00d4aa,${T.accent})`,backgroundSize:"200% 100%",animation:"gradientShift 4s linear infinite"}}/>
      {/* Theme toggle top right */}
      <div style={{position:"absolute",top:20,right:20,zIndex:10}}>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} T={T}/>
      </div>

      <div style={{display:"flex",width:"100%",maxWidth:860,borderRadius:12,overflow:"hidden",border:`1px solid rgba(255,255,255,0.1)`,boxShadow:"0 40px 100px rgba(0,0,0,.8)",animation:"fadeUp .4s ease",position:"relative",zIndex:1}}>
        {/* Left branding panel */}
        <div style={{flex:1,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(20px)",padding:"44px 40px",display:"flex",flexDirection:"column",justifyContent:"center",borderRight:`1px solid rgba(255,255,255,0.08)`,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-60,right:-60,width:240,height:240,borderRadius:"50%",background:`${T.accent}12`,pointerEvents:"none",animation:"floatUp 6s ease-in-out infinite"}} />
          <div style={{position:"absolute",bottom:-80,left:-40,width:200,height:200,borderRadius:"50%",background:`#00d4aa10`,pointerEvents:"none",animation:"floatUp 8s ease-in-out infinite reverse"}} />
          <div style={{position:"relative",zIndex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28,animation:"fadeLeft .5s ease both"}}>
              <div style={{width:40,height:40,borderRadius:9,background:`linear-gradient(135deg,${T.accent},#00d4aa)`,display:"flex",alignItems:"center",justifyContent:"center",animation:"glowPulse 2.5s ease-in-out infinite",padding:8}}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
                  <rect x="1" y="10" width="3" height="4" rx="1" fill="white"/>
                  <rect x="4" y="8" width="2" height="8" rx="1" fill="white"/>
                  <rect x="6" y="10.5" width="12" height="3" rx="1" fill="white"/>
                  <rect x="18" y="8" width="2" height="8" rx="1" fill="white"/>
                  <rect x="20" y="10" width="3" height="4" rx="1" fill="white"/>
                </svg>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:T.txtPrim}}>AdaptFit</div>
                <div style={{fontSize:9,color:T.txtTert,letterSpacing:".05em"}}>AI FITNESS PLATFORM</div>
              </div>
            </div>
            <h2 style={{fontSize:24,fontWeight:700,color:T.txtPrim,lineHeight:1.35,marginBottom:10,letterSpacing:"-.4px",animation:"fadeLeft .5s ease .1s both"}}>Intelligent fitness,<br/>month after month.</h2>
            <p style={{fontSize:12,color:T.txtSec,lineHeight:1.8,marginBottom:24,animation:"fadeLeft .5s ease .15s both"}}>Adaptive calorie & protein targets. AI-generated diet and workout plans. Monthly recalibration based on real progress data.</p>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {["📊 BMI + TDEE auto-calculation","🔄 Monthly adaptive recalibration","🥗 AI-generated diet plans with food swap","🏋️ Progressive workout split generation","🤖 AI fitness assistant with safety filters"].map((f,i)=>(
                <div key={f} style={{fontSize:11,color:T.txtSec,animation:`fadeLeft .4s ease ${.2+i*.07}s both`}}>{f}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div style={{width:380,background:"rgba(18,18,18,0.85)",backdropFilter:"blur(20px)",padding:"40px 36px",display:"flex",flexDirection:"column",justifyContent:"center",animation:"fadeRight .5s ease .1s both"}}>
          <div style={{marginBottom:22}}>
            <div style={{fontSize:16,fontWeight:700,color:T.txtPrim,marginBottom:3}}>{mode==="login"?"Welcome back":"Create your account"}</div>
            {mode==="register"&&<div style={{fontSize:10,color:T.accent,fontWeight:500,letterSpacing:".04em"}}>STEP {step} OF 2 · {step===1?"PERSONAL INFO":"FITNESS PROFILE"}</div>}
          </div>

          {mode==="login"?(
            <>
              {[["Email","email","email","rahul@adaptfit.ai"],["Password","password","password",""]].map(([l,k,t,def])=>(
                <div key={k} style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:500,color:T.txtSec,marginBottom:5}}>{l}</div>
                  <input type={t} defaultValue={def} placeholder={l} />
                </div>
              ))}
              <BtnPrimary style={{width:"100%",justifyContent:"center",marginTop:4,marginBottom:10}} onClick={()=>onLogin(DEMO,DEMO_PROG)} T={T}>Sign In</BtnPrimary>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{flex:1,height:1,background:T.border}} />
                <span style={{fontSize:10,color:T.txtTert}}>or</span>
                <div style={{flex:1,height:1,background:T.border}} />
              </div>
              <BtnGhost style={{width:"100%",justifyContent:"center"}} onClick={()=>onLogin(DEMO,DEMO_PROG)} T={T}>Continue with Demo Account</BtnGhost>
              <div style={{fontSize:11,color:T.txtSec,textAlign:"center",marginTop:14}}>
                No account?{" "}<span style={{color:T.accentLt,cursor:"pointer"}} onClick={()=>{setMode("register");setStep(1);}}>Register</span>
              </div>
            </>
          ):step===1?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                {[["Full Name","name","text"],["Age (yrs)","age","number"],["Height (cm)","height","number"],["Weight (kg)","weight","number"]].map(([l,k,t])=>(
                  <div key={k}><div style={{fontSize:11,fontWeight:500,color:T.txtSec,marginBottom:4}}>{l}</div><input type={t} value={form[k]} onChange={e=>set(k,e.target.value)} /></div>
                ))}
              </div>
              <div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:500,color:T.txtSec,marginBottom:4}}>Gender</div><select value={form.gender} onChange={e=>set("gender",e.target.value)}><option>Male</option><option>Female</option></select></div>
              <BtnPrimary style={{width:"100%",justifyContent:"center"}} onClick={()=>setStep(2)} T={T}>Continue →</BtnPrimary>
              <div style={{fontSize:11,color:T.txtSec,textAlign:"center",marginTop:12}}>Have an account?{" "}<span style={{color:T.accentLt,cursor:"pointer"}} onClick={()=>setMode("login")}>Sign in</span></div>
            </>
          ):(
            <>
              {[["Fitness Goal","goal",GOALS],["Activity Level","activityLevel",ACT_LEVELS],["Workout Type","workoutType",WK_TYPES]].map(([l,k,opts])=>(
                <div key={k} style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:500,color:T.txtSec,marginBottom:4}}>{l}</div><select value={form[k]} onChange={e=>set(k,e.target.value)}>{opts.map(o=><option key={o}>{o}</option>)}</select></div>
              ))}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <div><div style={{fontSize:11,fontWeight:500,color:T.txtSec,marginBottom:4}}>Days/Week</div><input type="number" min={1} max={7} value={form.workoutDays} onChange={e=>set("workoutDays",+e.target.value)} /></div>
                <div><div style={{fontSize:11,fontWeight:500,color:T.txtSec,marginBottom:4}}>Hrs/Day</div><input type="number" min={.25} max={3} step=".25" value={form.workoutHours} onChange={e=>set("workoutHours",+e.target.value)} /></div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <BtnGhost onClick={()=>setStep(1)} T={T}>← Back</BtnGhost>
                <BtnPrimary style={{flex:1,justifyContent:"center"}} onClick={()=>onLogin({...form,age:+form.age,height:+form.height,weight:+form.weight,workoutDays:+form.workoutDays,workoutHours:+form.workoutHours,email:form.email||"user@adaptfit.ai",lastUpdate:new Date().toISOString()},[])} T={T}>Create Account</BtnPrimary>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════ */
