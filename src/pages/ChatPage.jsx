import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

function ChatPage({msgs,mode,user,metrics,onAdd,onMode,onClear,onGenerate,onNav,T}){
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  const send=async(text)=>{
    const m=(text||input).trim();if(!m||loading)return;
    setInput("");onAdd({role:"user",content:m});setLoading(true);
    await new Promise(r=>setTimeout(r,700+Math.random()*500));
    onAdd({role:"ai",content:aiReply(m,user,metrics)});setLoading(false);
  };

  const render=txt=>txt.split("**").map((p,i)=>i%2===1?<b key={i} style={{color:T.txtPrim,fontWeight:600}}>{p}</b>:p);

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 100px)",animation:"fadeUp .3s ease"}}>
      {/* Hero Banner */}
      <div style={{
        position:"relative",borderRadius:12,overflow:"hidden",marginBottom:18,
        backgroundImage:"url('https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1200&q=80')",
        backgroundSize:"cover",backgroundPosition:"center 20%",height:110,
        flexShrink:0,
      }}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.5) 70%,rgba(0,0,0,0.15) 100%)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${T.accent},#00d4aa)`,opacity:0.9}}/>
        <div style={{position:"relative",zIndex:1,padding:"18px 28px",height:"100%",display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{fontSize:9,fontWeight:700,color:"#00d4aa",letterSpacing:".18em",textTransform:"uppercase",marginBottom:4}}>AI COACHING</div>
          <h1 style={{fontSize:22,fontWeight:800,color:"#ffffff",letterSpacing:"-.5px",marginBottom:3}}>AI Assistant</h1>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Personalized fitness coaching · Two operational modes</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
        <div style={{display:"flex",background:T.bgInput,borderRadius:6,padding:3,gap:2}}>
          {["general","plan"].map(m=>(
            <button key={m} onClick={()=>onMode(m)} style={{padding:"5px 14px",borderRadius:4,fontSize:11,fontWeight:500,color:mode===m?T.txtPrim:T.txtSec,background:mode===m?T.bgCard:"transparent",border:"none",cursor:"pointer",transition:"all .15s",fontFamily:"DM Sans"}}>
              {m==="general"?"General Assistant":"Plan Generator"}
            </button>
          ))}
        </div>
        <span style={{fontSize:10,background:mode==="general"?`${T.green}18`:`${T.yellow}18`,color:mode==="general"?T.green:T.yellow,border:`1px solid ${mode==="general"?T.green:T.yellow}44`,borderRadius:4,padding:"2px 8px",fontFamily:"DM Mono"}}>
          {mode==="general"?"Live Q&A":"JSON Output"}
        </span>
        <BtnGhost sm style={{marginLeft:"auto"}} onClick={onClear} T={T}>Clear</BtnGhost>
      </div>
      {mode==="plan"&&(
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:7,padding:"12px 16px",marginBottom:10}}>
          <div style={{fontSize:12,color:T.txtSec,marginBottom:10}}>Plan Generator outputs <b style={{color:T.txtPrim}}>structured JSON only</b> for programmatic consumption.</div>
          <div style={{display:"flex",gap:8}}>
            <BtnPrimary sm icon="🥗" onClick={()=>{onGenerate("diet");onNav("diet");}} T={T}>Generate Diet JSON</BtnPrimary>
            <BtnGhost sm icon="🏋️" onClick={()=>{onGenerate("workout");onNav("workout");}} T={T}>Generate Workout JSON</BtnGhost>
          </div>
        </div>
      )}
      <div style={{flex:1,overflowY:"auto",background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map((msg,i)=>(
          <div key={i} style={{display:"flex",gap:8,flexDirection:msg.role==="user"?"row-reverse":"row",alignSelf:msg.role==="user"?"flex-end":"flex-start",maxWidth:"85%",animation:"fadeUp .18s ease"}}>
            <div style={{width:24,height:24,borderRadius:5,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,marginTop:1,background:msg.role==="ai"?`${T.accent}28`:T.bgInput,color:msg.role==="ai"?T.accentLt:T.txtSec}}>
              {msg.role==="ai"?"AI":user.name.charAt(0)}
            </div>
            <div style={{padding:"8px 12px",borderRadius:6,fontSize:12,lineHeight:1.7,background:msg.role==="ai"?T.bgInput:`${T.accent}14`,border:`1px solid ${msg.role==="ai"?T.border:T.accent+"33"}`,color:msg.role==="ai"?T.txtSec:T.txtPrim,whiteSpace:"pre-wrap"}}>
              {render(msg.content)}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:8,alignSelf:"flex-start"}}>
            <div style={{width:24,height:24,borderRadius:5,background:`${T.accent}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:T.accentLt}}>AI</div>
            <div style={{padding:"10px 14px",borderRadius:6,background:T.bgInput,border:`1px solid ${T.border}`,display:"flex",gap:4,alignItems:"center"}}>
              {[0,.15,.3].map(d=><span key={d} style={{width:5,height:5,background:T.txtTert,borderRadius:"50%",display:"inline-block",animation:`dot .8s ${d}s infinite`}}/>)}
            </div>
          </div>
        )}
        {msgs.length<=2&&mode==="general"&&(
          <div style={{marginTop:4}}>
            <div style={{fontSize:9,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Suggested questions</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {SUGGESTIONS.map((s,i)=>(
                <button key={i} onClick={()=>send(s)} style={{background:T.bgInput,border:`1px solid ${T.border}`,color:T.txtSec,padding:"5px 10px",borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:"DM Sans",transition:"all .15s"}}>{s}</button>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>
      {mode==="general"&&(
        <div style={{display:"flex",gap:8,marginTop:8,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:7,padding:8,alignItems:"flex-end"}}>
          <textarea rows={2} placeholder="Ask about nutrition, training, supplements, recovery…" value={input} onChange={e=>setInput(e.target.value)} disabled={loading}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            style={{flex:1,background:"transparent",border:"none",color:T.txtPrim,fontSize:12,resize:"none",outline:"none",fontFamily:"DM Sans",lineHeight:1.6}}
          />
          <button onClick={()=>send()} disabled={loading||!input.trim()} style={{background:input.trim()&&!loading?T.accent:T.bgInput,color:"#fff",padding:"6px 14px",borderRadius:5,border:"none",fontSize:12,fontWeight:500,cursor:"pointer",opacity:(!input.trim()||loading)?.4:1,transition:"all .2s",fontFamily:"DM Sans",flexShrink:0}}>Send</button>
        </div>
      )}
      <div style={{fontSize:10,color:T.txtTert,textAlign:"center",padding:"5px 0",letterSpacing:".03em"}}>⚠ General fitness guidance only · Not medical advice</div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PROGRESS PAGE
════════════════════════════════════════════ */
