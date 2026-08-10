import React,{useEffect,useState,useRef}from'react';
import{ShieldCheck,DownloadCloud,Brain,Mic,FlaskConical,Dna,RadioTower,Trophy,ArrowRight,Lock,Activity,Check}from'lucide-react';
import{AuthCard}from'./main';
import{Wordmark}from'./brand';
// v126 — Landing Page pública. É a única tela visível sem sessão: o sistema fica atrás dela.
// Painel-assinatura do hero: as mesmas métricas medidas nos dois lados.
// Números ilustrativos — a página deixa isso explícito no rótulo.
const LP_RECON:any[]=[
 ['Operações','842','842',0],
 ['Taxa de acerto','61,2%','61,2%',1],
 ['Profit factor','1,74','1,74',2],
 ['Drawdown','8,3%','8,3%',3],
];
// Revela os elementos .reveal uma única vez quando entram na viewport.
// Um observer só para a página toda; nada de listener de scroll.
function useReveal(){
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));return}
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -12% 0px',threshold:.15});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  return()=>io.disconnect();
 },[]);
}
// Conta até o valor final preservando a formatação pt-BR do texto original.
function useCountUp(alvo:string,ativo:boolean){
 const[txt,setTxt]=useState(alvo);
 useEffect(()=>{
  if(!ativo)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setTxt(alvo);return}
  const m=String(alvo).match(/^([\d.,]+)(.*)$/); if(!m){setTxt(alvo);return}
  const casas=(m[1].split(',')[1]||'').length, fim=parseFloat(m[1].replace(/\./g,'').replace(',','.')), sufixo=m[2], ini=performance.now(), dur=900;
  let raf=0;
  const passo=(t:number)=>{
   const p=Math.min(1,(t-ini)/dur), eased=1-Math.pow(1-p,3);
   setTxt((fim*eased).toLocaleString('pt-BR',{minimumFractionDigits:casas,maximumFractionDigits:casas})+sufixo);
   if(p<1)raf=requestAnimationFrame(passo);
  };
  raf=requestAnimationFrame(passo);
  return()=>cancelAnimationFrame(raf);
 },[alvo,ativo]);
 return txt;
}
function ReconRow({label,a,b,i,ativo}:any){
 const va=useCountUp(a,ativo), vb=useCountUp(b,ativo);
 return <div className="lpReconRow" style={{'--i':i} as any}><i>{label}</i><b className="num">{va}</b><b className="num">{vb}</b></div>;
}
function ReconPanel(){
 const ref=useRef<any>(null), [ativo,setAtivo]=useState(false);
 useEffect(()=>{
  const el=ref.current; if(!el)return;
  const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){setAtivo(true);io.disconnect()}},{threshold:.4});
  io.observe(el); return()=>io.disconnect();
 },[]);
 return <div className="lpRecon" ref={ref}>
  <div className="lpReconHead"><b>Mesma estratégia, mesmo período</b><em>números ilustrativos</em></div>
  <div className="lpReconCols"><span/><span>Forex IA Studio</span><span>MT5 Strategy Tester</span></div>
  {LP_RECON.map(([label,a,b,i]:any)=><ReconRow key={label} label={label} a={a} b={b} i={i} ativo={ativo}/>)}
  <div className={'lpReconSeal'+(ativo?' on':'')}><ShieldCheck size={16}/> Conferido operação por operação</div>
 </div>;
}
// As tres camadas de prova. A ordem e o produto: cada uma so libera a seguinte.
// Numeros ilustrativos — o painel diz isso no rotulo.
const LP_CAMADAS:any[]=[
 ['01','Passado','Backtest no histórico do seu próprio broker','ok','Reconciliado com o Strategy Tester do MT5'],
 ['02','Presente','30 dias operando na conta demo da corretora','ativo','Dia 18 de 30 · acumulado +R$ 412,60'],
 ['03','Futuro','Execução automática na sua conta real','travado','Destrava quando a camada 2 fechar no positivo'],
];
function Camadas(){
 const ref=useRef<any>(null), [ativo,setAtivo]=useState(false);
 useEffect(()=>{const el=ref.current;if(!el)return;const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){setAtivo(true);io.disconnect()}},{threshold:.4});io.observe(el);return()=>io.disconnect()},[]);
 return <div className="lpCamadas" ref={ref}>
  <div className="lpCamadasHead"><b>Do histórico até a conta real</b><em>números ilustrativos</em></div>
  {LP_CAMADAS.map(([n,titulo,desc,estado,nota]:any,i:number)=><div className={'lpCamada '+estado+(ativo?' on':'')} key={n} style={{'--i':i} as any}>
   <span className="lpCamadaN num">{n}</span>
   <div className="lpCamadaTxt"><b>{titulo}</b><p>{desc}</p><i>{nota}</i></div>
   <span className="lpCamadaIco" aria-hidden="true">{estado==='travado'?<Lock size={16}/>:estado==='ativo'?<Activity size={16}/>:<Check size={16}/>}</span>
  </div>)}
 </div>;
}
const LP_STEPS:any[]=[
 ['01','Conecte o MetaTrader 5','Instale a ponte EA e ela envia os candles do seu broker para a plataforma. A base histórica é montada por par e timeframe, com os dados que você realmente vai operar.'],
 ['02','Monte a estratégia','Escolha indicadores e escreva as regras de entrada e saída na tela — ou dite a estratégia para o agente de voz e revise o que ele montou.'],
 ['03','Backteste e otimize','Rode sobre o histórico importado e deixe o otimizador genético varrer gerações de parâmetros até achar o conjunto que sustenta o resultado.'],
 ['04','Exporte e confira no MT5','Baixe o Expert Advisor em .mq5, compile no MetaTrader 5 e compare o backtest da plataforma com o do Strategy Tester antes de colocar em conta real.'],
];
const LP_FEATURES:any[]=[
 [DownloadCloud,'d','Smart Import','Os candles vêm do seu próprio broker pela ponte EA, com deduplicação automática e progresso por par e timeframe. Você não baixa CSV de lugar nenhum.'],
 [Brain,'c','Criar robô sem código','Médias, RSI, MACD, Bollinger, estocástico e mais, combinados em regras de entrada e saída explícitas. O MQL5 é gerado no fim.'],
 [Mic,'c','Agente de voz','Descreva a estratégia falando em português. O agente monta a configuração e devolve para você revisar antes de salvar.'],
 [FlaskConical,'a','Backtest Lab','Curva de capital, drawdown, profit factor, taxa de acerto e a lista completa de operações do período — não só o número final.'],
 [Dna,'a','Otimizador genético','Gerações de parâmetros avaliadas contra o histórico até convergir. Você define população, gerações, mínimo de trades e teto de drawdown.'],
 [ShieldCheck,'p','Validação MT5','Compare o backtest da plataforma com o do Strategy Tester, operação por operação, e veja onde os dois divergem.'],
 [RadioTower,'p','Teste real','Telemetria de conta, posições e ordens do robô em demo ou real. O EA executa; a plataforma só observa.'],
 [Trophy,'a','Ranking e comparação','Coloque robôs lado a lado no mesmo dataset e no mesmo período para ver qual sustenta o resultado.'],
];
const LP_OBJ:any[]=[
 ['O robô vai operar sozinho com o meu dinheiro?','A execução das ordens é sempre do Expert Advisor rodando dentro do seu MetaTrader 5. A plataforma cria, testa, otimiza e monitora — ela nunca fica no caminho crítico da ordem. Se a plataforma cair, o robô continua fazendo exatamente o que o código dele manda.'],
 ['E se o backtest da plataforma não bater com o do MT5?','Aí você não deveria confiar nele — e é por isso que a tela de Validação MT5 existe. Ela coloca os dois lado a lado, operação por operação, começando por horário e direção. Divergência aparece, não fica escondida.'],
 ['Preciso saber programar?','Não. A estratégia é montada por indicadores e regras na tela, ou ditada por voz. O código MQL5 do Expert Advisor é gerado pela plataforma no fim do processo.'],
 ['Funciona com a minha corretora?','Funciona com qualquer corretora que ofereça MetaTrader 5. A plataforma conversa com o seu terminal por uma ponte (um Expert Advisor) que você mesmo instala.'],
 ['Quanto vou gastar de verdade?','Você paga por ação e por indicador da estratégia. Uma estratégia de 3 indicadores custa R$ 0,78 para criar, R$ 0,30 por backtest e R$ 1,50 por otimização. Sem mensalidade, sem fidelidade, recarga por PIX quando quiser.'],
 ['Meus dados ficam onde?','A base de candles e os robôs ficam no seu ambiente. Conta e carteira são autenticadas por token, e as chaves sensíveis do servidor nunca chegam ao navegador.'],
];
function Objecao({q,a}:any){
 const[open,setOpen]=useState(false), ref=useRef<any>(null), [h,setH]=useState(0);
 useEffect(()=>{
  let vivo=true;
  const medir=()=>{if(vivo)setH(ref.current?.scrollHeight||0)};
  medir();
  window.addEventListener('resize',medir);
  document.fonts?.ready?.then(medir); // recalcula depois da troca de fonte (@fontsource carrega os woff2 async)
  return()=>{vivo=false;window.removeEventListener('resize',medir)};
 },[]);
 return <div className={'lpObj'+(open?' open':'')}>
  <button type="button" aria-expanded={open} onClick={()=>setOpen(o=>!o)}><span>{q}</span><i/></button>
  <div className="lpObjBody" style={{height:open?h+'px':'0px'}}><p ref={ref}>{a}</p></div>
 </div>;
}
export default function Landing({setSession}:any){
 useReveal();
 const[auth,setAuth]=useState<'login'|'signup'|null>(null);
 useEffect(()=>{if(!auth)return;const esc=(e:any)=>{if(e.key==='Escape')setAuth(null)};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[auth]);
 const ir=(id:string)=>(e:any)=>{e.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})};
 return <div className="lp">
  <header className="lpNav">
   <div className="lpNavIn">
    <Wordmark size={20}/>
    <nav className="lpLinks">
     <a href="#como" onClick={ir('como')}>Como funciona</a>
     <a href="#recursos" onClick={ir('recursos')}>Recursos</a>
     <a href="#precos" onClick={ir('precos')}>Preços</a>
     <a href="#objecoes" onClick={ir('objecoes')}>Dúvidas</a>
    </nav>
    <div className="lpNavBtns">
     <button className="lpGhost" onClick={()=>setAuth('login')}>Entrar</button>
     <button className="lpCta" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
    </div>
   </div>
  </header>

  <section className="lpHero">
   <div className="lpHeroTxt">
    <span className="lpBadge">30 dias na conta demo antes de qualquer risco</span>
    <h1>O passado não garante o futuro. Por isso o robô <span>prova antes</span> de operar com o seu dinheiro.</h1>
    <p>Monte a estratégia sem escrever código, coloque o robô 30 dias na conta demo da sua corretora, acompanhe cada dia pelo relatório no WhatsApp e só então libere a execução automática.</p>
    <div className="lpHeroBtns">
     <button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Começar os 30 dias de teste</button>
     <button className="lpGhost lpBig" onClick={ir('como')}>Ver como funciona</button>
    </div>
    <p className="lpMicro">1º robô e 1º backtest grátis · sem mensalidade · recarga por PIX</p>
   </div>
   <div className="lpHeroArt" style={{'--i':3} as any}><Camadas/></div>
  </section>

  <section className="lpStrip">
   <div className="reveal"><b className="num">.mq5</b><span>Expert Advisor exportado, compilável no seu MT5</span></div>
   <div className="reveal"><b className="num">R$ 0,26</b><span>por indicador para criar — sem mensalidade</span></div>
   <div className="reveal"><b className="num">0</b><span>linhas de MQL5 escritas por você</span></div>
   <div className="reveal"><b className="num">100%</b><span>da execução dentro do seu MetaTrader 5</span></div>
  </section>

  <section id="como" className="lpSec">
   <h2 className="lpH2 reveal">Do primeiro candle ao robô compilado, em quatro etapas</h2>
   <p className="lpSub reveal">Nenhuma delas exige programação. Você decide a lógica; a plataforma gera o código.</p>
   <div className="lpSteps">{LP_STEPS.map(([n,t,d]:any)=><div className="lpStep reveal" key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></div>)}</div>
  </section>

  <section id="recursos" className="lpSec">
   <h2 className="lpH2 reveal">Cada etapa deixa um número que você pode conferir</h2>
   <p className="lpSub reveal">Da importação dos candles ao robô rodando em conta real.</p>
   <div className="lpFeat">{LP_FEATURES.map(([Ico,cat,t,d]:any)=><div className="lpCard reveal" key={t}><span className={'lpIco '+cat} aria-hidden="true"><Ico size={22} strokeWidth={2.2}/></span><h3>{t}</h3><p>{d}</p></div>)}</div>
  </section>

  <section id="precos" className="lpSec">
   <h2 className="lpH2 reveal">Você só paga pelo que usar</h2>
   <p className="lpSub reveal">Sem plano mensal, sem fidelidade. O preço é por indicador usado na estratégia.</p>
   <div className="lpPrice">
    <div className="lpPriceCard lpHighlight reveal">
     <span className="lpTag">Comece aqui</span>
     <h3>Grátis</h3><b>R$ 0</b>
     <p>1ª criação de robô e 1º backtest por conta, sem cartão.</p>
     <ul><li><span className="lpTick" aria-hidden="true"><ArrowRight size={14}/></span>Acesso a todas as telas</li><li><span className="lpTick" aria-hidden="true"><ArrowRight size={14}/></span>Importação de candles do MT5</li><li><span className="lpTick" aria-hidden="true"><ArrowRight size={14}/></span>Exportação do robô em .mq5</li></ul>
     <button className="lpCta" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
    </div>
    <div className="lpPriceCard reveal">
     <h3>Pago por uso</h3><b className="num">R$ 0,26<em>/indicador</em></b>
     <p>Depois do teste grátis, cada ação tem custo por indicador da estratégia:</p>
     <ul className="lpPriceList">
      <li><span>Criar robô</span><b className="num">R$ 0,26</b></li>
      <li><span>Backtest</span><b className="num">R$ 0,10</b></li>
      <li><span>Otimizador genético</span><b className="num">R$ 0,50</b></li>
     </ul>
     <p className="lpExample">Na prática: uma estratégia com <b>3 indicadores</b> sai por <b className="num">R$ 0,78</b> para criar, <b className="num">R$ 0,30</b> por backtest e <b className="num">R$ 1,50</b> por otimização.</p>
     <p className="lpMicro">Recarga por PIX. O saldo fica na carteira e não vence.</p>
    </div>
   </div>
  </section>

  <section id="objecoes" className="lpSec">
   <h2 className="lpH2 reveal">O que costuma travar a decisão</h2>
   <div className="lpObjList">{LP_OBJ.map(([q,a]:any)=><Objecao key={q} q={q} a={a}/>)}</div>
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
