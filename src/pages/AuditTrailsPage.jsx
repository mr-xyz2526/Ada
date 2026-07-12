import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

function AuditTrailsPage({T}){
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");

  const LOGS=[
    {id:"A001",time:"Today, 14:32",user:"Rahul Sharma",action:"Weight Updated",detail:"80kg → 79.2kg · BMI recalculated to 25.9",type:"update",severity:"info",ip:"192.168.1.1"},
    {id:"A002",time:"Today, 14:33",user:"System",action:"Diet Plan Regenerated",detail:"Auto-triggered after weight update · 4 meals recalculated",type:"auto",severity:"info",ip:"system"},
    {id:"A003",time:"Today, 11:15",user:"Rahul Sharma",action:"Workout Completed",detail:"Back day logged · 5 exercises · 1h 12m duration",type:"workout",severity:"info",ip:"192.168.1.1"},
    {id:"A004",time:"Today, 08:02",user:"Rahul Sharma",action:"Login",detail:"Successful login from Chrome · Mumbai, IN",type:"auth",severity:"info",ip:"103.24.18.9"},
    {id:"A005",time:"Yesterday, 19:44",user:"Rahul Sharma",action:"Goal Changed",detail:"Fat Loss → Muscle Gain · Calorie target adjusted +800 kcal",type:"update",severity:"warning",ip:"192.168.1.1"},
    {id:"A006",time:"Yesterday, 19:45",user:"System",action:"Plan Recalibrated",detail:"Goal change triggered full plan regeneration",type:"auto",severity:"info",ip:"system"},
    {id:"A007",time:"Yesterday, 13:20",user:"Rahul Sharma",action:"Food Swap",detail:"Chicken Breast replaced with Tuna · Lunch Meal",type:"update",severity:"info",ip:"192.168.1.1"},
    {id:"A008",time:"Jan 28, 09:11",user:"Rahul Sharma",action:"Failed Login Attempt",detail:"Wrong password · 2 attempts · Account not locked",type:"auth",severity:"warning",ip:"41.203.72.14"},
    {id:"A009",time:"Jan 27, 16:55",user:"Rahul Sharma",action:"Integration Connected",detail:"Apple Health linked · Permissions granted",type:"integration",severity:"info",ip:"192.168.1.1"},
    {id:"A010",time:"Jan 27, 16:56",user:"System",action:"Sync Completed",detail:"Apple Health · 30 days of historical data imported",type:"auto",severity:"info",ip:"system"},
    {id:"A011",time:"Jan 26, 10:30",user:"Rahul Sharma",action:"Profile Updated",detail:"Height changed 173cm → 175cm · Metrics recalculated",type:"update",severity:"info",ip:"192.168.1.1"},
    {id:"A012",time:"Jan 25, 21:00",user:"System",action:"Monthly Recalibration Due",detail:"30 days since last weight update · Notification sent",type:"auto",severity:"warning",ip:"system"},
  ];

  const typeColor={update:"#5b7cf5",auto:"#00d4aa",auth:"#e8a83a",workout:"#4db882",integration:"#38b4b4"};
  const sevColor={info:T.txtTert,warning:"#e8a83a",error:"#e05555"};
  const FILTER_TYPES=["all","update","auto","auth","workout","integration"];
  const counts=FILTER_TYPES.reduce((a,t)=>({...a,[t]:t==="all"?LOGS.length:LOGS.filter(l=>l.type===t).length}),{});

  const filtered=LOGS.filter(l=>{
    if(filter!=="all"&&l.type!==filter) return false;
    if(search.trim()){
      const q=search.toLowerCase();
      return [l.action,l.detail,l.user,l.type].some(s=>s.toLowerCase().includes(q));
    }
    return true;
  });

  return(
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={{position:"relative",borderRadius:12,overflow:"hidden",marginBottom:20,backgroundImage:"url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80')",backgroundSize:"cover",backgroundPosition:"center 40%",height:130}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#5b7cf5,#00d4aa)"}}/>
        <div style={{position:"relative",zIndex:1,padding:"22px 28px",height:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:"#5b7cf5",letterSpacing:".18em",textTransform:"uppercase",marginBottom:5}}>COMPLIANCE</div>
            <h1 style={{fontSize:24,fontWeight:800,color:"#fff",letterSpacing:"-.5px",marginBottom:3}}>Audit Trails</h1>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Complete activity log · <span style={{color:"#00d4aa",fontWeight:600}}>{LOGS.length} events recorded</span></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {[["📋",LOGS.length+" Events","#5b7cf5"],["⚠️",LOGS.filter(l=>l.severity==="warning").length+" Warnings","#e8a83a"],["🔐",LOGS.filter(l=>l.type==="auth").length+" Auth","#4db882"]].map(([ic,lb,cl])=>(
              <div key={lb} style={{background:"rgba(0,0,0,0.5)",border:`1px solid ${cl}44`,borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:14}}>{ic}</div>
                <div style={{fontSize:9,color:cl,fontWeight:600,marginTop:2,whiteSpace:"nowrap"}}>{lb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
        {[["Total",LOGS.length,"#5b7cf5"],["Auto Actions",counts.auto,"#00d4aa"],["User Actions",counts.update+counts.workout,"#4db882"],["Auth Events",counts.auth,"#e8a83a"],["Warnings",LOGS.filter(l=>l.severity==="warning").length,"#e07a35"]].map(([l,v,c])=>(
          <div key={l} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderTop:`2px solid ${c}`,borderRadius:8,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:700,color:c,lineHeight:1,marginBottom:3}}>{v}</div>
            <div style={{fontSize:9,color:T.txtTert,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,padding:3,gap:2,flexWrap:"wrap"}}>
          {FILTER_TYPES.map(id=>(
            <button key={id} onClick={()=>setFilter(id)} style={{padding:"6px 10px",borderRadius:5,fontSize:10,fontWeight:filter===id?600:400,background:filter===id?T.bgActive:"transparent",color:filter===id?T.txtPrim:T.txtSec,border:`1px solid ${filter===id?T.borderAct:"transparent"}`,cursor:"pointer",fontFamily:"DM Sans",transition:"all .15s",whiteSpace:"nowrap"}}>
              {id.charAt(0).toUpperCase()+id.slice(1)} ({counts[id]})
            </button>
          ))}
        </div>
        <input placeholder="Search events…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{flex:1,minWidth:160,background:T.bgInput,border:`1px solid ${T.border}`,color:T.txtPrim,borderRadius:7,padding:"8px 12px",fontSize:11,outline:"none"}}/>
      </div>

      <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10}}>
        <div style={{display:"grid",gridTemplateColumns:"68px 10px 1fr 90px 110px",gap:10,padding:"10px 18px",borderBottom:`1px solid ${T.border}`,fontSize:9,fontWeight:600,color:T.txtTert,textTransform:"uppercase",letterSpacing:".07em"}}>
          <div>ID</div><div></div><div>Action / Detail</div><div style={{textAlign:"center"}}>Type</div><div style={{textAlign:"right"}}>Time</div>
        </div>
        {filtered.length===0
          ?<div style={{textAlign:"center",padding:"48px 0",color:T.txtTert,fontSize:12}}>No events match your filter</div>
          :filtered.map((log)=>(
            <div key={log.id} style={{display:"grid",gridTemplateColumns:"68px 10px 1fr 90px 110px",gap:10,padding:"12px 18px",borderBottom:`1px solid ${T.border}44`,alignItems:"center"}}>
              <div style={{fontFamily:"DM Mono",fontSize:9,color:T.txtTert}}>{log.id}</div>
              <div style={{width:8,height:8,borderRadius:"50%",background:sevColor[log.severity],boxShadow:log.severity!=="info"?`0 0 5px ${sevColor[log.severity]}`:"none"}}/>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:T.txtPrim,marginBottom:2}}>{log.action}</div>
                <div style={{fontSize:10,color:T.txtTert,lineHeight:1.4}}>{log.detail}</div>
                <div style={{fontSize:9,color:T.txtTert,marginTop:2,fontFamily:"DM Mono"}}>by {log.user} · {log.ip}</div>
              </div>
              <div style={{textAlign:"center"}}>
                <span style={{fontSize:9,fontWeight:600,color:typeColor[log.type],background:`${typeColor[log.type]}22`,border:`1px solid ${typeColor[log.type]}44`,borderRadius:4,padding:"3px 7px",textTransform:"uppercase"}}>{log.type}</span>
              </div>
              <div style={{fontSize:10,color:T.txtTert,textAlign:"right",fontFamily:"DM Mono"}}>{log.time}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   VENDOR RISK PAGE
════════════════════════════════════════════ */
