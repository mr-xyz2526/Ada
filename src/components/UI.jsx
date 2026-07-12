import { useState } from "react";
import { Tooltip } from "recharts";


const Spin = ({T}) => (
  <span style={{display:"inline-block",width:12,height:12,border:`2px solid rgba(91,124,245,.25)`,borderTopColor:T.accent,borderRadius:"50%",animation:"spin .6s linear infinite"}} />
);

const StatCard = ({icon,label,value,sub,color,small,delay=0,T})=>(
  <div className="stat-card" style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,padding:"18px 20px",display:"flex",flexDirection:"column",gap:8,minHeight:small?80:100,flex:1,animation:`fadeUp .4s ease ${delay}s both`,cursor:"default"}}>
    <div style={{display:"flex",alignItems:"center",gap:7}}>
      <span style={{fontSize:12,opacity:.7}}>{icon}</span>
      <span style={{fontSize:11,color:T.txtSec,fontWeight:400,letterSpacing:".02em"}}>{label}</span>
    </div>
    <div style={{fontSize:small?20:28,fontWeight:700,color:color||T.txtPrim,lineHeight:1,letterSpacing:"-.5px"}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:T.txtTert}}>{sub}</div>}
  </div>
);

const BtnPrimary = ({children,onClick,disabled,icon,sm,style={},T})=>(
  <button className="btn-primary" onClick={onClick} disabled={disabled} style={{
    display:"inline-flex",alignItems:"center",gap:6,
    padding:sm?"6px 14px":"9px 20px",
    background:T.bgBtn,color:"#ffffff",
    border:`1px solid ${T.borderAct}`,borderRadius:6,
    fontSize:sm?11:12,fontWeight:500,letterSpacing:".02em",
    opacity:disabled?.45:1,...style
  }}>
    {icon&&<span style={{fontSize:13}}>{icon}</span>}
    {disabled&&typeof children==="string"&&children.includes("…")?<><Spin T={T}/>{children}</>:children}
  </button>
);

const BtnGhost = ({children,onClick,disabled,icon,sm,style={},T})=>(
  <button className="btn-ghost" onClick={onClick} disabled={disabled} style={{
    display:"inline-flex",alignItems:"center",gap:6,
    padding:sm?"6px 12px":"9px 18px",
    background:"transparent",color:T.txtSec,
    border:`1px solid ${T.border}`,borderRadius:6,
    fontSize:sm?11:12,fontWeight:400,
    opacity:disabled?.45:1,...style
  }}>
    {icon&&<span>{icon}</span>}{children}
  </button>
);

const ChartTip = ({active,payload,label,T})=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:T.bgInput,border:`1px solid ${T.border2}`,borderRadius:6,padding:"8px 12px",fontSize:11}}>
      {label&&<div style={{color:T.txtSec,marginBottom:4}}>{label}</div>}
      {payload.map((p,i)=><div key={i} style={{color:p.color||T.txtPrim,fontWeight:600}}>{p.name}: {p.value}</div>)}
    </div>
  );
};

/* ════════════════════════════════════════════
   THEME TOGGLE BUTTON
════════════════════════════════════════════ */
const ThemeToggle = ({isDark,onToggle,T})=>(
  <div onClick={onToggle} style={{
    display:"flex",alignItems:"center",gap:8,
    padding:"7px 10px",borderRadius:6,cursor:"pointer",
    color:T.txtSec,fontSize:12,
    transition:"background .2s",
    userSelect:"none",
  }}>
    <div style={{
      width:34,height:18,borderRadius:9,
      background:isDark?"#5b7cf5":"#cdd0d8",
      position:"relative",transition:"background .25s",
      flexShrink:0,
    }}>
      <div style={{
        position:"absolute",top:2,
        left:isDark?16:2,
        width:14,height:14,borderRadius:"50%",
        background:"#fff",
        transition:"left .25s",
        boxShadow:"0 1px 4px rgba(0,0,0,.25)",
      }}/>
    </div>
    <span>{isDark?"Dark Mode":"Light Mode"}</span>
  </div>
);

/* ════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════ */