import React from'react';
// Marca: três barras crescentes cortadas pela linha de execução (o nível de entrada).
// viewBox 32x32 para continuar legível a 16px no favicon.
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
export function Wordmark({size=21,withStudio=true}:{size?:number,withStudio?:boolean}){
 return <span className="fiaMark" style={{fontSize:size}}><Mark size={Math.round(size*1.35)} decorative/><b>FOREX <span>IA</span></b>{withStudio&&<em>STUDIO</em>}</span>;
}
