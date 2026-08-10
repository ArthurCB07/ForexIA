import React,{createContext,useCallback,useContext,useEffect,useRef,useState}from'react';
const Ctx=createContext<any>({show:()=>{}});
export function useToast(){return useContext(Ctx)}
export function ToastProvider({children}:any){
 const[itens,setItens]=useState<any[]>([]);
 const timers=useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
 useEffect(()=>()=>{timers.current.forEach(id=>clearTimeout(id));timers.current.clear()},[]);
 const show=useCallback((t:any)=>{
  const id=Math.random().toString(36).slice(2);
  setItens(l=>[...l,{...t,id}]);
  // Erro fica mais tempo na tela: costuma exigir uma ação do usuário.
  const h=setTimeout(()=>{setItens(l=>l.filter(x=>x.id!==id));timers.current.delete(h)},t.tipo==='erro'?8000:4000);
  timers.current.add(h);
 },[]);
 return <Ctx.Provider value={{show}}>{children}
  <div className="toastWrap" role="status" aria-live="polite">
   {itens.map(t=><div className={'toast '+t.tipo} key={t.id}>
    <span>{t.texto}</span>
    {t.acao&&<button onClick={()=>{t.acao.onClick();setItens(l=>l.filter(x=>x.id!==t.id))}}>{t.acao.rotulo}</button>}
   </div>)}
  </div>
 </Ctx.Provider>;
}
export function LoadingButton({loading,children,disabled,className,type='button',...rest}:any){
 return <button type={type} {...rest} disabled={disabled||loading} className={(className||'')+' btnLoad'+(loading?' on':'')}>
  {loading&&<i className="btnSpin" aria-hidden="true"/>}<span>{children}</span>
 </button>;
}
export function Skeleton({linhas=3}:{linhas?:number}){
 return <div className="skel" aria-hidden="true">{Array.from({length:linhas}).map((_,i)=><div key={i} style={{width:(100-i*11)+'%'}}/>)}</div>;
}
