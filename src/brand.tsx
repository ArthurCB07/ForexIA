import React from'react';
export function Mark({size=28,tone='color',decorative=false}:{size?:number,tone?:'color'|'mono',decorative?:boolean}){
 const bar=tone==='mono'?'currentColor':'#00C2D6';
 const hit=tone==='mono'?'currentColor':'#00e5ff';
 return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" {...(decorative?{'aria-hidden':'true'}:{role:'img','aria-label':'Forex IA Studio'})}>
  <rect x="4" y="19" width="6" height="9" rx="1.5" fill={bar} opacity=".55"/>
  <rect x="13" y="13" width="6" height="15" rx="1.5" fill={bar} opacity=".8"/>
  <rect x="22" y="5" width="6" height="23" rx="1.5" fill={bar}/>
  <path d="M2 16h28" stroke={hit} strokeWidth="2" strokeLinecap="round"/>
 </svg>;
}
export function Robo3D({size=34,barras=[5,8,12],decorative=true}:{size?:number,barras?:number[],decorative?:boolean}){
 const [b1,b2,b3]=barras;
 return <span className="robo3d" style={{width:size,height:size*1.12}} {...(decorative?{'aria-hidden':'true'}:{role:'img','aria-label':'Robô'})}>
  <span className="roboPlaca"/>
  <svg className="roboCorpo" viewBox="0 0 40 45" fill="none">
   <path d="M20 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
   <circle cx="20" cy="2.5" r="2.5" fill="currentColor"/>
   <rect x="4" y="6" width="32" height="26" rx="9" fill="var(--roboCasco,#0d1a28)" stroke="currentColor" strokeWidth="1.5"/>
   <rect x="0.5" y="14" width="4" height="9" rx="2" fill="currentColor" opacity=".55"/>
   <rect x="35.5" y="14" width="4" height="9" rx="2" fill="currentColor" opacity=".55"/>
   <rect x="9" y="34" width="22" height="9" rx="4" fill="var(--roboCasco,#0d1a28)" stroke="currentColor" strokeWidth="1.5" opacity=".85"/>
  </svg>
  <svg className="roboVisor" viewBox="0 0 40 45" fill="none">
   <rect x="9" y="12" width="22" height="15" rx="5" fill="#02070f"/>
   <rect x="12.5" y={25-b1} width="3.4" height={b1} rx="1.2" fill="currentColor" opacity=".55"/>
   <rect x="18.3" y={25-b2} width="3.4" height={b2} rx="1.2" fill="currentColor" opacity=".8"/>
   <rect x="24.1" y={25-b3} width="3.4" height={b3} rx="1.2" fill="currentColor"/>
   <path d="M10.5 19.5h19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".9"/>
  </svg>
 </span>;
}
export function Wordmark({size=21,withStudio=true}:{size?:number,withStudio?:boolean}){
 return <span className="fiaMark" style={{fontSize:size}}><Mark size={Math.round(size*1.35)} decorative/><b>FOREX <span>IA</span></b>{withStudio&&<em>STUDIO</em>}</span>;
}
