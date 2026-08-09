import'@fontsource/archivo/700.css';import'@fontsource/archivo/800.css';import'@fontsource/ibm-plex-sans/400.css';import'@fontsource/ibm-plex-sans/500.css';import'@fontsource/ibm-plex-sans/600.css';import'@fontsource/ibm-plex-mono/400.css';import'@fontsource/ibm-plex-mono/600.css';import React,{useEffect,useMemo,useRef,useState}from'react';import{createRoot}from'react-dom/client';import{Database,Activity,Settings,Home,BarChart3,Trophy,DownloadCloud,LineChart as LineIcon,Mic,MicOff,Brain,User}from'lucide-react';import'./styles.css';
const SESSION_KEY='fia_session';
function loadSession(){try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw):null}catch{return null}}
function persistSession(s:any){try{if(s)localStorage.setItem(SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(SESSION_KEY)}catch{}}
let currentSession:any=loadSession();
let sessionListener:any=null;
function setCurrentSession(s:any){currentSession=s;persistSession(s);if(sessionListener)sessionListener(s)}
// O access_token do Supabase dura 1h. Sem renovar, a sessão vence no meio do uso e tudo vira 401.
// Uma renovação por vez: chamadas simultâneas que levarem 401 esperam a mesma promessa.
let refreshing:Promise<boolean>|null=null;
async function refreshSession():Promise<boolean>{
  if(!currentSession?.refreshToken)return false;
  if(!refreshing){
    refreshing=(async()=>{
      try{
        const r=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:currentSession.refreshToken})});
        if(!r.ok)return false;
        const d=await r.json();
        if(!d?.session?.access_token)return false;
        setCurrentSession({token:d.session.access_token,refreshToken:d.session.refresh_token,user:d.user||currentSession.user});
        return true;
      }catch{return false}
      finally{setTimeout(()=>{refreshing=null},0)}
    })();
  }
  return refreshing;
}
const apiOnce=async(u:string,o:any={})=>{
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(), o?.timeoutMs||20000);
  try{
    const token=currentSession?.token;
    const headers={...(o.headers||{}), ...(token?{Authorization:'Bearer '+token}:{})};
    const r=await fetch(u,{...o,headers,signal:ctrl.signal});
    const txt=await r.text();
    let data:any={};
    try{data=txt?JSON.parse(txt):{}}catch{
      const clean=String(txt||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
      data={ok:false,error:clean||'Resposta inválida'}
    }
    if(!r.ok){
      const err:any=new Error(data?.error||('HTTP '+r.status));
      err.code=data?.code; err.cost=data?.cost; err.balance=data?.balance; err.status=r.status;
      throw err;
    }
    return data;
  }finally{clearTimeout(t)}
};
const api=async(u:string,o:any={})=>{
  try{
    return await apiOnce(u,o);
  }catch(e:any){
    // 401 com sessão salva = token venceu. Renova e repete uma vez; se não der, derruba pro login.
    const podeRenovar = e?.status===401 && currentSession?.refreshToken && !String(u).startsWith('/api/auth/');
    if(!podeRenovar) throw e;
    const ok=await refreshSession();
    if(!ok){ setCurrentSession(null); const err:any=new Error('Sua sessão expirou. Entre novamente no Perfil.'); err.status=401; err.code='SESSION_EXPIRED'; throw err }
    return apiOnce(u,o);
  }
};const br=(n:any)=>Number(n||0).toLocaleString('pt-BR');const money=(v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function billingErrorInfo(e:any):{message:string,needsPerfil:boolean}{
 if(e?.code==='INSUFFICIENT_CREDITS')return{message:`Saldo insuficiente (custo ${money(e.cost)}, saldo ${money(e.balance)}). Recarregue no Perfil.`,needsPerfil:true};
 if(e?.status===401)return{message:'Faça login no Perfil para continuar.',needsPerfil:true};
 return{message:String(e?.message||e||'Erro inesperado.'),needsPerfil:false};
}

class ErrorBoundary extends React.Component<any,{hasError:boolean,error:any}>{
  constructor(props:any){super(props);this.state={hasError:false,error:null}}
  static getDerivedStateFromError(error:any){return {hasError:true,error}}
  componentDidCatch(error:any,info:any){console.error('Erro na tela:',error,info)}
  render(){
    if(this.state.hasError){
      return <section><h1>⚠️ Tela recuperada</h1><div className="panel"><h2>A interface encontrou um erro</h2><p>A tela não ficará mais em branco. Atualize com <b>Ctrl + F5</b> ou volte ao Dashboard.</p><pre>{String(this.state.error?.message||this.state.error)}</pre><button onClick={()=>{this.setState({hasError:false,error:null}); location.href='/?v=55'}}>Voltar ao Dashboard</button></div></section>
    }
    return this.props.children
  }
}

type Page='dashboard'|'perfil'|'import'|'datasets'|'viewer'|'builder'|'robots'|'compare'|'lab'|'optimizer'|'validation'|'forward'|'voice'|'ranking'|'setup';type DS={id:string;pair:string;timeframe:string;count:number;first:string;last:string};
// Menu agrupado por etapa do fluxo. No mobile vira gaveta (drawer) — empilhar os 15 botões
// empurrava o conteúdo para ~970px abaixo do topo em toda navegação.
const NAV_GROUPS:any[]=[
 ['Dados',[['import',DownloadCloud,'Smart Import'],['datasets',Database,'Datasets'],['viewer',BarChart3,'Visualizar']]],
 ['Estratégia',[['builder',Brain,'Criar Robô'],['voice',Mic,'Agente de Voz'],['robots',Database,'Meus Robôs']]],
 ['Análise',[['lab',LineIcon,'Backtest Lab'],['optimizer',Brain,'Otimizador'],['compare',LineIcon,'Comparar'],['ranking',Trophy,'Ranking']]],
 ['Produção',[['validation',LineIcon,'Validação MT5'],['forward',Activity,'Teste Real'],['setup',Settings,'Instalação']]],
 ['Conta',[['perfil',User,'Perfil']]],
];
const NAV_LABEL:any=Object.fromEntries([['dashboard','Dashboard'],...NAV_GROUPS.flatMap(([,its]:any)=>its.map(([id,,label]:any)=>[id,label]))]);
// O saldo ficava só no Perfil, último item da lista e fora da tela: num sistema pago por uso
// o usuário precisa ver quanto tem antes de cada ação. Recarrega quando a página muda.
function SaldoSidebar({setPage,page}:any){
 const[info,setInfo]=useState<any>(null);
 useEffect(()=>{let vivo=true;api('/api/profile').then(r=>{if(vivo)setInfo(r)}).catch(()=>{});return()=>{vivo=false}},[page]);
 const saldo=Number(info?.wallet?.balance||0);
 const gratis=info&&(info.wallet.freeRobotUsed===false||info.wallet.freeBacktestUsed===false);
 return <button className={'saldoBox'+(info&&saldo<1&&!gratis?' baixo':'')} onClick={()=>setPage('perfil')} title="Ver carteira e recarregar">
  <span>Seu saldo</span>
  <b>{info?money(saldo):'...'}</b>
  {gratis&&<em>teste grátis disponível</em>}
  {info&&saldo<1&&!gratis&&<em>recarregue para continuar</em>}
 </button>;
}
function Sidebar({page,setPage,open,setOpen}:any){
 const go=(id:string)=>{setPage(id);setOpen(false)};
 return <>
  <div className={'navScrim'+(open?' show':'')} onClick={()=>setOpen(false)} aria-hidden="true"/>
  <aside className={open?'open':''} aria-label="Navegação principal">
   <div className="brand">🤖 FOREX <span>IA</span></div>
   <SaldoSidebar setPage={go} page={page}/>
   <button className={'navItem'+(page==='dashboard'?' active':'')} onClick={()=>go('dashboard')} aria-current={page==='dashboard'?'page':undefined}><Home size={18}/> Dashboard</button>
   {NAV_GROUPS.map(([grupo,items]:any)=><div className="navGroup" key={grupo}>
    <div className="navGroupTitle">{grupo}</div>
    {items.map(([id,Icon,label]:any)=><button className={'navItem'+(page===id?' active':'')} onClick={()=>go(id)} key={id} aria-current={page===id?'page':undefined}><Icon size={18}/> {label}</button>)}
   </div>)}
  </aside>
 </>
}
function TopBar({page,setPage,open,setOpen}:any){
 return <header className="appBar">
  <button className="navToggle" onClick={()=>setOpen(!open)} aria-label={open?'Fechar menu':'Abrir menu'} aria-expanded={open}>{open?'✕':'☰'}</button>
  <div className="appBarTitle">{NAV_LABEL[page]||'Dashboard'}</div>
  <button className="appBarProfile" onClick={()=>{setPage('perfil');setOpen(false)}} aria-label="Perfil e carteira"><User size={18}/></button>
 </header>
}
function Hero(){
  return <div className="hero">
    <div>
      <h1>ROBOT<br/><span>WIZARD v67</span></h1>
      <p>Wizard v67: cada robô agora fica em <code>data/robots/&lt;id&gt;</code> com robot.json, MQ5 e validação.</p>
    </div>
    <div className="robotFace"><div className="eyes"><i></i><i></i></div><b>W</b></div>
  </div>
}

function Cards({o}:any){return <div className="cards"><div className="card"><span>Versão</span><b>{o.version||'31.0.0'}</b></div><div className="card"><span>Status</span><b className={o.online?'green':'red'}>{o.online?'ONLINE':'OFFLINE'}</b></div><div className="card"><span>Datasets</span><b>{o.datasets||0}</b></div><div className="card"><span>Robôs</span><b>{o.robots||0}</b></div><div className="card"><span>Candles</span><b>{br(o.totalCandles)}</b></div><div className="card"><span>Velocidade</span><b>{br(o.candlesPerMinute)}/min</b></div><div className="card"><span>Banco</span><b>{o.diskMB||0} MB</b></div></div>}
function Dashboard({o,status}:any){return <section><Hero/><Cards o={o}/>
 <div className="panel"><h2>Status do Banco e MT5</h2>
  <div className="statusGrid">
   <div className="mini"><b>Último candle recebido</b><p>{o.lastCandle?`${o.lastCandle.pair} ${o.lastCandle.timeframe} • ${o.lastCandle.time}`:'Aguardando dados'}</p></div>
   <div className="mini"><b>Última atualização</b><p>{o.lastUpdate?new Date(o.lastUpdate).toLocaleString('pt-BR'):'Sem atualização'}</p></div>
   <div className="mini"><b>Tamanho exato</b><p>{br(o.diskBytes||0)} bytes<br/>{o.diskMB||0} MB</p></div>
  </div>
 </div>
 <div className="panel"><h2>Progresso Smart Import</h2><div className="bar"><i style={{width:(o.quickProgress||0)+'%'}}/></div><p>{o.quickProgress||0}% da base rápida estimada. Modo: <b>{o.importConfig?.mode||'quick'}</b></p><small>O tamanho em MB pode ficar parado quando chegam candles repetidos ou quando a diferença é menor que 0,01 MB.</small></div>
 <div className="panel"><h2>Resumo por par</h2><div className="pairgrid">{(o.byPair||[]).map((p:any)=><div className="mini" key={p.pair}><b>{p.pair}</b><p>{br(p.candles)} candles<br/>{p.timeframes.join(', ')}<br/>Último: {p.last||'-'}</p></div>)}</div></div>
 <div className="panel"><h2>Log MT5</h2>{status.slice(0,12).map((s:any)=><div className="status" key={s.id}><b>{s.type==='candles'?`${s.pair} ${s.timeframe}`:s.etapa}</b><p>{s.type==='candles'?`Recebidos: ${s.received} • Total: ${br(s.total)}`:`Servidor: ${s.server||''} • Bridge: ${s.bridge||''}`}<br/>{new Date(s.createdAt).toLocaleString('pt-BR')}</p></div>)}</div></section>}

// v126: formulário de login/cadastro isolado — usado na Landing (modal) e no Perfil (fallback).
function AuthCard({setSession,initialMode,onClose}:any){
 const[mode,setMode]=useState<'login'|'signup'>(initialMode==='signup'?'signup':'login');
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[authMsg,setAuthMsg]=useState(''),[authLoading,setAuthLoading]=useState(false),[authOk,setAuthOk]=useState(false);
 useEffect(()=>{if(initialMode==='login'||initialMode==='signup')setMode(initialMode)},[initialMode]);
 async function doAuth(e?:any){
  if(e&&e.preventDefault)e.preventDefault();
  setAuthMsg('');setAuthOk(false);
  if(!email.trim()||!password){setAuthMsg('Informe e-mail e senha.');return}
  if(mode==='signup'&&password.length<6){setAuthMsg('A senha precisa ter pelo menos 6 caracteres.');return}
  setAuthLoading(true);
  try{
   if(mode==='login'){
    const r=await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    setSession({token:r.session.access_token,refreshToken:r.session.refresh_token,user:r.user});
   }else{
    const r=await api('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    if(r.session?.access_token){setSession({token:r.session.access_token,refreshToken:r.session.refresh_token,user:r.user})}
    else{setAuthMsg('Conta criada! Confirme o e-mail que enviamos e depois faça login.');setAuthOk(true);setMode('login');setPassword('')}
   }
  }catch(e:any){setAuthMsg(String(e.message||e))}
  finally{setAuthLoading(false)}
 }
 const troca=(m:'login'|'signup')=>{if(m===mode)return;setMode(m);setAuthMsg('');setAuthOk(false)};
 return <form className="authCard" onSubmit={doAuth}>
  {onClose&&<button type="button" className="authClose" onClick={onClose} aria-label="Fechar">✕</button>}
  <div className="authLogo"><div className="eyes"><i></i><i></i></div><b>W</b></div>
  <h1 className="authTitle">FOREX <span>IA</span></h1>
  <p className="authSub">{mode==='login'?'Entre para criar robôs, rodar backtests e acessar sua carteira.':'Crie sua conta e ganhe o 1º robô e o 1º backtest grátis.'}</p>
  <div className="authTabs">
   <button type="button" className={mode==='login'?'active':''} onClick={()=>troca('login')}>Entrar</button>
   <button type="button" className={mode==='signup'?'active':''} onClick={()=>troca('signup')}>Criar conta</button>
  </div>
  <label className="authField"><span>E-mail</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com"/></label>
  <label className="authField"><span>Senha</span><input type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='login'?'Sua senha':'Mínimo 6 caracteres'}/></label>
  <button className="authSubmit" type="submit" disabled={authLoading}>{authLoading?'Aguarde...':(mode==='login'?'Entrar':'Criar minha conta')}</button>
  {authMsg&&<div className={'authMsg '+(authOk?'info':'err')}><span>{authOk?'✅':'⚠️'}</span><span>{authMsg}</span></div>}
  <p className="authFoot">1ª criação de robô e 1º backtest <b>grátis</b>.<br/>Depois disso, você paga por uso a partir de <b>R$ 0,26</b> por indicador.</p>
 </form>
}

function PerfilPage({session,setSession}:any){
 const[profile,setProfile]=useState<any>(null),[profileMsg,setProfileMsg]=useState('');
 const[amount,setAmount]=useState(50),[pix,setPix]=useState<any>(null),[pixMsg,setPixMsg]=useState(''),[pixLoading,setPixLoading]=useState(false);
 async function loadProfile(){try{setProfile(await api('/api/profile'))}catch(e:any){setProfileMsg(String(e.message||e))}}
 useEffect(()=>{if(session?.token)loadProfile()},[session?.token]);
 function logout(){setSession(null);setProfile(null);setPix(null)}
 useEffect(()=>{
  if(!pix?.paymentId||pix.credited)return;
  const t=setInterval(async()=>{
   try{
    const r=await api('/api/wallet/topup/pix/'+pix.paymentId+'/status');
    if(r.credited){setPix((p:any)=>p?{...p,credited:true}:p);setPixMsg('Pagamento aprovado! Saldo atualizado.');loadProfile()}
   }catch{}
  },3000);
  return()=>clearInterval(t);
 },[pix?.paymentId,pix?.credited]);
 async function gerarPix(){
  setPixMsg('');setPixLoading(true);setPix(null);
  try{
   const r=await api('/api/wallet/topup/pix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount})});
   setPix({paymentId:r.paymentId,qrCode:r.qrCode,qrCodeBase64:r.qrCodeBase64,amount:r.amount,testMode:r.testMode,credited:false});
  }catch(e:any){setPixMsg(String(e.message||e))}
  finally{setPixLoading(false)}
 }
 async function simulateApprove(){
  if(!pix?.paymentId)return;
  setPixLoading(true);
  try{
   const r=await api('/api/wallet/topup/pix/'+pix.paymentId+'/simulate-approve',{method:'POST'});
   if(r.credited){setPix((p:any)=>p?{...p,credited:true}:p);setPixMsg('Pagamento aprovado (modo teste)! Saldo atualizado.');loadProfile()}
  }catch(e:any){setPixMsg(String(e.message||e))}
  finally{setPixLoading(false)}
 }
 function copiarCodigo(){if(pix?.qrCode)navigator.clipboard.writeText(pix.qrCode).then(()=>setPixMsg('Código copiado.'))}

 if(!session?.token)return <section className="authWrap"><AuthCard setSession={setSession}/></section>;

 const wallet=profile?.wallet||{};
 const pr=profile?.pricing||{};
 return <section><h1>Perfil</h1>
  <div className="panel"><h2>Conta</h2><div className="cards billingCards"><div className="card"><span>E-mail</span><b>{session.user?.email}</b></div><div className="card"><span>Saldo</span><b>{profile?money(wallet.balance):'...'}</b></div></div><button className="secondaryBtn" onClick={logout}>Sair</button>{profileMsg&&<p className="warn">{profileMsg}</p>}</div>
  <div className="panel"><h2>Teste grátis</h2><div className="cards billingCards"><div className="card"><span>Criação de robô</span><b className={!profile?'':wallet.freeRobotUsed?'red':'green'}>{!profile?'...':wallet.freeRobotUsed?'Já usado':'Disponível'}</b></div><div className="card"><span>Backtest</span><b className={!profile?'':wallet.freeBacktestUsed?'red':'green'}>{!profile?'...':wallet.freeBacktestUsed?'Já usado':'Disponível'}</b></div></div><p className="muted">A otimização genética é sempre cobrada, mesmo na primeira vez.</p></div>
  <div className="panel"><h2>Recarregar com PIX</h2>
   <div className="presetBtns"><button onClick={()=>setAmount(20)}>R$ 20</button><button onClick={()=>setAmount(50)}>R$ 50</button><button onClick={()=>setAmount(100)}>R$ 100</button></div>
   <label>Valor<input type="number" min={1} value={amount} onChange={e=>setAmount(+e.target.value)}/></label>
   <div className="actionsRow"><button disabled={pixLoading} onClick={gerarPix}>{pixLoading?'Gerando...':'Gerar PIX'}</button></div>
   {pix&&<div className="mini">
    {!pix.credited?<>
     {pix.qrCodeBase64&&<img alt="QR Code PIX" style={{maxWidth:220}} src={'data:image/png;base64,'+pix.qrCodeBase64}/>}
     {pix.qrCode&&<p><b>Copia e cola:</b><br/><textarea readOnly value={pix.qrCode} rows={3} style={{width:'100%'}}/></p>}
     <div className="actionsRow"><button className="secondaryBtn" onClick={copiarCodigo}>Copiar código</button>{pix.testMode&&<button className="secondaryBtn" onClick={simulateApprove}>🧪 Simular aprovação (modo teste)</button>}</div>
     <p className="muted">Aguardando pagamento de {money(pix.amount)}...</p>
    </>:<p className="ok">Pagamento de {money(pix.amount)} aprovado!</p>}
   </div>}
   {pixMsg&&<p className={pixMsg.includes('aprovado')||pixMsg.includes('copiado')?'ok':'warn'}>{pixMsg}</p>}
  </div>
  <div className="panel"><h2>Tabela de cobrança</h2><table><thead><tr><th>Ação</th><th>Cobrança</th><th>Exemplo com 4 indicadores</th></tr></thead><tbody><tr><td>Criar robô</td><td>{money(pr.createRobotPerIndicator)} por indicador</td><td>{money((pr.createRobotPerIndicator||0)*4)}</td></tr><tr><td>Backtest</td><td>{money(pr.backtestPerIndicator)} por indicador</td><td>{money((pr.backtestPerIndicator||0)*4)}</td></tr><tr><td>Otimização genética</td><td>{money(pr.optimizerPerIndicator)} por indicador</td><td>{money((pr.optimizerPerIndicator||0)*4)}</td></tr></tbody></table></div>
  <div className="panel"><h2>Extrato</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Saldo</th></tr></thead><tbody>{(profile?.ledger||[]).map((x:any)=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString('pt-BR')}</td><td>{x.description}</td><td>{money(x.amount)}</td><td>{money(x.balance_after)}</td></tr>)}</tbody></table></div>
 </section>
}

function AccessGate({children,setPage,session}:any){
 if(!session?.token)return <section><h1>Acesso</h1><div className="panel"><h2>Entre para continuar</h2><p>Criar robôs, rodar backtests e o otimizador exige uma conta. A 1ª criação de robô e o 1º backtest são grátis.</p><div className="actionsRow"><button onClick={()=>setPage&&setPage('perfil')}>Entrar / Criar conta</button></div></div></section>;
 return <>{children}</>;
}

function ImportPage({load,o}:any){const[mode,setMode]=useState(o.importConfig?.mode||'quick');async function save(){await api('/api/import/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,years:mode==='quick'?1:5,allowFullImport:mode==='full'})});load()}async function compact(){await api('/api/import/compact',{method:'POST'});load()}return <section><h1>Smart Import</h1><div className="panel"><p><b>Quick:</b> mantém base recente e compacta. <b>Full:</b> mantém histórico completo.</p><select value={mode} onChange={e=>setMode(e.target.value)}><option value="quick">Importação rápida: 1 ano + limites por timeframe</option><option value="full">Importação completa: 5 anos</option></select><button onClick={save}>Salvar modo</button><button onClick={compact}>Compactar banco atual</button></div></section>}
function Datasets({datasets,setPage,setSelected}:any){return <section><h1>Datasets</h1><div className="panel"><table><thead><tr><th>Par</th><th>TF</th><th>Candles</th><th>Início</th><th>Fim</th><th>Ações</th></tr></thead><tbody>{datasets.map((d:DS)=><tr key={d.id}><td>{d.pair}</td><td>{d.timeframe}</td><td>{br(d.count)}</td><td>{d.first}</td><td>{d.last}</td><td><button onClick={()=>{setSelected(d.id);setPage('viewer')}}>Ver</button></td></tr>)}</tbody></table></div></section>}
// Mede a largura real do container. Os gráficos usavam largura fixa (1100px / 1000px), o que
// forçava scroll horizontal mesmo em telas grandes e estourava o layout no celular.
function useBoxWidth(){
 const ref=useRef<HTMLDivElement|null>(null);
 const[w,setW]=useState(0);
 useEffect(()=>{
  const el=ref.current; if(!el)return;
  const medir=()=>setW(Math.max(0,Math.round(el.getBoundingClientRect().width)));
  medir();
  const ro=new ResizeObserver(medir); ro.observe(el);
  return()=>ro.disconnect();
 },[]);
 return[ref,w] as const;
}
// Casas decimais conforme a faixa de preço (EURUSD 1,08432 vs USDJPY 151,234).
function priceDigits(range:number,ref:number){if(Math.abs(ref)>=50)return range<1?3:2;return range<0.01?5:range<1?5:4}
function Line({values}:{values:number[]}){
 const[boxRef,boxW]=useBoxWidth();
 if(!values?.length)return null;
 const W=Math.max(280,boxW||640),H=Math.max(200,Math.min(320,Math.round(W*0.32)));
 const padL=64,padR=14,padT=14,padB=24;
 const iw=Math.max(10,W-padL-padR),ih=Math.max(10,H-padT-padB);
 const mn=Math.min(...values),mx=Math.max(...values);
 const span=(mx-mn)||Math.abs(mx)||1;
 const lo=mn-span*0.08,hi=mx+span*0.08;
 const y=(v:number)=>padT+(hi-v)/((hi-lo)||1)*ih;
 const x=(i:number)=>padL+(values.length<2?iw/2:i/(values.length-1)*iw);
 const pts=values.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
 const area=`${padL},${y(values[0])} ${pts} ${x(values.length-1)},${padT+ih}  ${padL},${padT+ih}`;
 const sobe=values[values.length-1]>=values[0];
 const cor=sobe?'#36ff8b':'#ff4d6d';
 const linhas=[0,1,2,3,4].map(i=>lo+(hi-lo)*(1-i/4));
 return <div className="chartBox" ref={boxRef}>
  <svg className="chart" width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Curva de capital de ${money(values[0])} a ${money(values[values.length-1])}`}>
   <defs><linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cor} stopOpacity=".28"/><stop offset="100%" stopColor={cor} stopOpacity="0"/></linearGradient></defs>
   {linhas.map((v,i)=><g key={i}><line x1={padL} x2={W-padR} y1={y(v)} y2={y(v)} stroke="#00e5ff1f"/><text x={padL-8} y={y(v)+4} textAnchor="end" fill="#8fb5c6" fontSize="11">{money(v)}</text></g>)}
   <polygon points={area} fill="url(#lineFill)"/>
   <polyline points={pts} fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>
 </div>
}
function BarChart({rows,label='key'}:any){if(!rows?.length)return <p>Sem dados.</p>;const max=Math.max(...rows.map((x:any)=>Math.abs(x.profit)||1));return <div>{rows.map((r:any)=><div className="barrow" key={r[label]||r.key}><span>{r[label]||r.key}</span><div><i className={r.profit>=0?'pos':'neg'} style={{width:(Math.abs(r.profit)/max*100)+'%'}}/></div><b>{money(r.profit)}</b><em>{r.trades} ops • {r.winRate}%</em></div>)}</div>}
function CandleChart({candles=[],trades=[]}:{candles:any[],trades?:any[]}){
 const[boxRef,boxW]=useBoxWidth();
 const total=candles?.length||0;
 // O zoom define QUANTOS candles aparecem (janela), não o quanto o canvas estica.
 // Antes o SVG crescia até 11.550px e a escala de preço continuava sendo a do dataset inteiro:
 // dar zoom só afastava os candles, sem nunca revelar detalhe vertical.
 const[vis,setVis]=useState(0);
 const[ini,setIni]=useState(0);
 const[hover,setHover]=useState<number|null>(null);
 const drag=useRef<any>(null);
 const svgRef=useRef<SVGSVGElement|null>(null);
 const MIN_VIS=Math.min(15,total||15);
 const janela=Math.max(MIN_VIS,Math.min(vis||total||1,total||1));
 const maxIni=Math.max(0,total-janela);
 const inicio=Math.max(0,Math.min(ini,maxIni));
 useEffect(()=>{setVis(0);setIni(0);setHover(null)},[total]);
 const aplicarZoom=(fator:number,ancora?:number)=>{
  const atual=janela;
  const alvo=Math.max(MIN_VIS,Math.min(total,Math.round(atual*fator)));
  if(alvo===atual)return;
  const centro=ancora==null?inicio+atual/2:ancora;
  setVis(alvo);
  setIni(Math.max(0,Math.min(total-alvo,Math.round(centro-alvo/2))));
 };
 // Roda do mouse com preventDefault exige listener não-passivo.
 useEffect(()=>{
  const el=svgRef.current; if(!el)return;
  const onWheel=(e:WheelEvent)=>{
   e.preventDefault();
   const r=el.getBoundingClientRect();
   const rel=(e.clientX-r.left-52)/Math.max(1,r.width-66);
   aplicarZoom(e.deltaY>0?1.25:0.8,inicio+Math.max(0,Math.min(1,rel))*janela);
  };
  el.addEventListener('wheel',onWheel,{passive:false});
  return()=>el.removeEventListener('wheel',onWheel);
 },[inicio,janela,total]);
 if(!total)return <p>Sem candles para gráfico.</p>;
 const W=Math.max(240,boxW||760);
 const H=Math.max(260,Math.min(460,Math.round(W*0.46)));
 const padL=52,padR=14,padT=16,padB=30;
 const iw=Math.max(20,W-padL-padR),ih=Math.max(20,H-padT-padB);
 const win=candles.slice(inicio,inicio+janela);
 // Escala de preço da JANELA — é isto que faz o zoom realmente ampliar.
 const rawHi=Math.max(...win.map((c:any)=>+c.high)),rawLo=Math.min(...win.map((c:any)=>+c.low));
 const folga=((rawHi-rawLo)||Math.abs(rawHi)*0.001||1)*0.08;
 const hi=rawHi+folga,lo=rawLo-folga;
 const dg=priceDigits(hi-lo,rawHi);
 const slot=iw/win.length;
 const cw=Math.max(1,Math.min(slot*0.7,26));
 const y=(v:number)=>padT+(hi-v)/((hi-lo)||1)*ih;
 const cx=(i:number)=>padL+(i+0.5)*slot;
 const porTempo=new Map<string,any[]>();
 (trades||[]).forEach((t:any)=>{const k=String(t.time);if(!porTempo.has(k))porTempo.set(k,[]);porTempo.get(k)!.push(t)});
 const idxDoEvento=(e:any)=>{
  const r=(e.currentTarget as SVGSVGElement).getBoundingClientRect();
  const px=(e.clientX-r.left)*(W/Math.max(1,r.width));
  return Math.max(0,Math.min(win.length-1,Math.floor((px-padL)/slot)));
 };
 const onDown=(e:any)=>{drag.current={x:e.clientX,ini:inicio};e.currentTarget.setPointerCapture?.(e.pointerId)};
 const onMove=(e:any)=>{
  if(drag.current){
   const r=(e.currentTarget as SVGSVGElement).getBoundingClientRect();
   const dx=(e.clientX-drag.current.x)*(W/Math.max(1,r.width));
   setIni(Math.max(0,Math.min(maxIni,Math.round(drag.current.ini-dx/slot))));
   return;
  }
  setHover(idxDoEvento(e));
 };
 const onUp=(e:any)=>{drag.current=null;e.currentTarget.releasePointerCapture?.(e.pointerId)};
 const hv=hover!=null&&hover<win.length?win[hover]:null;
 const hvTrades=hv?(porTempo.get(String(hv.time))||[]):[];
 const niveis=[0,1,2,3,4].map(i=>lo+(hi-lo)*(1-i/4));
 const tempos=win.length?[0,Math.floor(win.length/2),win.length-1].filter((v,i,a)=>a.indexOf(v)===i):[];
 const zoomPct=Math.round(total/janela*100);
 const sliderZoom=Math.round(100-(janela-MIN_VIS)/Math.max(1,total-MIN_VIS)*99);
 return <div className="chartBox" ref={boxRef}>
  <div className="chartTools">
   <button className="secondaryBtn" onClick={()=>aplicarZoom(1.25)} aria-label="Diminuir zoom">− Zoom</button>
   <button className="secondaryBtn" onClick={()=>aplicarZoom(0.8)} aria-label="Aumentar zoom">+ Zoom</button>
   <button className="secondaryBtn" onClick={()=>{setVis(0);setIni(0)}}>Reset</button>
   <label className="zoomControl">Zoom<input type="range" min={1} max={100} step={1} value={sliderZoom} onChange={e=>{const p=Number(e.target.value);const alvo=Math.max(MIN_VIS,Math.round(MIN_VIS+(100-p)/99*(total-MIN_VIS)));aplicarZoom(alvo/janela)}} aria-label="Nível de zoom"/></label>
   <span>{br(win.length)} de {br(total)} candles • {zoomPct}%</span>
  </div>
  {maxIni>0&&<label className="zoomControl panControl">Posição<input type="range" min={0} max={maxIni} step={1} value={inicio} onChange={e=>setIni(Number(e.target.value))} aria-label="Posição no histórico"/></label>}
  <div className="candleWrap">
   <svg ref={svgRef} className="candleChart" width="100%" height={H} viewBox={'0 0 '+W+' '+H}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={()=>{drag.current=null;setHover(null)}}
        role="img" aria-label={'Gráfico de '+win.length+' candles'}>
    {niveis.map((v,i)=><g key={'n'+i}>
     <line x1={padL} x2={W-padR} y1={y(v)} y2={y(v)} stroke="#00e5ff1a"/>
     <text x={padL-8} y={y(v)+4} textAnchor="end" fill="#8fb5c6" fontSize="11">{v.toFixed(dg)}</text>
    </g>)}
    {tempos.map(i=><text key={'t'+i} x={Math.max(padL,Math.min(W-padR,cx(i)))} y={H-9} textAnchor={i===0?'start':i===win.length-1?'end':'middle'} fill="#8fb5c6" fontSize="11">{String(win[i]?.time||'').slice(0,16)}</text>)}
    {win.map((c:any,i:number)=>{
     const up=+c.close>=+c.open;
     const px=cx(i),yo=y(+c.open),yc=y(+c.close),yh=y(+c.high),yl=y(+c.low);
     const topo=Math.min(yo,yc),corpo=Math.max(1,Math.abs(yo-yc));
     const cor=up?'#36ff8b':'#ff4d6d';
     const ts=porTempo.get(String(c.time))||[];
     const t0=ts[0];
     return <g key={inicio+i}>
      <line x1={px} x2={px} y1={yh} y2={yl} stroke={cor} strokeWidth={Math.max(1,Math.min(cw*0.16,2.4))}/>
      <rect x={px-cw/2} y={topo} width={cw} height={corpo} fill={cor} opacity=".92"/>
      {t0&&slot>7&&<g>
       <path d={t0.type==='CALL'?('M '+px+' '+(yh-7)+' l 5 8 l -10 0 z'):('M '+px+' '+(yl+7)+' l 5 -8 l -10 0 z')} fill={Number(t0.result)>0?'#36ff8b':'#ff4d6d'} stroke="#020713" strokeWidth=".6"/>
       {ts.length>1&&<text x={px} y={t0.type==='CALL'?yh-14:yl+20} textAnchor="middle" fill="#8fb5c6" fontSize="9" fontWeight="700">{ts.length}</text>}
      </g>}
     </g>;
    })}
    {hv&&<line x1={cx(hover as number)} x2={cx(hover as number)} y1={padT} y2={padT+ih} stroke="#eafcff55" strokeWidth="1" strokeDasharray="3 3" pointerEvents="none"/>}
   </svg>
   {hv&&<div className="candleTip" style={{left:(cx(hover as number)/W*100).toFixed(2)+'%',transform:cx(hover as number)>W*0.6?'translateX(calc(-100% - 12px))':'translateX(12px)'}}>
    <b>{String(hv.time||'')}</b>
    <span>Abertura <i>{Number(hv.open).toFixed(dg)}</i></span>
    <span>Máxima <i>{Number(hv.high).toFixed(dg)}</i></span>
    <span>Mínima <i>{Number(hv.low).toFixed(dg)}</i></span>
    <span>Fechamento <i className={+hv.close>=+hv.open?'green':'red'}>{Number(hv.close).toFixed(dg)}</i></span>
    {hvTrades.length>0&&<span className="tipTrade">{hvTrades.length>1?(hvTrades.length+' operações neste candle'):(hvTrades[0].type+' · '+(Number(hvTrades[0].result)>0?'WIN':'LOSS'))}</span>}
   </div>}
  </div>
  <p className="chartHint muted">Arraste para navegar • roda do mouse para zoom • passe o cursor para ver o candle</p>
 </div>
}
function Viewer({datasets,selected,setSelected}:any){const[c,setC]=useState<any[]>([]);useEffect(()=>{if(selected)api('/api/dataset/'+selected+'?limit=260').then(d=>setC(d.candles||[]))},[selected]);return <section><h1>Visualizar</h1><div className="panel"><select value={selected} onChange={e=>setSelected(e.target.value)}>{datasets.map((d:DS)=><option key={d.id} value={d.id}>{d.pair} {d.timeframe} - {br(d.count)}</option>)}</select>{c.length>0&&<CandleChart candles={c}/>}<table><tbody>{c.slice(-10).reverse().map((x:any)=><tr key={x.i}><td>{x.time}</td><td>{x.open}</td><td>{x.high}</td><td>{x.low}</td><td>{x.close}</td><td>RSI {Number(x.rsi14||0).toFixed(1)}</td></tr>)}</tbody></table></div></section>}
function Metric({name,value}:any){return <div><span>{name}</span><b>{value}</b></div>}
function LoadingOverlay({show,text='Processando...',onForceClose}:any){return show?<div className="loadingOverlay"><div className="loaderCard"><div className="spinner"></div><b>{text}</b><p>A inteligência artificial está processando os candles e comparando os sinais. Aguarde, não clique novamente.</p>{onForceClose&&<button onClick={onForceClose}>Liberar tela</button>}</div></div>:null}

function useDatasetMeta(id:string,filters:any){const[meta,setMeta]=useState<any>(null),[preview,setPreview]=useState<any>(null);useEffect(()=>{if(id)api('/api/dataset/'+id+'/meta').then(setMeta)},[id]);useEffect(()=>{if(id)api('/api/dataset/'+id+'/filter-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filters})}).then(setPreview)},[id,JSON.stringify(filters)]);return{meta,preview}}
function numberAfter(t:string, words:string[], fallback:number){
 for(const w of words){const rx=new RegExp(w+'\D{0,30}(\d{1,3})','i');const m=t.match(rx);if(m)return +m[1]}
 return fallback;
}
const INDICATORS:any[]=[
 {cat:'Tendência',items:['EMA','SMA','WMA','HMA','VWAP','SuperTrend','Ichimoku','Alligator','ADX']},
 {cat:'Momentum',items:['RSI','MACD','Stochastic','CCI','ROC','Momentum','Williams %R']},
 {cat:'Volatilidade',items:['ATR','Bollinger Bands','Keltner','Donchian']},
 {cat:'Volume',items:['OBV','MFI','Volume Profile','VWAP']},
 {cat:'Preço',items:['Suporte','Resistência','Rompimento','Pullback','Candlestick']}
];
function detectIndicators(t:string){
 const found:any[]=[];
 const add=(type:string,period=14,extra:any={})=>{if(!found.find(x=>x.type===type&&x.period===period))found.push({type,period,...extra})};
 if(/ema|exponencial|m[eé]dia m[oó]vel exponencial/.test(t))add('ema',numberAfter(t,['ema','exponencial','média móvel exponencial','media movel exponencial'],20));
 if(/sma|simples|m[eé]dia m[oó]vel simples/.test(t))add('sma',numberAfter(t,['sma','simples','média móvel simples','media movel simples'],20));
 if(/wma|ponderada/.test(t))add('wma',numberAfter(t,['wma','ponderada'],20));
 if(/hma|hull/.test(t))add('hma',numberAfter(t,['hma','hull'],20));
 if(/vwap/.test(t))add('vwap',numberAfter(t,['vwap'],20));
 if(/supertrend|super trend/.test(t))add('supertrend',numberAfter(t,['supertrend','super trend'],10));
 if(/ichimoku/.test(t))add('ichimoku',26);
 if(/alligator/.test(t))add('alligator',34);
 if(/adx/.test(t))add('adx',numberAfter(t,['adx'],14),{threshold:20});
 if(/rsi/.test(t))add('rsi',numberAfter(t,['rsi'],14));
 if(/macd/.test(t))add('macd',26);
 if(/estoc|stoch/.test(t))add('stochastic',numberAfter(t,['estocástico','estocastico','stochastic','stoch'],14));
 if(/cci/.test(t))add('cci',numberAfter(t,['cci'],20));
 if(/roc/.test(t))add('roc',numberAfter(t,['roc'],12));
 if(/momentum/.test(t))add('momentum',numberAfter(t,['momentum'],10));
 if(/williams/.test(t))add('williams',numberAfter(t,['williams'],14));
 if(/atr/.test(t))add('atr',numberAfter(t,['atr'],14));
 if(/bollinger|bandas/.test(t))add('bollinger',numberAfter(t,['bollinger','bandas'],20));
 if(/keltner/.test(t))add('keltner',numberAfter(t,['keltner'],20));
 if(/donchian/.test(t))add('donchian',numberAfter(t,['donchian'],20));
 if(/obv/.test(t))add('obv',14);
 if(/mfi/.test(t))add('mfi',14);
 if(/volume profile|perfil de volume/.test(t))add('volume profile',20);
 if(/suporte/.test(t))add('suporte',20);
 if(/resist[eê]ncia/.test(t))add('resistência',20);
 if(/rompimento|breakout/.test(t))add('rompimento',20,{mode:'breakout'});
 if(/pullback/.test(t))add('pullback',20);
 if(/candlestick|engolfo|doji|martelo/.test(t))add('candlestick',1,{pattern:t.includes('doji')?'doji':t.includes('martelo')?'martelo':'engolfo'});
 return found.length?found:[{type:'ema',period:20},{type:'rsi',period:14}];
}
function parseVoiceToStrategy(text:string){
 const t=text.toLowerCase();
 let mode='trend'; if(/sobrevenda|sobrecompra|revers[aã]o/.test(t))mode='reversal'; if(/rompimento|breakout/.test(t))mode='breakout';
 let startHour='00:00',endHour='23:59';
 const m=t.match(/(?:das|de)\s*(\d{1,2})(?:[:h](\d{2}))?.*(?:às|as|até|ate)\s*(\d{1,2})(?:[:h](\d{2}))?/);
 if(m){startHour=String(m[1]).padStart(2,'0')+':'+String(m[2]||'00').padStart(2,'0');endHour=String(m[3]).padStart(2,'0')+':'+String(m[4]||'00').padStart(2,'0')}
 const indicators=detectIndicators(t);
 const explanation=`Robô por voz com múltiplos indicadores: ${indicators.map(x=>x.type.toUpperCase()+(x.period?` ${x.period}`:'')).join(', ')}. Modo: ${mode}.`;
 return{strategy:'voice',startHour,endHour,explanation,voiceStrategy:{mode,indicators}}
}
function VoiceAgent({apply}:any){
 const[text,setText]=useState(''),[parsed,setParsed]=useState<any>(null),[listening,setListening]=useState(false),[creating,setCreating]=useState(false),[created,setCreated]=useState<any>(null),[monitorMsg,setMonitorMsg]=useState(''),[robotName,setRobotName]=useState('Robô Voz');
 const[executionMode,setExecutionMode]=useState('signal'),[whatsapp,setWhatsapp]=useState(''),[sendEntries,setSendEntries]=useState(true),[sendCloses,setSendCloses]=useState(false),[dailyReport,setDailyReport]=useState(false);
 const recRef=useRef<any>(null);
 const indicatorsTxt=parsed?.voiceStrategy?.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')||'Nenhum';
 function start(){const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR){alert('Seu navegador não liberou reconhecimento de voz. Use Chrome/Edge.');return}const rec=new SR();rec.lang='pt-BR';rec.continuous=false;rec.interimResults=false;rec.onresult=(e:any)=>{const tx=e.results[0][0].transcript;setText(tx);const p=parseVoiceToStrategy(tx);setParsed(p);setRobotName(suggestRobotName(tx,p));setCreated(null);setMonitorMsg('');setListening(false)};rec.onerror=()=>setListening(false);rec.onend=()=>setListening(false);recRef.current=rec;setListening(true);rec.start()}
 function suggestRobotName(raw:string,p:any){const t=String(raw||'').toLowerCase();const inds=(p?.voiceStrategy?.indicators||[]).slice(0,3).map((x:any)=>String(x.type||'').toUpperCase()+(x.period?' '+x.period:''));if(inds.length)return 'Robô '+inds.join(' + ');if(t.includes('rompimento'))return 'Robô Rompimento';if(t.includes('revers'))return 'Robô Reversão';return 'Robô Voz'}
 function manual(){const p=parseVoiceToStrategy(text);setParsed(p);setRobotName(suggestRobotName(text,p));setCreated(null);setMonitorMsg('')}
 async function createRobot(){
   if(!parsed){alert('Interprete a estratégia antes de criar o robô.');return}
   setCreating(true);setMonitorMsg('');
   try{
     const name=(robotName||'Robô Voz').trim();
     const payload={...parsed,name,source:'voice-agent',execution:{mode:executionMode,whatsapp,sendEntries,sendCloses,dailyReport,autoTrade:false,createdFromVoice:true},createdAt:new Date().toISOString()};
     const r=await api('/api/strategy/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
     if(!r.ok)throw new Error(r.error||'Falha ao criar robô');
     setCreated(r.strategy);
     setMonitorMsg('Robô criado com sucesso. Ele já aparece em Meus Robôs.');
   }catch(e:any){setMonitorMsg(e.message||'Erro ao criar robô')}
   finally{setCreating(false)}
 }
 async function startMonitor(){
   if(!created?.id){alert('Crie o robô antes de iniciar o monitoramento.');return}
   if(!whatsapp.trim()){alert('Informe o WhatsApp do usuário para receber os sinais.');return}
   setCreating(true);setMonitorMsg('');
   try{
     const r=await api('/api/voice-monitor/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({robotId:created.id,mode:executionMode,whatsapp,sendEntries,sendCloses,dailyReport,robotName:created.name})});
     if(!r.ok)throw new Error(r.error||'Falha ao iniciar monitoramento');
     setMonitorMsg('Monitoramento em modo '+executionMode+' ativado. Primeiro sinal de teste registrado.');
   }catch(e:any){setMonitorMsg(e.message||'Erro ao iniciar monitoramento')}
   finally{setCreating(false)}
 }
 async function sendTest(){
   if(!whatsapp.trim()){alert('Informe o WhatsApp do usuário.');return}
   setCreating(true);setMonitorMsg('');
   try{
     const r=await api('/api/whatsapp/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({whatsapp,robotName:created?.name||robotName||'Robô por Voz',mode:executionMode,indicators:indicatorsTxt})});
     if(!r.ok)throw new Error(r.error||'Falha ao gerar alerta');
     setMonitorMsg(r.sent?'Alerta enviado pelo WhatsApp.':'Alerta salvo na fila, mas não enviado. Configure Evolution API no backend para envio real.');
   }catch(e:any){setMonitorMsg(e.message||'Erro no teste')}
   finally{setCreating(false)}
 }
 return <div className="panel voiceBox"><h2>Agente de Voz</h2><p>Exemplo: “Crie uma estratégia com EMA das 8 às 18” ou “usar RSI das 9 às 12”.</p><div className="voiceControls"><button onClick={start}>{listening?<MicOff/>:<Mic/>} {listening?'Ouvindo...':'Falar estratégia'}</button><button onClick={manual}>Interpretar texto</button></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Digite ou fale a estratégia aqui..."/>{parsed&&<div className="voiceWorkflow"><div className="parsed"><b>Estratégia detectada:</b> {robotName||'Robô por Voz'}<br/><b>Indicadores:</b> {indicatorsTxt}<br/><b>Horário:</b> {parsed.startHour} até {parsed.endHour}<br/><b>Modo:</b> {parsed.voiceStrategy?.mode}<br/><p>{parsed.explanation}</p></div><div className="voiceSummary"><h3>Resumo antes de criar</h3><label>Nome do robô<input value={robotName} onChange={e=>setRobotName(e.target.value)} placeholder="Ex.: Robô EMA RSI M5"/></label><div className="summaryGrid"><div><span>Nome definido</span><b>{robotName||'Robô Voz'}</b></div><div><span>Indicadores</span><b>{parsed.voiceStrategy?.indicators?.length||0}</b></div><div><span>Execução</span><b>{executionMode==='signal'?'Apenas sinal':executionMode==='test'?'Teste':executionMode==='demo'?'Demo':'Real'}</b></div><div><span>WhatsApp</span><b>{whatsapp||'não informado'}</b></div></div></div><div className="executionBox"><h3>Modo de execução</h3><div className="modeGrid"><label><input type="radio" checked={executionMode==='signal'} onChange={()=>setExecutionMode('signal')}/> Apenas sinal</label><label><input type="radio" checked={executionMode==='test'} onChange={()=>setExecutionMode('test')}/> Teste com WhatsApp</label><label><input type="radio" checked={executionMode==='demo'} onChange={()=>setExecutionMode('demo')}/> Demo</label><label className="disabledMode"><input type="radio" disabled checked={executionMode==='real'} onChange={()=>setExecutionMode('real')}/> Real <small>em preparação</small></label></div><label>WhatsApp do usuário<input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="+55 32 99999-9999"/></label><div className="checkGrid"><label><input type="checkbox" checked={sendEntries} onChange={e=>setSendEntries(e.target.checked)}/> Enviar entradas</label><label><input type="checkbox" checked={sendCloses} onChange={e=>setSendCloses(e.target.checked)}/> Enviar encerramentos</label><label><input type="checkbox" checked={dailyReport} onChange={e=>setDailyReport(e.target.checked)}/> Relatório diário</label></div><p className="muted">Conta real fica bloqueada nesta versão. Primeiro use sinal/teste/demo e valide os resultados.</p></div><div className="actionsRow"><button disabled={creating} onClick={createRobot}>{creating?'Aguarde...':'Criar Robô'}</button><button disabled={creating} onClick={()=>apply(parsed)}>Abrir no Criar Robô</button><button disabled={creating||!created} onClick={startMonitor}>Iniciar Monitoramento</button><button disabled={creating} className="secondaryBtn" onClick={sendTest}>Enviar alerta teste</button></div>{created&&<p className="ok">Robô criado: {created.name}</p>}{monitorMsg&&<p className={monitorMsg.includes('Erro')||monitorMsg.includes('Falha')?'warn':'ok'}>{monitorMsg}</p>}</div>}</div>}


function WalletMini({indicatorCount=0,setPage}:any){
 const [info,setInfo]=useState<any>(null),[msg,setMsg]=useState('');
 async function load(){try{setInfo(await api('/api/profile'))}catch(e:any){setMsg(String(e.message||e))}}
 useEffect(()=>{load()},[]);
 const pr=info?.pricing||{};
 const n=Math.max(1,Number(indicatorCount||0));
 const create=(pr.createRobotPerIndicator||0)*n;
 const backtest=(pr.backtestPerIndicator||0)*n;
 const opt=(pr.optimizerPerIndicator||0)*n;
 const saldo=Number(info?.wallet?.balance||0);
 const freeCreate=info?.wallet?.freeRobotUsed===false;
 const freeBacktest=info?.wallet?.freeBacktestUsed===false;
 // Enquanto o perfil não chega, os preços vinham como R$ 0,00 — dizia que a otimização era grátis.
 const carregando=!info;
 return <div className="billingMini">
  <div className="billingHead"><div><b>Créditos e custo estimado</b><span>{n} indicador(es) no robô</span></div><strong>Saldo: {carregando?'...':money(saldo)}</strong></div>
  <div className="billingCostGrid">
   <div><span>Salvar/criar robô</span><b>{carregando?'...':freeCreate?'Grátis (1ª vez)':money(create)}</b></div>
   <div><span>Backtest</span><b>{carregando?'...':freeBacktest?'Grátis (1ª vez)':money(backtest)}</b></div>
   <div><span>Otimização</span><b>{carregando?'...':money(opt)}</b></div>
  </div>
  {!carregando&&!freeCreate&&saldo<create&&<p className="warn">Saldo insuficiente para salvar este robô. Recarregue no Perfil antes de continuar.</p>}
  <div className="quickCredit"><button onClick={()=>setPage&&setPage('perfil')}>Recarregar no Perfil</button></div>
  {msg&&<p className="warn">{msg}</p>}
 </div>
}

function RobotBuilder({datasets,selected,setPage,setSelected,setVoiceConfig,voiceConfig}:any){
 const [name,setName]=useState('Robo_EMA_RSI');
 const [datasetId,setDatasetId]=useState(selected);
 const [indicators,setIndicators]=useState<any[]>([{type:'ema',period:20},{type:'rsi',period:14}]);
 const [mode,setMode]=useState('trend');
 const [filters,setFilters]=useState<any>({startHour:'00:00',endHour:'23:59'});
 const [saved,setSaved]=useState<any>(null); const [loading,setLoading]=useState(false); const [loadingText,setLoadingText]=useState('Processando...'); const [error,setError]=useState(''); const [errorPerfil,setErrorPerfil]=useState(false);
 function addIndicator(){setIndicators([...indicators,{type:'ema',period:20}])}
 // O período fica como texto enquanto o usuário digita: converter na hora fazia ''→0→||14, travando o campo em 14.
 function updateIndicator(i:number,k:string,v:any){const arr=[...indicators];arr[i]={...arr[i],[k]:v};setIndicators(arr)}
 function blurIndicator(i:number){const arr=[...indicators];const n=Math.max(1,Math.round(Number(arr[i]?.period)||14));arr[i]={...arr[i],period:n};setIndicators(arr)}
 function removeIndicator(i:number){setIndicators(indicators.filter((_,idx)=>idx!==i))}
 // period pode estar como string enquanto o campo está em edição — normaliza antes de mandar pro backend.
 const voiceStrategy={mode,indicators:indicators.map((x:any)=>({...x,period:Math.max(1,Math.round(Number(x.period)||14))}))};
 useEffect(()=>{if(voiceConfig?.voiceStrategy){setIndicators(voiceConfig.voiceStrategy.indicators||indicators);setMode(voiceConfig.voiceStrategy.mode||'trend');setFilters((f:any)=>({...f,startHour:voiceConfig.startHour||f.startHour,endHour:voiceConfig.endHour||f.endHour}))}},[voiceConfig]);
useEffect(()=>{loadCurrentRobot()},[]);
async function loadCurrentRobot(){
 try{
   const r=await api('/api/robots/current');
   if(r?.currentRobot){
     const j=r.currentRobot.json||{};
     const payload={id:r.currentRobot.id,name:j.name||r.currentRobot.name,voiceStrategy:j.voiceStrategy||{mode:'trend',indicators:[]},filters:j.filters||{startHour:'00:00',endHour:'23:59'},raw:j};
     setName(payload.name||name);
     setIndicators(payload.voiceStrategy.indicators&&payload.voiceStrategy.indicators.length?payload.voiceStrategy.indicators:indicators);
     setMode(payload.voiceStrategy.mode||'trend');
     setFilters((f:any)=>({...f,startHour:payload.filters.startHour||f.startHour,endHour:payload.filters.endHour||f.endHour}));
   }
 }catch(e){}
}

 const strategyPayload={name,voiceStrategy,filters,strategy:'voice'};
 async function save(){
   setError(''); setErrorPerfil(false); setLoading(true); setLoadingText('Salvando robô...');
   try{
     const r=await api('/api/strategy/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(strategyPayload)});
     if(!r.ok) throw new Error(r.error||'Falha ao salvar');
     setSaved(r.strategy);
     alert('Robô salvo com sucesso. Acesse Meus Robôs.');
   }catch(e:any){const info=billingErrorInfo(e);setError(info.message);setErrorPerfil(info.needsPerfil)}
   finally{setLoading(false)}
 }
 function applyBacktest(){setLoading(true);setLoadingText('Enviando estratégia para o Backtest...');setVoiceConfig({strategy:'voice',voiceStrategy,startHour:filters.startHour,endHour:filters.endHour});setSelected(datasetId);setTimeout(()=>{setLoading(false);setPage('lab')},400)}
 async function exportMt5(){
   setError(''); setLoading(true); setLoadingText('Gerando arquivo MT5...');
   try{
     const res=await fetch('/api/robot/export-mt5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(strategyPayload)});
     if(!res.ok){let msg='Falha ao gerar MQ5';try{const j=await res.json();msg=j.error||msg}catch{} throw new Error(msg)}
     const blob=await res.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a');
     a.href=url; a.download=(name||'ForexIA_Robo')+'.mq5'; a.click(); URL.revokeObjectURL(url);
   }catch(e:any){setError(e.message||'Erro ao gerar MT5')}
   finally{setLoading(false)}
 }
 return <section><LoadingOverlay show={loading} text={loadingText}/><h1>Criar Robô</h1><div className="panel"><h2>Modo de criação</h2><p>Monte manualmente pelos indicadores ou use a aba Agente de Voz para preencher automaticamente.</p><div className="grid"><label>Nome do robô<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Dataset para backtest<select value={datasetId} onChange={e=>setDatasetId(e.target.value)}>{datasets.map((d:DS)=><option key={d.id} value={d.id}>{d.pair} {d.timeframe} - {br(d.count)}</option>)}</select></label><label>Modo<select value={mode} onChange={e=>setMode(e.target.value)}><option value="trend">Tendência</option><option value="reversal">Reversão</option><option value="breakout">Rompimento</option></select></label><label>Hora inicial<input type="time" value={filters.startHour} onChange={e=>setFilters({...filters,startHour:e.target.value})}/></label><label>Hora final<input type="time" value={filters.endHour} onChange={e=>setFilters({...filters,endHour:e.target.value})}/></label></div></div>
 <div className="panel"><h2>Indicadores do robô</h2>{indicators.map((ind:any,i:number)=><div className="indicatorRow" key={i}><select value={ind.type} onChange={e=>updateIndicator(i,'type',e.target.value)}><optgroup label="Tendência"><option value="ema">EMA</option><option value="sma">SMA</option><option value="wma">WMA</option><option value="hma">HMA</option><option value="vwap">VWAP</option><option value="supertrend">SuperTrend</option><option value="ichimoku">Ichimoku</option><option value="alligator">Alligator</option><option value="adx">ADX</option></optgroup><optgroup label="Momentum"><option value="rsi">RSI</option><option value="macd">MACD</option><option value="stochastic">Stochastic</option><option value="cci">CCI</option><option value="roc">ROC</option><option value="momentum">Momentum</option><option value="williams">Williams %R</option></optgroup><optgroup label="Volatilidade"><option value="atr">ATR</option><option value="bollinger">Bollinger Bands</option><option value="keltner">Keltner</option><option value="donchian">Donchian</option></optgroup><optgroup label="Volume"><option value="obv">OBV</option><option value="mfi">MFI</option><option value="volume profile">Volume Profile</option></optgroup><optgroup label="Preço"><option value="suporte">Suporte</option><option value="resistência">Resistência</option><option value="rompimento">Rompimento</option><option value="pullback">Pullback</option><option value="candlestick">Candlestick</option></optgroup></select><input type="number" min={1} aria-label={'Período do indicador '+(i+1)} value={ind.period??''} onChange={e=>updateIndicator(i,'period',e.target.value)} onBlur={()=>blurIndicator(i)} /><button onClick={()=>removeIndicator(i)}>Remover</button></div>)}<button onClick={addIndicator}>+ Adicionar indicador</button><div className="costInline"><h2>Custo antes de continuar</h2><WalletMini indicatorCount={indicators.length} setPage={setPage}/><p className="muted">O valor é atualizado automaticamente conforme os indicadores são adicionados ou removidos.</p></div><div className="actionsRow"><button disabled={loading} onClick={save}>{loading?'Aguarde...':'Salvar Estratégia'}</button><button disabled={loading} onClick={applyBacktest}>Fazer Backtest na Plataforma</button><button disabled={loading} onClick={exportMt5}>Gerar Arquivo MT5 (.mq5)</button></div>{error&&<p className="warn">{error} {errorPerfil&&<button className="secondaryBtn" onClick={()=>setPage('perfil')}>Ir para o Perfil</button>}</p>}{saved&&<p className="ok">Estratégia salva: {saved.name}</p>}</div></section>
}

function RobotSelector({selectedRobot,setSelectedRobot,setStrategy,setVoiceStrategy,setFilters}:any){
 const[robots,setRobots]=useState<any[]>([]),[id,setId]=useState('');
 async function load(){const r=await api('/api/robots');setRobots(r);const cur=await api('/api/robots/current');if(cur?.currentRobot){setId(cur.currentRobot.id)}}
 useEffect(()=>{load()},[]);
 async function choose(v:string){
   setId(v);
   const r=robots.find(x=>x.id===v);
   await fetch('/api/robots/current',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:v})});
   if(r){
     const j=r.json||{};
     const payload={id:r.id,name:j.name||r.name,voiceStrategy:j.voiceStrategy||{mode:'trend',indicators:[]},filters:j.filters||{startHour:'00:00',endHour:'23:59'},raw:j};
     setSelectedRobot(payload);setStrategy('voice');setVoiceStrategy(payload.voiceStrategy);
     setFilters((f:any)=>({...f,startHour:payload.filters.startHour||f.startHour,endHour:payload.filters.endHour||f.endHour}));
   }
 }
 return <div className="robotSelectBox"><label>Robô salvo para backtest<select value={id} onChange={e=>choose(e.target.value)}><option value="">Escolha um robô salvo...</option>{(robots||[]).map((r:any)=><option key={r.id} value={r.id}>{r.name||r.json?.name||'Robô sem nome'}</option>)}</select></label>{selectedRobot&&<button onClick={()=>{setSelectedRobot(null);setVoiceStrategy(null);setStrategy('ema');fetch('/api/robots/clear-current',{method:'POST'});setId('')}}>Limpar robô</button>}</div>
}

function BacktestLab({datasets,selected,voiceConfig,setVoiceConfig,selectedRobot,setSelectedRobot,setPage}:any){const[id,setId]=useState(selected),[strategy,setStrategy]=useState('ema'),[result,setResult]=useState<any>(null);const[filters,setFilters]=useState<any>({startDate:'',endDate:'',startHour:'00:00',endHour:'23:59',weekdays:[1,2,3,4,5]});const[expiration,setExpiration]=useState(1),[payout,setPayout]=useState(.85),[stake,setStake]=useState(1),[initial,setInitial]=useState(100),[voiceStrategy,setVoiceStrategy]=useState<any>(null);const[robots,setRobots]=useState<any[]>([]),[robotId,setRobotId]=useState(''),[showAdvanced,setShowAdvanced]=useState(false);const{meta,preview}=useDatasetMeta(id,filters);
 useEffect(()=>{if(selected)setId(selected)},[selected]);useEffect(()=>{loadRobotsForLab()},[]);
async function loadRobotsForLab(){
 try{
  const list=await api('/api/robots');
  setRobots(Array.isArray(list)?list:[]);
  const cur=await api('/api/robots/current');
  if(cur?.currentRobot) applyRobotToLab(cur.currentRobot,false);
 }catch(e){console.log('erro robots',e)}
}
async function applyRobotToLab(robot:any,persist=true){
 const j=robot.json||{};
 const payload={id:robot.id,name:j.name||robot.name,voiceStrategy:j.voiceStrategy||{mode:'trend',indicators:[]},filters:j.filters||{startHour:'00:00',endHour:'23:59'},raw:j};
 if(persist) await fetch('/api/robots/current',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:robot.id})});
 const best=(datasets||[]).find((d:any)=>String(d.pair||'').includes('EURUSD')&&String(d.timeframe||'')==='M5') || (datasets||[]).find((d:any)=>String(d.timeframe||'')==='M5') || datasets?.[0];
 if(best) setId(best.id);
 setSelectedRobot(payload);setRobotId(robot.id);setStrategy('voice');setVoiceStrategy(payload.voiceStrategy);
 setFilters((f:any)=>({...f,startHour:payload.filters.startHour||f.startHour,endHour:payload.filters.endHour||f.endHour}));
 setResult(null); setShowAdvanced(false);
}
useEffect(()=>{if(meta?.firstDate&&meta?.lastDate&&!filters.startDate&&!filters.endDate)setFilters((f:any)=>({...f,startDate:meta.firstDate,endDate:meta.lastDate}))},[meta]);useEffect(()=>{
 if(voiceConfig){
   setStrategy('voice');
   setVoiceStrategy(voiceConfig.voiceStrategy||null);
   setFilters((f:any)=>({...f,startHour:voiceConfig.startHour||f.startHour,endHour:voiceConfig.endHour||f.endHour}));
   setVoiceConfig(null);
 }
},[voiceConfig]);
 function setQuick(days:number){if(!meta?.lastDate)return;const end=new Date(meta.lastDate+'T00:00:00');const start=new Date(end.getTime()-days*86400000);setFilters({...filters,startDate:start.toISOString().slice(0,10),endDate:meta.lastDate})}
 async function run(){if(preview&&preview.count===0){alert('O filtro deixou 0 candles. Ajuste data ou horário.');return}
  // Sem isto o botão "Executar Backtest do Robô" rodava a estratégia padrão (EMA Cross) quando
  // nenhum robô estava selecionado: o usuário pagava e recebia o teste de outra estratégia.
  if(strategy==='voice'&&!(voiceStrategy?.indicators?.length)){setBtError('Selecione um robô salvo antes de rodar o backtest — nenhum robô está carregado.');setBtErrorPerfil(false);return}
  // O botão dizia "do Robô" mesmo com a estratégia embutida escolhida: o usuário pagava achando
  // que testou o robô dele. Confirma antes de gastar o backtest com outra coisa.
  if(strategy!=='voice'&&!confirm('Nenhum robô salvo está selecionado.\n\nO teste vai rodar a estratégia embutida "'+({ema:'EMA Cross',rsi:'RSI',macd:'MACD'} as any)[strategy]+'" e será cobrado normalmente.\n\nDeseja continuar assim mesmo?')) return;
  setBtLoading(true);setBtError('');setBtErrorPerfil(false);try{const bt=await api('/api/backtest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({datasetId:id,strategy,voiceStrategy,expiration,payout,stake,initial,filters})}); setResult(bt); if(selectedRobot?.id&&bt?.result?.trades){await fetch('/api/validation/platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:selectedRobot.id,robotId:selectedRobot.id,trades:bt.result.trades})})}}catch(e:any){const info=billingErrorInfo(e);setBtError(info.message);setBtErrorPerfil(info.needsPerfil)}finally{setBtLoading(false)}}
 const[btLoading,setBtLoading]=useState(false);const[btError,setBtError]=useState('');const[btErrorPerfil,setBtErrorPerfil]=useState(false);const m=result?.result?.metrics;const diag=result?.result?.diagnostic;
 return <section><LoadingOverlay show={btLoading} text="🤖 Inteligência Artificial executando o backtest..."/><h1>Backtest Lab Inteligente</h1><div className="panel">{selectedRobot&&<div className='parsed robotLoaded'><b>Robô carregado:</b> {selectedRobot.name}<br/><b>Indicadores:</b> {selectedRobot.voiceStrategy?.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')}<br/><b>Modo:</b> {selectedRobot.voiceStrategy?.mode}</div>}{meta&&<div className="datasetInfo"><b>Período disponível:</b> {meta.first} → {meta.last} • <b>{br(meta.count)}</b> candles</div>}{selectedRobot?
 <>
 <div className="robotTestSummary">
   <div><span>Robô</span><b>{selectedRobot.name}</b></div>
   <div><span>Dataset usado</span><b>{datasets.find((d:DS)=>d.id===id)?.pair} {datasets.find((d:DS)=>d.id===id)?.timeframe} - {br(datasets.find((d:DS)=>d.id===id)?.count||0)} candles</b></div>
   <div><span>Indicadores</span><b>{selectedRobot.voiceStrategy?.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')}</b></div>
   <div><span>Modo</span><b>{selectedRobot.voiceStrategy?.mode||'trend'}</b></div>
 </div>
 <button className="secondaryBtn" onClick={()=>setShowAdvanced(!showAdvanced)}>{showAdvanced?'Ocultar dados do teste':'Alterar dados/período do teste'}</button>
 {showAdvanced&&<div className="grid advancedBox">
   <label>Dataset<select value={id} onChange={e=>{setId(e.target.value);setResult(null);setFilters({...filters,startDate:'',endDate:''})}}>{datasets.map((d:DS)=><option key={d.id} value={d.id}>{d.pair} {d.timeframe} - {br(d.count)}</option>)}</select></label>
   <label>Expiração<input type="number" value={expiration} onChange={e=>setExpiration(+e.target.value)}/></label>
   <label>Payout<input type="number" step="0.01" value={payout} onChange={e=>setPayout(+e.target.value)}/></label>
   <label>Entrada<input type="number" value={stake} onChange={e=>setStake(+e.target.value)}/></label>
   <label>Saldo inicial<input type="number" value={initial} onChange={e=>setInitial(+e.target.value)}/></label>
 </div>}
 </>
 :
 <div className="grid"><label>Dataset<select value={id} onChange={e=>{setId(e.target.value);setResult(null);setFilters({...filters,startDate:'',endDate:''})}}>{datasets.map((d:DS)=><option key={d.id} value={d.id}>{d.pair} {d.timeframe} - {br(d.count)}</option>)}</select></label><label>Estratégia<select value={strategy} onChange={e=>{setStrategy(e.target.value);if(e.target.value!=='voice'){setSelectedRobot(null);setVoiceStrategy(null);setRobotId('')}}}><option value="ema">EMA Cross</option><option value="rsi">RSI</option><option value="mhi">MHI</option><option value="voice">Robô salvo / Voz</option></select></label><label>Robô salvo<select value={robotId} onChange={e=>{const r=robots.find((x:any)=>x.id===e.target.value);if(r)applyRobotToLab(r,true)}}><option value="">Selecione...</option>{(robots||[]).map((r:any)=><option key={r.id} value={r.id}>{r.name||r.json?.name||'Robô sem nome'}</option>)}</select></label><label>Expiração<input type="number" value={expiration} onChange={e=>setExpiration(+e.target.value)}/></label><label>Payout<input type="number" step="0.01" value={payout} onChange={e=>setPayout(+e.target.value)}/></label><label>Entrada<input type="number" value={stake} onChange={e=>setStake(+e.target.value)}/></label><label>Saldo inicial<input type="number" value={initial} onChange={e=>setInitial(+e.target.value)}/></label></div>
}<h2>Período</h2><div className="quickBtns"><button onClick={()=>setQuick(30)}>Últimos 30 dias</button><button onClick={()=>setQuick(90)}>3 meses</button><button onClick={()=>setQuick(180)}>6 meses</button><button onClick={()=>setQuick(365)}>1 ano</button><button onClick={()=>meta&&setFilters({...filters,startDate:meta.firstDate,endDate:meta.lastDate})}>Todo período</button></div><div className="grid"><label>Data inicial<input type="date" min={meta?.firstDate||''} max={meta?.lastDate||''} value={filters.startDate} onChange={e=>setFilters({...filters,startDate:e.target.value})}/></label><label>Data final<input type="date" min={meta?.firstDate||''} max={meta?.lastDate||''} value={filters.endDate} onChange={e=>setFilters({...filters,endDate:e.target.value})}/></label><label>Hora inicial<input type="time" value={filters.startHour} onChange={e=>setFilters({...filters,startHour:e.target.value})}/></label><label>Hora final<input type="time" value={filters.endHour} onChange={e=>setFilters({...filters,endHour:e.target.value})}/></label></div>{voiceStrategy&&<div className='parsed'><b>Robô carregado no Backtest:</b> {voiceStrategy.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')} • modo {voiceStrategy.mode}</div>}{preview&&<div className={preview.ok?'preview ok':'preview warn'}>Prévia: {br(preview.afterFilters)} candles após filtros de {br(preview.total)} totais.</div>}<button disabled={btLoading || (preview&&preview.count===0)} onClick={run}>{btLoading?'Executando...':(strategy==='voice'?(voiceStrategy?.indicators?.length?'Executar Backtest do Robô':'Selecione um robô para testar'):'Executar Backtest (estratégia embutida)')}</button>{btError&&<p className="warn">{btError} {btErrorPerfil&&<button className="secondaryBtn" onClick={()=>setPage&&setPage('perfil')}>Ir para o Perfil</button>}</p>}</div>
 {m&&<><div className="panel"><div className="score">{m.score}/100</div>{diag&&<p className={m.total>0?'ok':'warn'}><b>Diagnóstico:</b> {diag.reason} • Candles totais: {br(diag.totalCandles)} • Após filtros: {br(diag.candlesAfterFilters)}</p>}<div className="metric"><Metric name="Saldo" value={money(m.balance)}/><Metric name="Lucro" value={money(m.profit)}/><Metric name="Win" value={m.winRate+'%'}/><Metric name="Trades" value={m.total}/><Metric name="Drawdown" value={m.drawdown+'%'}/><Metric name="Profit Factor" value={m.profitFactor}/><Metric name="Payoff" value={m.payoff}/><Metric name="Expectancy" value={m.expectancy}/><Metric name="Média Gain" value={money(m.avgWin)}/><Metric name="Média Loss" value={money(m.avgLoss)}/><Metric name="Seq. Wins" value={m.maxWinSeq}/><Metric name="Seq. Loss" value={m.maxLossSeq}/></div></div><div className="panel"><div className='validationBox'><h3>Validação MT5</h3><p>As operações deste backtest são salvas para comparação. Gere o MQ5, rode no MetaTrader e abra a aba <b>Validação MT5</b>.</p><p><b>Run ID:</b> {selectedRobot?.id||'manual'} • <b>Operações na plataforma:</b> {result?.trades?.length||result?.result?.trades?.length||0}</p></div><h2>Curva de Patrimônio</h2><Line values={result.result.equity}/></div><div className="panel"><h2>Candles com Operações</h2><CandleChart candles={result.result.chartCandles||[]} trades={result.result.trades||[]}/></div><div className="panel"><h2>Lucro por Dia</h2><BarChart rows={result.result.daily}/></div><div className="panel"><h2>Lucro por Mês</h2><BarChart rows={result.result.monthly}/></div><div className="panel"><h2>Lucro por Horário</h2><BarChart rows={result.result.hourly}/></div><div className="panel"><h2>Heatmap Dia da Semana</h2><BarChart rows={result.result.weekday}/></div></>}</section>}
function VoicePage({apply}:any){return <section><h1>Agente de Voz</h1><VoiceAgent apply={apply}/><div className="panel"><h2>Comandos aceitos nesta versão</h2><p>“Faça um robô com EMA 20, RSI 14, MACD e Bollinger”<br/>“Criar estratégia com SuperTrend, ADX, ATR e rompimento das 8 às 18”<br/>“Robô de reversão com Bollinger, Estocástico, Williams %R e suporte”</p></div></section>}



function RobotCompare({datasets,setPage,setSelected,setVoiceConfig,setSelectedRobot}:any){
 const[robots,setRobots]=useState<any[]>([]),[picked,setPicked]=useState<string[]>([]),[running,setRunning]=useState(false),[results,setResults]=useState<any[]>([]);
 const[datasetId,setDatasetId]=useState(''),[filters,setFilters]=useState<any>({startDate:'',endDate:'',startHour:'00:00',endHour:'23:59'});
 useEffect(()=>{api('/api/robots').then((r:any[])=>{setRobots(r||[])});},[]);
 useEffect(()=>{const best=(datasets||[]).find((d:any)=>String(d.pair||'').includes('EURUSD')&&String(d.timeframe||'')==='M5') || (datasets||[]).find((d:any)=>String(d.timeframe||'')==='M5') || datasets?.[0]; if(best&&!datasetId)setDatasetId(best.id)},[datasets]);
 function toggle(id:string){setPicked(picked.includes(id)?picked.filter(x=>x!==id):[...picked,id])}
 async function runCompare(){
   if(picked.length<2){alert('Selecione pelo menos dois robôs.');return}
   if(!datasetId){alert('Nenhum dataset disponível.');return}
   setRunning(true);setResults([]);
   const out:any[]=[];
   for(const id of picked){
     const r=robots.find(x=>x.id===id); if(!r)continue;
     const j=r.json||{};
     const payload={datasetId,strategy:'voice',voiceStrategy:j.voiceStrategy||{mode:'trend',indicators:[]},expiration:1,payout:.85,stake:1,initial:100,filters:{...filters,startHour:j.filters?.startHour||filters.startHour,endHour:j.filters?.endHour||filters.endHour}};
     try{
       const bt=await api('/api/backtest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
       out.push({robot:r,result:bt?.result});
       setResults([...out]);
     }catch(e:any){out.push({robot:r,error:e.message});setResults([...out])}
   }
   setRunning(false);
 }
 async function openLab(r:any){
  const j=r.json||{};
  await fetch('/api/robots/current',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id})});
  setSelectedRobot({id:r.id,name:j.name||r.name,voiceStrategy:j.voiceStrategy||{mode:'trend',indicators:[]},filters:j.filters||{},raw:j});
  setVoiceConfig({strategy:'voice',voiceStrategy:j.voiceStrategy||{mode:'trend',indicators:[]},startHour:j.filters?.startHour||'00:00',endHour:j.filters?.endHour||'23:59',robotName:j.name||r.name});
  setSelected(datasetId); setPage('lab');
 }
 return <section><h1>Comparar Robôs</h1>
 <div className="panel"><h2>1. Escolha os robôs</h2>{robots.length===0&&<p>Nenhum robô salvo.</p>}{(robots||[]).map((r:any)=><div className="robotItem" key={r.id}><div><label><input type="checkbox" checked={picked.includes(r.id)} onChange={()=>toggle(r.id)}/> <b>{r.name}</b></label><p>{r.json?.voiceStrategy?.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')}</p></div></div>)}</div>
 <div className="panel"><h2>2. Configuração do comparativo</h2><p className='muted'>Use os mesmos dados do teste individual para comparar resultados iguais. A diferença normalmente vem de dataset, período, horário ou expiração diferentes.</p><div className="grid"><label>Dataset<select value={datasetId} onChange={e=>setDatasetId(e.target.value)}>{datasets.map((d:DS)=><option key={d.id} value={d.id}>{d.pair} {d.timeframe} - {br(d.count)}</option>)}</select></label><label>Data inicial<input value={filters.startDate} onChange={e=>setFilters({...filters,startDate:e.target.value})} placeholder="dd/mm/aaaa"/></label><label>Data final<input value={filters.endDate} onChange={e=>setFilters({...filters,endDate:e.target.value})} placeholder="dd/mm/aaaa"/></label><label>Hora inicial<input value={filters.startHour} onChange={e=>setFilters({...filters,startHour:e.target.value})}/></label><label>Hora final<input value={filters.endHour} onChange={e=>setFilters({...filters,endHour:e.target.value})}/></label></div><button disabled={running||picked.length<2} onClick={runCompare}>{running?'Testando robôs...':'Testar robôs selecionados'}</button></div>
 {results.length>0&&<div className="panel"><h2>Resultado comparativo</h2><div className='testAudit'><b>Configuração do comparativo</b><br/>Dataset: {datasets.find((d:DS)=>d.id===datasetId)?.pair} {datasets.find((d:DS)=>d.id===datasetId)?.timeframe} • Período: {filters.startDate||'início'} até {filters.endDate||'fim'} • Horário: {filters.startHour}–{filters.endHour} • Payout: 0,85 • Entrada: 1</div><div className="compareTable"><div className="head">Robô</div><div className="head">Score</div><div className="head">Lucro</div><div className="head">Win</div><div className="head">Trades</div><div className="head">DD</div><div className="head">PF</div><div className="head">Ação</div>{results.map((x:any)=><React.Fragment key={x.robot.id}><div><b>{x.robot.name}</b></div><div>{x.result?.metrics?.score??'-'}/100</div><div>{money(x.result?.metrics?.profit||0)}</div><div>{(x.result?.metrics?.winRate||0).toFixed(2)}%</div><div>{x.result?.metrics?.trades||0}</div><div>{(x.result?.metrics?.drawdown||0).toFixed(2)}%</div><div>{x.result?.metrics?.profitFactor||0}</div><div><button onClick={()=>openLab(x.robot)}>Abrir</button></div></React.Fragment>)}</div></div>}
 </section>
}

function ForwardTesting(){
 const[robots,setRobots]=useState<any[]>([]),[robotId,setRobotId]=useState(''),[asset,setAsset]=useState('EURUSD'),[period,setPeriod]=useState('30 dias'),[closingTime,setClosingTime]=useState('18:00'),[whatsappNumber,setWhatsappNumber]=useState(''),[loading,setLoading]=useState(false),[msg,setMsg]=useState(''),[simulation,setSimulation]=useState<any>(null);
 useEffect(()=>{api('/api/robots').then((r:any[])=>{setRobots(r||[]);if(r?.[0])setRobotId(r[0].id)}).catch((e:any)=>setMsg(String(e.message||e)))},[]);
 async function submit(e:any){
  e.preventDefault();setLoading(true);setMsg('');setSimulation(null);
  try{
   // v1.2: cria a simulação local; MT5 enviará os resultados depois.
   const r=await api('/api/forward/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({robotId,asset,period,closingTime,whatsappNumber})});
   setSimulation(r.simulation);setMsg('Forward Testing criado com sucesso.');
  }catch(e:any){setMsg(e.message||'Erro ao criar Forward Testing')}
  finally{setLoading(false)}
 }
 return <section><h1>Forward Testing</h1><div className="panel"><h2>Nova simulação v1.2</h2><p className="muted">Configure o teste em tempo real. Nesta etapa, apenas salvamos a simulação e preparamos o alerta diário via WhatsApp.</p><form onSubmit={submit}><div className="grid"><label>Robô<select value={robotId} onChange={e=>setRobotId(e.target.value)}><option value="">Selecione...</option>{robots.map((r:any)=><option key={r.id} value={r.id}>{r.name||r.json?.name||'Robô sem nome'}</option>)}</select></label><label>Ativo<input value={asset} onChange={e=>setAsset(e.target.value)} placeholder="WIN, WDO, EURUSD"/></label><label>Período<input value={period} onChange={e=>setPeriod(e.target.value)} placeholder="30 dias"/></label><label>Horário de Fechamento do Relatório<input type="time" value={closingTime} onChange={e=>setClosingTime(e.target.value)}/></label><label>WhatsApp<input value={whatsappNumber} onChange={e=>setWhatsappNumber(e.target.value)} placeholder="+55 32 99999-9999"/></label></div><button disabled={loading||!robotId}>{loading?'Criando...':'Criar Forward Test'}</button></form>{msg&&<p className={simulation?'ok':'warn'}>{msg}</p>}{simulation&&<div className="parsed"><b>Simulação criada</b><br/>ID: <code>{simulation.simulacao_id}</code><br/>Ativo: {simulation.asset} • Período: {simulation.period} • Fechamento: {simulation.closingTime}<br/>WhatsApp: {simulation.whatsappNumber}</div>}</div></section>
}





function ValidationWizard(){
  return <div className="panel">
    <h2>🤖 Assistente de Validação MT5</h2>
    <p><b>Passo 1:</b> clique em <b>MQ5 Validação</b> em Meus Robôs.</p>
    <p><b>Passo 2:</b> copie o arquivo para <code>MQL5\Experts</code> e compile no MetaEditor.</p>
    <p><b>Passo 3:</b> no MT5, libere WebRequest para <code>http://127.0.0.1:3001</code>.</p>
    <p><b>Passo 4:</b> execute o teste no MetaTrader.</p>
    <p><b>Passo 5:</b> volte aqui e clique em <b>Carregar comparação</b>.</p>
    <div className="loadingCard">
      <div className="robotFace mini"><div className="eyes"><i></i><i></i></div><b>IA</b></div>
      <div><b>IA aguardando operações do MetaTrader...</b><br/>Quando o MT5 enviar sinais, a comparação será atualizada.</div>
    </div>
  </div>
}

function ValidationChecklist({robotId}:any){
 const[data,setData]=useState<any>(null);
 useEffect(()=>{if(robotId)api('/api/validation/checklist/'+robotId).then(setData).catch((e:any)=>setData({ok:false,error:String(e),checks:[],config:null}))},[robotId]);
 if(!robotId)return null;
 if(!data)return <div className="panel"><h2>Checklist de igualdade Web x MT5</h2><p>🤖 IA carregando checklist...</p></div>;
 const cfg=data.config||{name:'Robô',mode:'-',indicators:[],execution:{entryTiming:'-',expirationCandles:1,payout:0,stake:0}};
 return <>
  <div className="panel">
   <h2>🤖 Assistente de Validação MT5</h2>
   <p><b>Passo 1:</b> clique em <b>MQ5 Validação</b> em Meus Robôs.</p>
   <p><b>Passo 2:</b> copie o arquivo para <code>MQL5\\Experts</code> e compile no MetaEditor.</p>
   <p><b>Passo 3:</b> no MT5, libere WebRequest para <code>http://127.0.0.1:3001</code>.</p>
   <p><b>Passo 4:</b> execute o teste no MetaTrader.</p>
   <p><b>Passo 5:</b> volte aqui e clique em <b>Carregar comparação</b>.</p>
   <div className="loadingCard">
    <div className="robotFace mini"><div className="eyes"><i></i><i></i></div><b>IA</b></div>
    <div><b>IA aguardando operações do MetaTrader...</b><br/>Quando o MT5 enviar sinais, a comparação será atualizada.</div>
   </div>
  </div>
  <div className="panel"><h2>Checklist de igualdade Web x MT5</h2>
   {data.error&&<p className="warn">Erro no checklist: {data.error}</p>}
   <div className="checkGrid">{(data.checks||[]).map((c:any)=><div className={c.ok?'check okc':'check badc'} key={c.name}>{c.ok?'✅':'❌'} {c.name}</div>)}</div>
   <div className="testAudit"><b>Configuração única v67</b><br/>
    Robô: {cfg.name||'Robô'} • Modo: {cfg.mode||'-'} • Indicadores: {(cfg.indicators||[]).map((x:any)=>String(x.type||'').toUpperCase()+' '+(x.period||'')).join(', ')||'sem indicadores'}<br/>
    Execução: {cfg.execution?.entryTiming||'-'} • Expiração: {cfg.execution?.expirationCandles||1} candle • Payout: {cfg.execution?.payout||0} • Entrada: {cfg.execution?.stake||0}<br/>
    MT5: use o botão <b>MQ5 Validação</b>, sem SL/TP, para enviar operações ao comparador.
   </div>
  </div>
 </>;
}

function ValidationMT5(){
 const[robots,setRobots]=useState<any[]>([]),[robotId,setRobotId]=useState(''),[runId,setRunId]=useState(''),[mt5,setMt5]=useState<any[]>([]),[platform,setPlatform]=useState<any[]>([]),[cmp,setCmp]=useState<any>(null),[msg,setMsg]=useState('');
 const[loading,setLoading]=useState(false),[loadingText,setLoadingText]=useState('Carregando comparação...'),[robotsLoading,setRobotsLoading]=useState(true);
 const[autoWatch,setAutoWatch]=useState(true),[status,setStatus]=useState<any>(null),[lastCsvKey,setLastCsvKey]=useState('');
 useEffect(()=>{setRobotsLoading(true);api('/api/robots').then((r:any[])=>{setRobots(r||[]); if(r?.[0]){setRobotId(r[0].id);setRunId(r[0].id)}}).finally(()=>setRobotsLoading(false))},[]);
 useEffect(()=>{
   if(!runId)return; let alive=true;
   async function tick(){
     try{
       const st=await api('/api/validation/status/'+runId,{timeoutMs:6000});
       if(!alive)return; setStatus(st);
       const key=st?.mt5File ? `${st.mt5File.name}|${st.mt5File.mtimeMs}|${st.mt5File.size}` : '';
       if(autoWatch && st?.mt5Ready && key && key!==lastCsvKey && !loading){
         setLastCsvKey(key);
         setMsg(st.mt5Ready ? `CSV correto detectado para este Run ID. Clique em Carregar comparação ou aguarde o auto-carregamento.` : (st.mt5StateReason || 'Aguardando CSV do MT5 deste robô.'));
         setTimeout(()=>{ if(autoWatch) loadAll(); }, 700);
       }
     }catch(e:any){ if(alive)setStatus({ok:false,error:String(e?.message||e).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}) }
   }
   tick(); const t=setInterval(tick,4000);
   return()=>{alive=false;clearInterval(t)}
 },[runId,autoWatch,lastCsvKey,loading]);
 async function loadAll(){
   if(!runId){setMsg('Selecione um robô antes de comparar.');return;}
   if(loading)return;
   setLoading(true); setCmp(null); setMsg('');
   try{
     setLoadingText('1/3 Lendo CSV do MetaTrader...');
     const m=await api('/api/validation/mt5/'+runId).catch((e:any)=>({ok:false,total:0,trades:[],error:String(e)}));
     setMt5(Array.isArray(m.trades)?m.trades.slice(0,200):[]);

     setLoadingText('2/3 Carregando operações da plataforma...');
     const p=await api('/api/validation/platform/'+runId).catch((e:any)=>({ok:false,total:0,trades:[],error:String(e)}));
     setPlatform(Array.isArray(p.trades)?p.trades.slice(0,200):[]);

     setLoadingText('3/3 Comparando por símbolo, timeframe e horário...');
     const c=await api('/api/validation/compare/'+runId).catch((e:any)=>({ok:false,platformTotal:p.total||0,mt5Total:m.total||0,same:0,agreement:0,differences:[{index:1,reason:'API compare indisponível',platform:null,mt5:null}]}));
     if(c&&Array.isArray(c.differences))c.differences=c.differences.slice(0,100);
     setCmp(c||null);
     setMsg(`Plataforma: ${p.total||0} • MT5: ${m.total||0} • Concordância: ${c.agreement||0}% • Fonte MT5: ${c.mt5Source||m.source||'não encontrada'}`);
   }catch(e:any){
     setMsg('Erro ao carregar comparação: '+String(e?.message||e));
     setMt5([]); setPlatform([]); setCmp(null);
   }finally{
     setLoading(false);
   }
 }
 async function clearMt5(){
   if(!runId||loading)return;
   setLoading(true); setLoadingText('Limpando logs do MT5...');
   await fetch('/api/validation/mt5/'+runId,{method:'DELETE'});
   setMt5([]);setCmp(null);setMsg('Logs MT5 limpos.');
   setLoading(false);
 }
 const selected=robots.find((r:any)=>r.id===robotId);
 return <section><LoadingOverlay show={loading||robotsLoading} text={robotsLoading?'Carregando robôs salvos...':loadingText}/><h1>Validação MT5</h1>
 <div className="panel"><h2>Objetivo</h2><p>Comparar a plataforma e o MetaTrader operação por operação. O alvo inicial é bater <b>horário + direção</b>; depois lucro financeiro.</p><div className='testAudit'><b>v111 Stable</b><br/>v119: Otimizador com presets, ETA, contador de tempo, aviso de testes altos e confiança do resultado.</div></div>
 <div className="panel"><h2>1. Configuração</h2><div className="grid"><label>Robô salvo<select disabled={loading||robotsLoading} value={robotId} onChange={e=>{setRobotId(e.target.value);setRunId(e.target.value);setCmp(null);setMsg('')}}>{(robots||[]).map((r:any)=><option key={r.id} value={r.id}>{r.name||r.json?.name||'Robô sem nome'}</option>)}</select></label><label>Run ID<input disabled={loading} value={runId} onChange={e=>setRunId(e.target.value)} /></label></div>{selected&&<div className='testAudit'><b>Robô selecionado</b><br/>{(selected?.name||selected?.json?.name||'Robô')} • {selected?.json?.voiceStrategy?.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')}</div>}<label className="checkline"><input type="checkbox" checked={autoWatch} onChange={e=>setAutoWatch(e.target.checked)}/> Autoimportar quando o CSV do MT5 mudar</label><button disabled={loading||robotsLoading} onClick={loadAll}>{loading?'Aguarde...':'Carregar comparação'}</button> <button disabled={loading||robotsLoading} className="secondaryBtn" onClick={clearMt5}>Limpar logs MT5</button>{loading&&<p className="ok">🤖 {loadingText}</p>}<p className={status?.ok===false||status?.mt5State==='locked'||status?.mt5State==='writing'?'warn':'ok'}>{status?.ok===false?'API/status: '+status.error:status?.mt5Found?`CSV MT5 ${status.mt5Ready?'pronto':'aguardando'} • ${status.mt5File?.name} • ${status.mt5StateReason||status.mt5State}`:'Aguardando CSV do MT5 deste robô...'}</p><p className="ok">{msg}</p></div>
 <ValidationChecklist robotId={robotId}/>
 {cmp&&<div className="panel"><h2>Resumo de concordância v90</h2><div className="metrics"><div><span>Concordância operações</span><b>{cmp.agreement}%</b></div><div><span>Replay por candle</span><b>{cmp.replayV90?.agreement ?? '-'}%</b></div><div><span>Operações iguais</span><b>{cmp.same}</b></div><div><span>Plataforma</span><b>{cmp.platformTotal}</b></div><div><span>MT5 bruto</span><b>{cmp.mt5Total}</b></div><div><span>MT5 filtrado</span><b>{cmp.mt5FilteredTotal||cmp.stats?.mt5FilteredTotal||cmp.mt5Total}</b></div><div><span>Sinal diferente</span><b>{cmp.stats?.signalDifferent||0}</b></div><div><span>Falta no MT5</span><b>{cmp.stats?.missingMt5||0}</b></div><div><span>Auditoria MT5</span><b>{cmp.auditTotal||cmp.stats?.auditTotal||0}</b></div></div>{cmp.notice&&<p className="warn">{cmp.notice}</p>}{cmp.platformSource&&<p className="ok">Fonte Plataforma: {cmp.platformSource} • Fonte MT5: {cmp.mt5Source} • Auditoria: {cmp.auditSource||cmp.stats?.auditSource||'não encontrada'} • v90 compara por candle usando o AUDIT.</p>}{cmp.replayV90?.topRootCauses?.length>0&&<div className="testAudit"><b>Principais causas restantes</b><ol>{cmp.replayV90.topRootCauses.map((x:any,i:number)=><li key={i}>{x.reason}: <b>{x.count}</b></li>)}</ol></div>}{cmp.agreement<99&&<p className="warn">Para chegar a 100%, ataque a primeira causa do Replay Engine abaixo.</p>}</div>}
 {cmp?.replayV90&&<div className="panel"><h2>Replay Engine v90 — primeiras diferenças por candle</h2><p className="ok">Candle matches: {cmp.replayV90.candleMatches} • Iguais no replay: {cmp.replayV90.signalMatches} • Sinal diferente: {cmp.replayV90.signalMismatch} • Preço diferente: {cmp.replayV90.priceMismatch} • Sem auditoria: {cmp.replayV90.missingAudit}</p>{cmp.replayV90.firstDifferences?.length===0?<p className="ok">Nenhuma diferença no replay por candle.</p>:<div className="compareTable"><div className="head">#</div><div className="head">Hora</div><div className="head">Causa provável</div><div className="head">Sinal Web</div><div className="head">Sinal MT5</div><div className="head">Preço Web</div><div className="head">Preço MT5</div><div className="head">Indicadores MT5</div>{(cmp.replayV90.firstDifferences||[]).slice(0,50).map((d:any)=><React.Fragment key={d.index}><div>{d.index}</div><div>{d.time}</div><div>{d.rootCause}</div><div>{d.platform?.signal||'-'}</div><div>{d.mt5?.signal||'-'}</div><div>{d.platform?.price||'-'}</div><div>{d.mt5?.price||'-'}</div><div>{d.audit?`Close ${d.audit.close} | EMA ${d.audit.ema} | RSI ${d.audit.rsi} | Hist ${d.audit.macdHist}`:'-'}</div></React.Fragment>)}</div>}</div>}
 <div className="panel"><h2>Primeiras divergências</h2>{cmp&&cmp.differences?.length>=100&&<p className="warn">Mostrando apenas as primeiras 100 divergências para manter a tela rápida.</p>}{!cmp?<p>Carregue a comparação.</p>:cmp.differences?.length===0?<p className="ok">Nenhuma divergência encontrada.</p>:<div className="compareTable"><div className="head">#</div><div className="head">Motivo</div><div className="head">Plataforma</div><div className="head">MT5</div><div className="head">Sinal P</div><div className="head">Sinal MT5</div><div className="head">Preço P</div><div className="head">Preço MT5</div><div className="head">Dif. pips</div><div className="head">Diagnóstico auditoria</div><div className="head">EMA/RSI/MACD MT5</div>{(cmp.differences||[]).map((d:any)=><React.Fragment key={d.index}><div>{d.index}</div><div>{d.reason}</div><div>{d.platform?.time||'-'}</div><div>{d.mt5?.time||'-'}</div><div>{d.platform?.signal||d.platform?.type||'-'}</div><div>{d.mt5?.signal||d.mt5?.type||'-'}</div><div>{d.platform?.price||'-'}</div><div>{d.mt5?.price||'-'}</div><div>{d.priceDiffPips??'-'}</div><div>{d.auditDiagnosis||'-'}</div><div>{d.audit?`EMA ${d.audit.ema ?? '-'} | RSI ${d.audit.rsi ?? '-'} | Hist ${d.audit.macdHist ?? '-'}`:'-'}</div></React.Fragment>)}</div>}</div>
 <div className="panel"><h2>Operações recebidas do MT5</h2>{mt5.length===0?<p>Nenhuma operação recebida ainda.</p>:<div className="compareTable"><div className="head">#</div><div className="head">Hora</div><div className="head">Sinal</div><div className="head">Preço</div><div className="head">Resultado</div><div className="head">EMA</div><div className="head">RSI</div><div className="head">Williams</div>{(mt5||[]).slice(0,200).map((t:any,i:number)=><React.Fragment key={i}><div>{i+1}</div><div>{t.time||t.barTime||'-'}</div><div>{t.signal||t.type||'-'}</div><div>{t.price||'-'}</div><div>{t.outcome||'-'}</div><div>{t.ema||'-'}</div><div>{t.rsi||'-'}</div><div>{t.williams||'-'}</div></React.Fragment>)}</div>}</div>
 <div className="panel"><h2>Passo a passo comercial de validação</h2><ol><li>Rode o Backtest Lab na plataforma para salvar as operações Web.</li><li>Vá em <b>Meus Robôs</b> e clique em <b>MQ5 Validação</b>.</li><li>Compile o arquivo no MetaEditor.</li><li>Rode o mesmo ativo, timeframe e período no MT5.</li><li>O EA salvará o CSV em <b>Common\Files</b>.</li><li>Volte aqui e clique em <b>Carregar comparação</b> ou deixe o autoimport ligado.</li></ol></div><div className="panel"><h2>Diagnóstico rápido</h2><p>Se a comparação mostrar MT5 = 0, confirme se existe um arquivo <b>ForexIA_MT5_VALIDATION_*.csv</b> e <b>ForexIA_MT5_AUDIT_*.csv</b> em <b>%APPDATA%\MetaQuotes\Terminal\Common\Files</b>.</p><p>Diagnóstico CSV: <b>http://localhost:3001/api/validation/mt5-csv/scan</b></p><p>Teste a API em: <b>http://localhost:3001/api/validation/health</b></p></div><div className="panel"><h2>Fluxo recomendado</h2><ol><li>Rode o Backtest Lab na plataforma.</li><li>Use o mesmo robô para gerar o MQ5.</li><li>No MT5 use mesmo ativo, timeframe, período e modelagem.</li><li>Rode o teste sem Bridges antigos anexados.</li><li>Volte aqui e clique em <b>Carregar comparação</b>.</li></ol></div>
 </section>
}

function RobotsVault({setPage,setVoiceConfig,setSelected,setSelectedRobot,datasets}:any){
 const [items,setItems]=useState<any[]>([]); const [loading,setLoading]=useState(false);
 async function load(){setLoading(true); try{setItems(await api('/api/strategies'))}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 async function del(id:string){if(confirm('Excluir este robô?')){await fetch('/api/strategies/'+id,{method:'DELETE'});load()}}
 function apply(r:any){
 const j=r.json||{};
 const cfg={strategy:'voice',voiceStrategy:j.voiceStrategy||{mode:'trend',indicators:[]},startHour:j.filters?.startHour||'00:00',endHour:j.filters?.endHour||'23:59',robotName:j.name||r.name};
 setVoiceConfig(cfg);
 if(datasets?.[0])setSelected(datasets[0].id);
 setTimeout(()=>setPage('lab'),50);
}
 async function exportMt5(r:any){
   const res=await fetch('/api/robot/export-mt5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r.json||{})});
   const blob=await res.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a');
   a.href=url; a.download=((r.json?.name||r.name||'ForexIA_Robo')+'.mq5'); a.click(); URL.revokeObjectURL(url);
 }
 return <section><LoadingOverlay show={loading} text="Carregando robôs..."/><h1>Meus Robôs</h1><div className="panel"><h2>Robôs salvos</h2><button onClick={load}>Atualizar lista</button>{items.length===0&&!loading&&<p>Nenhum robô salvo ainda. Use a aba <b>Criar Robô</b>.</p>}{items.map((r:any)=><div className="robotItem" key={r.id}><div><h3>{r.name}</h3><p>{r.json?.voiceStrategy?.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')||'Sem indicadores'}<br/><small>Criado em {new Date(r.createdAt).toLocaleString('pt-BR')}</small></p></div><div><button onClick={()=>apply(r)}>Backtest</button><button onClick={()=>exportMt5(r)}>MT5 .mq5</button><button onClick={()=>window.open('/api/robots/'+r.id+'/validation-mq5','_blank')}>MQ5 Validação</button><button onClick={()=>del(r.id)}>Excluir</button></div></div>)}</div></section>
}

function OptimizerPage({datasets,setPage,setSelected,setVoiceConfig,setSelectedRobot}:any){
 const[robots,setRobots]=useState<any[]>([]),[robotId,setRobotId]=useState(''),[datasetId,setDatasetId]=useState(''),[filters,setFilters]=useState<any>({startDate:'',endDate:'',startHour:'00:00',endHour:'23:59',weekdays:[1,2,3,4,5]});
 const[population,setPopulation]=useState(24),[generations,setGenerations]=useState(5),[minTrades,setMinTrades]=useState(50),[maxDrawdown,setMaxDrawdown]=useState(120),[running,setRunning]=useState(false),[result,setResult]=useState<any>(null),[err,setErr]=useState(''),[errPerfil,setErrPerfil]=useState(false),[startedAt,setStartedAt]=useState<number>(0),[now,setNow]=useState<number>(Date.now());
 useEffect(()=>{api('/api/strategies').then((r:any[])=>{setRobots(r||[]); if((r||[])[0]) setRobotId((r||[])[0].id)}).catch(()=>{});},[]);
 useEffect(()=>{const best=(datasets||[]).find((d:any)=>String(d.pair||'').includes('EURUSD')&&String(d.timeframe||'')==='M5') || (datasets||[])[0]; if(best&&!datasetId)setDatasetId(best.id)},[datasets]);
 const[jobId,setJobId]=useState('');
 const[live,setLive]=useState<any>(null);
 useEffect(()=>{if(!running)return;const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[running]);
 // Progresso real vindo do servidor: testes concluídos, geração atual e melhor resultado até agora.
 useEffect(()=>{
  if(!running||!jobId)return;
  const t=setInterval(async()=>{try{const p=await api('/api/optimizer/progress/'+jobId,{timeoutMs:8000});if(p?.ok)setLive(p)}catch{}},900);
  return()=>clearInterval(t);
 },[running,jobId]);
 const robot=robots.find((r:any)=>r.id===robotId);
 const plannedTests=1+Math.max(4,Number(population||0))+(Number(population||0)*Number(generations||0));
 const selectedDs=(datasets||[]).find((d:any)=>d.id===datasetId);
 const elapsedSec=running?Math.max(0,Math.round((now-startedAt)/1000)):0;
 // Estimativa a priori, usada só ANTES de rodar (ainda não há ritmo medido).
 const etaSec=Math.max(5,Math.round((plannedTests/55)*60));
 // Durante a execução o ETA vem do ritmo real medido, não deste chute.
 const tested=Number(live?.tested||0);
 const totalTests=Number(live?.plannedTests||plannedTests);
 const progress=running?(tested>0?Math.min(99,Math.round(tested/Math.max(totalTests,1)*100)):0):0;
 const rate=tested>0&&elapsedSec>0?tested/elapsedSec:0; // testes por segundo, medido
 const remainSec=rate>0?Math.max(0,Math.round((totalTests-tested)/rate)):0;
 const fmt=(sec:number)=>{const s=Math.max(0,Math.round(sec));const m=Math.floor(s/60),r=s%60;return String(m).padStart(2,'0')+':'+String(r).padStart(2,'0')}
 const preset=(p:string)=>{if(p==='fast'){setPopulation(12);setGenerations(3);setMinTrades(30)} if(p==='balanced'){setPopulation(24);setGenerations(5);setMinTrades(50)} if(p==='pro'){setPopulation(48);setGenerations(10);setMinTrades(80)} if(p==='research'){setPopulation(80);setGenerations(20);setMinTrades(100)}};
 const profile=plannedTests<=80?'Rápido':plannedTests<=220?'Balanceado':plannedTests<=650?'Profissional':'Pesquisa pesada';
 const warning=plannedTests>1000?`Serão aproximadamente ${br(plannedTests)} testes. Pode demorar bastante e normalmente o ganho adicional fica pequeno. Use primeiro Balanceado ou Profissional.`:plannedTests>500?`Serão ${br(plannedTests)} testes. Use apenas se o teste balanceado já encontrou algo promissor.`:'';
 async function run(){
  setErr('');setErrPerfil(false);setResult(null);
  if(warning && !confirm(warning+'\n\nDeseja continuar?'))return;
  const jid=(crypto as any)?.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2);
  setJobId(jid);setLive(null);setStartedAt(Date.now());setNow(Date.now());setRunning(true);
  try{const r=await api('/api/optimizer/genetic',{method:'POST',headers:{'Content-Type':'application/json'},timeoutMs:900000,body:JSON.stringify({jobId:jid,datasetId,robotId,voiceStrategy:(robot?.json?.voiceStrategy||robot?.voiceStrategy),filters,population,generations,minTrades,maxDrawdown,expiration:1,payout:.85,stake:1,initial:100})});setResult(r)}catch(e:any){const m=String(e?.message||e);if(m.includes('abort')||m.includes('aborted')){setErr('A otimização demorou demais. Reduza População/Gerações, use o preset Balanceado ou reduza o período.')}else{const info=billingErrorInfo(e);setErr(info.message);setErrPerfil(info.needsPerfil)}}finally{setRunning(false)}
 }
 // Cancelar de verdade: o servidor interrompe o laço e devolve o melhor resultado encontrado até aqui.
 async function cancelRun(){if(!jobId)return;try{await api('/api/optimizer/cancel/'+jobId,{method:'POST',timeoutMs:8000})}catch{}}
 async function saveBest(){if(!result?.best)return;const nm=(robot?.name||robot?.json?.name||'Robo')+'_OPT_'+new Date().toISOString().slice(0,10);const r=await api('/api/optimizer/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nm,baseRobotId:robotId,voiceStrategy:result.best.voiceStrategy})});alert('Robô otimizado salvo: '+(r.robot?.name||nm));}
 function openBest(){if(!result?.best)return;setSelected(datasetId);setVoiceConfig({strategy:'voice',voiceStrategy:result.best.voiceStrategy,startHour:filters.startHour,endHour:filters.endHour});setSelectedRobot({id:robotId,name:(robot?.name||robot?.json?.name||'Robô')+' otimizado',voiceStrategy:result.best.voiceStrategy,filters});setPage('lab')}
 return <section>
  <LoadingOverlay show={running} text="🧬 Otimizador genético em execução. Testando combinações do robô selecionado..."/>
  {running&&<div className="optimizerFloat" role="dialog" aria-modal="true" aria-label="Otimização em andamento">
   <h3>🧬 Otimização em andamento</h3>
   <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{width:progress+'%'}}/></div>
   <div className="optStats" aria-live="polite">
    <span>Progresso<br/><b>{progress}%</b></span>
    <span>Testes concluídos<br/><b>{br(tested)} / {br(totalTests)}</b></span>
    <span>Geração<br/><b>{live?`${live.generation} / ${live.generations}`:'—'}</b></span>
    <span>Decorrido<br/><b>{fmt(elapsedSec)}</b></span>
    <span>Restante<br/><b>{rate>0?fmt(remainSec):'calculando...'}</b></span>
    <span>Melhor lucro até agora<br/><b className={Number(live?.bestProfit||0)>=0?'green':'red'}>{live?money(live.bestProfit):'—'}</b></span>
   </div>
   <p>{rate>0?`Ritmo medido: ${(rate*60).toFixed(0)} testes/min.`:'Medindo a velocidade desta execução...'} Não feche a página.</p>
   <div className="actionsRow"><button className="secondaryBtn" onClick={cancelRun}>Parar e usar o melhor até agora</button></div>
  </div>}
  <h1>Otimizador Genético</h1>
  <div className="panel"><h2>Configuração</h2><p>Use a plataforma para testar variações rapidamente. Depois valide no MT5 somente a melhor configuração. Padrão recomendado: <b>Balanceado</b>.</p>
   <div className="presetBtns"><button type="button" onClick={()=>preset('fast')}>Rápido<br/><small>12 × 3</small></button><button type="button" onClick={()=>preset('balanced')}>Balanceado<br/><small>24 × 5</small></button><button type="button" onClick={()=>preset('pro')}>Profissional<br/><small>48 × 10</small></button><button type="button" onClick={()=>preset('research')}>Pesquisa<br/><small>80 × 20</small></button></div>
   <div className="optimizerHint"><b>{profile}</b> • Testes previstos: <b>{br(plannedTests)}</b> • Tempo aproximado: <b>~{fmt(etaSec)}</b> • Custo da otimização: <b>{money(((robot?.json?.voiceStrategy?.indicators?.length||robot?.voiceStrategy?.indicators?.length||1)*0.50))}</b>. {warning&&<span className="warn"> {warning}</span>}</div>
   <div className="grid"><label>Robô<select value={robotId} onChange={e=>setRobotId(e.target.value)}>{robots.map((r:any)=><option key={r.id} value={r.id}>{r.name||r.json?.name}</option>)}</select></label><label>Dataset<select value={datasetId} onChange={e=>setDatasetId(e.target.value)}>{datasets.map((d:DS)=><option key={d.id} value={d.id}>{d.pair} {d.timeframe} - {br(d.count)}</option>)}</select></label><label>População<input type="number" min="4" value={population} onChange={e=>setPopulation(+e.target.value)}/><small>24–40 recomendado</small></label><label>Gerações<input type="number" min="1" value={generations} onChange={e=>setGenerations(+e.target.value)}/><small>5–8 recomendado</small></label><label>Mínimo trades<input type="number" value={minTrades} onChange={e=>setMinTrades(+e.target.value)}/><small>50+ evita sorte estatística</small></label><label>Drawdown máximo<input type="number" value={maxDrawdown} onChange={e=>setMaxDrawdown(+e.target.value)}/></label><label>Data inicial<input type="date" value={filters.startDate} onChange={e=>setFilters({...filters,startDate:e.target.value})}/></label><label>Data final<input type="date" value={filters.endDate} onChange={e=>setFilters({...filters,endDate:e.target.value})}/></label><label>Hora inicial<input type="time" value={filters.startHour} onChange={e=>setFilters({...filters,startHour:e.target.value})}/></label><label>Hora final<input type="time" value={filters.endHour} onChange={e=>setFilters({...filters,endHour:e.target.value})}/></label></div>
   {robot&&<div className="parsed"><b>Robô base:</b> {robot.name||robot.json?.name}<br/><b>Indicadores:</b> {robot.json?.voiceStrategy?.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')}<br/><b>Dataset:</b> {selectedDs?`${selectedDs.pair} ${selectedDs.timeframe} • ${br(selectedDs.count)} candles`:''}</div>}
   <button disabled={running||!robotId||!datasetId} onClick={run}>{running?'Otimizando...':'Executar otimização genética'}</button>{err&&<p className="warn">{err} {errPerfil&&<button className="secondaryBtn" onClick={()=>setPage&&setPage('perfil')}>Ir para o Perfil</button>}</p>}
  </div>
  {result&&<><div className="panel"><h2>Resumo</h2><div className="metric"><Metric name="Testes" value={result.tested}/><Metric name="Lucro atual" value={money(result.baseline.metrics.profit)}/><Metric name="Lucro melhor" value={money(result.best.metrics.profit)}/><Metric name="Melhoria" value={money(result.improvement)}/><Metric name="Win melhor" value={result.best.metrics.winRate+'%'}/><Metric name="Trades" value={result.best.metrics.total}/><Metric name="Drawdown" value={result.best.metrics.drawdown+'%'}/><Metric name="PF" value={result.best.metrics.profitFactor}/></div><div className="confidenceBox"><b>Confiabilidade: {'★'.repeat(result.confidence?.stars||1)}{'☆'.repeat(5-(result.confidence?.stars||1))} {result.confidence?.level}</b><p>{result.confidence?.message}</p></div><div className="parsed"><b>Melhor configuração:</b><br/>{result.best.indicators.map((x:any)=>`${String(x.type).toUpperCase()} ${x.period}${x.buy?` buy ${x.buy}`:''}${x.sell?` sell ${x.sell}`:''}${x.threshold?` th ${x.threshold}`:''}`).join(' • ')}</div><button onClick={saveBest}>Salvar como novo robô</button><button onClick={openBest}>Abrir no Backtest Lab</button></div><div className="panel"><h2>Evolução</h2><div className="evoLine">{(result.curve||[]).map((x:any)=><span key={x.generation}>G{x.generation}: {money(x.profit)} ({x.trades} ops)</span>)}</div></div><div className="panel"><h2>Top configurações</h2><div className="optimizerTable"><div className="head">#</div><div className="head">Lucro</div><div className="head">Win</div><div className="head">Trades</div><div className="head">DD</div><div className="head">PF</div><div className="head">Configuração</div>{(result.top||[]).slice(0,10).map((x:any,i:number)=><React.Fragment key={i}><div>{i+1}</div><div>{money(x.metrics.profit)}</div><div>{x.metrics.winRate}%</div><div>{x.metrics.total}</div><div>{x.metrics.drawdown}%</div><div>{x.metrics.profitFactor}</div><div>{x.indicators.map((z:any)=>`${String(z.type).toUpperCase()} ${z.period}`).join(' • ')}</div></React.Fragment>)}</div></div></>}
 </section>
}

function Ranking(){const[items,setItems]=useState<any[]>([]);useEffect(()=>{api('/api/backtests').then(setItems)},[]);return <section><h1>Ranking</h1>{items.map(x=><div className="rank" key={x.id}><h3>{x.pair} {x.timeframe}</h3><p>{x.result.metrics.score}/100 • Win {x.result.metrics.winRate}% • Lucro {money(x.result.metrics.profit)} • PF {x.result.metrics.profitFactor}</p></div>)}</section>}
function Setup(){return <section><h1>Instalação</h1><div className="panel"><h2>Migrar dados</h2><pre>1) Feche a v26 com CTRL+C
2) Copie a pasta data da versão anterior
3) Cole em C:\\forex_ia_studio_v27
4) Rode npm install e npm start</pre><h2>MT5</h2><p>Pode continuar com EA v24/v25/v26. WebRequest para <b>http://127.0.0.1:3001</b>.</p></div></section>}
// v126 — Landing Page pública. É a única tela visível sem sessão: o sistema fica atrás dela.
const LP_STEPS:any[]=[
 ['01','Conecte o MetaTrader 5','A ponte EA envia seus candles reais para a plataforma. Você monta a base histórica por par e timeframe, sem baixar CSV de lugar nenhum.'],
 ['02','Monte a estratégia','Escolha os indicadores e as regras de entrada e saída em uma tela visual — ou simplesmente descreva a estratégia falando com o agente de voz.'],
 ['03','Backteste e otimize','Rode o backtest no histórico real e deixe o otimizador genético varrer milhares de combinações de parâmetros para achar a melhor.'],
 ['04','Exporte o robô .mq5','Baixe o Expert Advisor pronto, compile no MetaTrader 5 e acompanhe o desempenho ao vivo pelo Teste Real.'],
];
const LP_FEATURES:any[]=[
 ['📥','Smart Import','Importação contínua de candles direto do MT5, com deduplicação automática e progresso por par e timeframe.'],
 ['🧠','Criar Robô sem código','Médias, RSI, MACD, Bollinger, estocástico e mais — combinados em regras claras, sem escrever uma linha de MQL5.'],
 ['🎙️','Agente de Voz','Fale a estratégia em português. O agente interpreta e já entrega o robô montado para você revisar.'],
 ['🧪','Backtest Lab','Curva de capital, drawdown, profit factor, taxa de acerto e a lista completa de operações do período.'],
 ['⚙️','Otimizador Genético','Algoritmo evolutivo que testa gerações de parâmetros e converge para o conjunto de melhor desempenho.'],
 ['✅','Validação MT5','Compare o backtest da plataforma com o do próprio MetaTrader 5 e confirme que os números batem.'],
 ['📡','Teste Real','Telemetria da conta, posições e ordens do robô rodando em demo ou real, com o EA no controle da execução.'],
 ['🏆','Ranking e Comparação','Coloque seus robôs lado a lado e veja quais realmente sustentam o resultado fora da amostra.'],
];
const LP_FAQ:any[]=[
 ['Preciso saber programar?','Não. Toda a estratégia é montada por indicadores e regras na tela — ou ditada por voz. O código MQL5 do Expert Advisor é gerado pela plataforma no final.'],
 ['Funciona com qualquer corretora?','Funciona com qualquer corretora que ofereça MetaTrader 5. A plataforma conversa com o seu terminal MT5 por uma ponte (Expert Advisor) instalada por você.'],
 ['O robô opera sozinho?','A execução das ordens é sempre do Expert Advisor dentro do seu MetaTrader 5. A plataforma serve para criar, testar, otimizar e monitorar — ela nunca fica no caminho crítico da ordem.'],
 ['Como funciona a cobrança?','Você paga por uso, por indicador da estratégia: criação a partir de R$ 0,26, backtest R$ 0,10 e otimizador genético R$ 0,50. Sem mensalidade e sem fidelidade — recarrega via PIX quando quiser.'],
 ['Tem teste grátis?','Tem. A 1ª criação de robô e o 1º backtest saem de graça assim que você cria a conta. Só a otimização genética é cobrada desde a primeira vez.'],
 ['Meus dados ficam seguros?','Sua base de candles e seus robôs ficam no seu ambiente. Conta e carteira são autenticadas com token e as chaves sensíveis nunca são expostas para o navegador.'],
];
function Landing({setSession}:any){
 const[auth,setAuth]=useState<'login'|'signup'|null>(null);
 useEffect(()=>{if(!auth)return;const esc=(e:any)=>{if(e.key==='Escape')setAuth(null)};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[auth]);
 const ir=(id:string)=>(e:any)=>{e.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})};
 return <div className="lp">
  <header className="lpNav">
   <div className="lpNavIn">
    <div className="lpBrand">🤖 FOREX <span>IA</span></div>
    <nav className="lpLinks">
     <a href="#recursos" onClick={ir('recursos')}>Recursos</a>
     <a href="#como" onClick={ir('como')}>Como funciona</a>
     <a href="#precos" onClick={ir('precos')}>Preços</a>
     <a href="#faq" onClick={ir('faq')}>Dúvidas</a>
    </nav>
    <div className="lpNavBtns">
     <button className="lpGhost" onClick={()=>setAuth('login')}>Entrar</button>
     <button className="lpCta" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
    </div>
   </div>
  </header>

  <section className="lpHero">
   <div className="lpHeroTxt">
    <span className="lpBadge">✨ 1º robô e 1º backtest grátis</span>
    <h1>Transforme sua estratégia em um <span>robô de MetaTrader 5</span> — sem escrever código.</h1>
    <p>O Forex IA Studio importa seus candles reais do MT5, monta a estratégia por indicadores, faz o backtest, otimiza os parâmetros com algoritmo genético e exporta o Expert Advisor pronto para operar.</p>
    <div className="lpHeroBtns">
     <button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Começar grátis agora</button>
     <button className="lpGhost lpBig" onClick={ir('como')}>Ver como funciona</button>
    </div>
    <p className="lpMicro">Sem mensalidade • Você paga por uso • Recarga via PIX</p>
   </div>
   <div className="lpHeroArt">
    <div className="lpFace"><div className="eyes"><i></i><i></i></div><b>W</b></div>
    <div className="lpMock">
     <div className="lpMockHead"><b>EURUSD M5 · Backtest</b><em>exemplo ilustrativo</em></div>
     <svg viewBox="0 0 320 110" className="lpSpark" preserveAspectRatio="none">
      <defs><linearGradient id="lpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#36ff8b" stopOpacity=".45"/><stop offset="100%" stopColor="#36ff8b" stopOpacity="0"/></linearGradient></defs>
      <polygon fill="url(#lpg)" points="0,96 20,90 40,93 60,80 80,84 100,70 120,74 140,58 160,63 180,48 200,52 220,38 240,44 260,28 280,33 300,18 320,14 320,110 0,110"/>
      <polyline fill="none" stroke="#36ff8b" strokeWidth="2.5" points="0,96 20,90 40,93 60,80 80,84 100,70 120,74 140,58 160,63 180,48 200,52 220,38 240,44 260,28 280,33 300,18 320,14"/>
     </svg>
     <div className="lpMockGrid"><div><span>Operações</span><b>842</b></div><div><span>Acerto</span><b>61%</b></div><div><span>Profit Factor</span><b>1,74</b></div><div><span>Drawdown</span><b>8,3%</b></div></div>
    </div>
   </div>
  </section>

  <section className="lpStrip">
   <div><b>15</b><span>ferramentas em um só lugar</span></div>
   <div><b>MT5</b><span>ponte oficial de candles</span></div>
   <div><b>.mq5</b><span>Expert Advisor exportado</span></div>
   <div><b>R$ 0,26</b><span>por indicador, sem mensalidade</span></div>
  </section>

  <section id="como" className="lpSec">
   <h2 className="lpH2">Do zero ao robô rodando em 4 passos</h2>
   <p className="lpSub">Nenhuma etapa exige programação. Você decide a lógica, a plataforma cuida do resto.</p>
   <div className="lpSteps">{LP_STEPS.map(([n,t,d]:any)=><div className="lpStep" key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></div>)}</div>
  </section>

  <section id="recursos" className="lpSec">
   <h2 className="lpH2">Tudo o que você precisa para validar uma estratégia</h2>
   <p className="lpSub">Da importação dos dados até o acompanhamento do robô em conta real.</p>
   <div className="lpFeat">{LP_FEATURES.map(([ic,t,d]:any)=><div className="lpCard" key={t}><span className="lpIco">{ic}</span><h3>{t}</h3><p>{d}</p></div>)}</div>
  </section>

  <section id="precos" className="lpSec">
   <h2 className="lpH2">Você só paga pelo que usar</h2>
   <p className="lpSub">Sem plano mensal, sem fidelidade. O preço é por indicador usado na estratégia.</p>
   <div className="lpPrice">
    <div className="lpPriceCard lpHighlight">
     <span className="lpTag">Comece aqui</span>
     <h3>Grátis</h3><b>R$ 0</b>
     <p>1ª criação de robô e 1º backtest por conta, sem cartão.</p>
     <ul><li>✔ Acesso a todas as telas</li><li>✔ Importação de candles do MT5</li><li>✔ Exportação do robô em .mq5</li></ul>
     <button className="lpCta" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
    </div>
    <div className="lpPriceCard">
     <h3>Pay-per-use</h3><b>R$ 0,26<em>/indicador</em></b>
     <p>Depois do teste grátis, cada ação tem um custo transparente por indicador:</p>
     <ul><li>🧠 Criar robô — <b>R$ 0,26</b></li><li>🧪 Backtest — <b>R$ 0,10</b></li><li>⚙️ Otimizador genético — <b>R$ 0,50</b></li></ul>
     <p className="lpMicro">Recarga por PIX, saldo na carteira, sem validade.</p>
    </div>
   </div>
  </section>

  <section id="faq" className="lpSec">
   <h2 className="lpH2">Perguntas frequentes</h2>
   <div className="lpFaq">{LP_FAQ.map(([q,a]:any)=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
  </section>

  <section className="lpFinal">
   <h2>Sua próxima estratégia pode estar testada hoje.</h2>
   <p>Crie a conta, importe seus dados e rode o primeiro backtest sem pagar nada.</p>
   <div className="lpHeroBtns"><button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Criar minha conta grátis</button><button className="lpGhost lpBig" onClick={()=>setAuth('login')}>Já tenho conta</button></div>
  </section>

  <footer className="lpFoot">
   <p className="lpRisk"><b>Aviso de risco:</b> operar no mercado de câmbio envolve risco de perda do capital investido. Resultados de backtest são simulações sobre dados históricos e não garantem desempenho futuro. O Forex IA Studio é uma ferramenta de pesquisa e automação — não presta consultoria nem recomendação de investimento.</p>
   <p>© {new Date().getFullYear()} Forex IA Studio · Robot Wizard</p>
  </footer>

  {auth&&<div className="lpModal" onClick={e=>{if(e.target===e.currentTarget)setAuth(null)}}>
   <AuthCard setSession={setSession} initialMode={auth} onClose={()=>setAuth(null)}/>
  </div>}
 </div>
}

function App(){const[page,setPage]=useState<Page>('dashboard'),[o,setO]=useState<any>({}),[status,setStatus]=useState<any[]>([]),[datasets,setDatasets]=useState<DS[]>([]),[selected,setSelected]=useState(''),[voiceConfig,setVoiceConfig]=useState<any>(null),[selectedRobot,setSelectedRobot]=useState<any>(null);
const[session,setSessionState]=useState<any>(()=>loadSession());
const[navOpen,setNavOpen]=useState(false);
function setSession(s:any){setCurrentSession(s);setSessionState(s)}
// Esc fecha a gaveta e o body trava o scroll enquanto ela está aberta.
useEffect(()=>{
 const esc=(e:any)=>{if(e.key==='Escape')setNavOpen(false)};
 window.addEventListener('keydown',esc);
 return()=>window.removeEventListener('keydown',esc);
},[]);
useEffect(()=>{document.body.classList.toggle('navLock',navOpen);return()=>document.body.classList.remove('navLock')},[navOpen]);
// Mantém a tela em sincronia quando o api() renova o token sozinho ou derruba a sessão vencida.
useEffect(()=>{sessionListener=setSessionState;return()=>{sessionListener=null}},[]);
async function load(){
 try{
   api('/api/mt5/overview',{timeoutMs:6000}).then(setO).catch((e:any)=>setO((x:any)=>({...x,online:false,lastError:String(e?.message||e)})));
   api('/api/mt5/status',{timeoutMs:6000}).then(setStatus).catch(()=>{});
   let ds:any[]=[];
   try{ds=await api('/api/mt5/datasets',{timeoutMs:10000})}catch{ds=await api('/api/datasets',{timeoutMs:10000})}
   if(Array.isArray(ds)){
     setDatasets(ds);
     setSelected((cur:string)=>{
       if(cur && ds.some((d:any)=>d.id===cur))return cur;
       const best=ds.find((d:any)=>String(d.pair||'').includes('EURUSD')&&String(d.timeframe||'')==='M5') || ds.find((d:any)=>String(d.timeframe||'')==='M5') || ds[0];
       return best?.id||cur||'';
     });
   }
 }catch(e:any){setO((x:any)=>({...x,online:false,lastError:String(e?.message||e)}));}
}
// Ao sair, volta o menu para o Dashboard — senão o próximo login cai na tela antiga.
useEffect(()=>{if(!session?.token)setPage('dashboard')},[session?.token]);
// Sem sessão não há sistema para atualizar: o polling só começa depois do login.
// Só consulta o servidor com a aba visível — antes eram 3 requisições a cada 8s mesmo em segundo
// plano, competindo com operações longas como o otimizador.
useEffect(()=>{
 if(!session?.token)return;
 let t:any=null;
 const start=()=>{if(t)return;load();t=setInterval(load,8000)};
 const stop=()=>{if(t){clearInterval(t);t=null}};
 const onVis=()=>{document.hidden?stop():start()};
 onVis();
 document.addEventListener('visibilitychange',onVis);
 return()=>{stop();document.removeEventListener('visibilitychange',onVis)};
},[session?.token]);function applyVoice(cfg:any){setVoiceConfig(cfg);setPage('builder')}
// v126: a Landing é a porta de entrada. Sistema só aparece com sessão válida.
if(!session?.token)return <Landing setSession={setSession}/>;
return <div className="app"><TopBar page={page} setPage={setPage} open={navOpen} setOpen={setNavOpen}/><Sidebar page={page} setPage={setPage} open={navOpen} setOpen={setNavOpen}/><main><ErrorBoundary>{page==='dashboard'&&<Dashboard o={o} status={status}/>} {page==='perfil'&&<PerfilPage session={session} setSession={setSession}/>} {page==='import'&&<ImportPage load={load} o={o}/>} {page==='datasets'&&<Datasets datasets={datasets} setPage={setPage} setSelected={setSelected}/>} {page==='viewer'&&<Viewer datasets={datasets} selected={selected} setSelected={setSelected}/>} {page==='builder'&&<AccessGate setPage={setPage} session={session}><RobotBuilder datasets={datasets} selected={selected} setPage={setPage} setSelected={setSelected} setVoiceConfig={setVoiceConfig} voiceConfig={voiceConfig}/></AccessGate>} {page==='compare'&&<RobotCompare datasets={datasets} setPage={setPage} setSelected={setSelected} setVoiceConfig={setVoiceConfig} setSelectedRobot={setSelectedRobot}/>} {page==='robots'&&<RobotsVault setPage={setPage} setVoiceConfig={setVoiceConfig} setSelected={setSelected} setSelectedRobot={setSelectedRobot} datasets={datasets}/>} {page==='lab'&&<AccessGate setPage={setPage} session={session}><BacktestLab datasets={datasets} selected={selected} voiceConfig={voiceConfig} setVoiceConfig={setVoiceConfig} selectedRobot={selectedRobot} setSelectedRobot={setSelectedRobot} setPage={setPage}/></AccessGate>} {page==='optimizer'&&<OptimizerPage datasets={datasets} setPage={setPage} setSelected={setSelected} setVoiceConfig={setVoiceConfig} setSelectedRobot={setSelectedRobot}/>} {page==='validation'&&<ValidationMT5/>} {page==='forward'&&<AccessGate setPage={setPage} session={session}><ForwardTesting/></AccessGate>} {page==='voice'&&<VoicePage apply={applyVoice}/>} {page==='ranking'&&<Ranking/>} {page==='setup'&&<Setup/>}</ErrorBoundary></main></div>}
createRoot(document.getElementById('root')!).render(<App/>);
