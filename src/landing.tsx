import React,{useEffect,useId,useState,useRef}from'react';
import{ShieldCheck,DownloadCloud,Brain,Mic,FlaskConical,Dna,RadioTower,Trophy,ArrowRight,Lock,Activity,Check,MessageCircle,Link2,CalendarClock}from'lucide-react';
import{AuthCard}from'./main';
import{Wordmark,Robo3D}from'./brand';
// v126 — Landing Page pública. É a única tela visível sem sessão: o sistema fica atrás dela.
// Painel-assinatura do hero: as mesmas métricas medidas nos dois lados.
// Números ilustrativos — a página deixa isso explícito no rótulo.
const LP_RECON:any[]=[
 ['Operações','842','842'],
 ['Taxa de acerto','61,2%','61,2%'],
 ['Profit factor','1,74','1,74'],
 ['Drawdown','8,3%','8,3%'],
];
// Ponto único de leitura do prefers-reduced-motion — useReveal e useCountUp consultavam a
// media query cada um por conta própria; centralizado aqui para não duplicar a string.
function prefereMovimentoReduzido(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches}
// Revela os elementos .reveal uma única vez quando entram na viewport.
// Um observer só para a página toda; nada de listener de scroll.
function useReveal(){
 useEffect(()=>{
  if(prefereMovimentoReduzido()){document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));return}
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
  if(prefereMovimentoReduzido()){setTxt(alvo);return}
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
function ReconRow({label,a,b,ativo}:any){
 const va=useCountUp(a,ativo), vb=useCountUp(b,ativo);
 return <div className="lpReconRow"><i>{label}</i><b className="num">{va}</b><b className="num">{vb}</b></div>;
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
  {LP_RECON.map(([label,a,b]:any)=><ReconRow key={label} label={label} a={a} b={b} ativo={ativo}/>)}
  <div className={'lpReconSeal'+(ativo?' on':'')}><ShieldCheck size={16} aria-hidden="true"/> Conferido operação por operação</div>
 </div>;
}
// As três camadas de prova. A ordem é o produto: cada uma só libera a seguinte.
// Números ilustrativos — o painel diz isso no rótulo.
const LP_CAMADAS:any[]=[
 ['01','Passado','Backtest no histórico da sua própria corretora','ok','Reconciliado com o Strategy Tester do MT5'],
 ['02','Presente','30 dias operando na conta demo da corretora','ativo','Dia 18 de 30 · acumulado +R$ 412,60'],
 ['03','Futuro','Execução automática na sua conta real','travado','Destrava quando o passo 02 (Presente) fechar no positivo'],
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
 ['01','Monte a estratégia','Escolha indicadores e escreva as regras de entrada e saída na tela — ou dite a estratégia para o agente de voz e revise o que ele montou. Sem escrever uma linha de código.'],
 ['02','Teste no passado','Rode o backtest sobre o histórico da sua própria corretora e deixe o otimizador genético varrer gerações de parâmetros até achar o conjunto que sustenta o resultado.'],
 ['03','Prove no presente','Coloque o robô 30 dias na conta demo da sua corretora. Todo dia o relatório chega no WhatsApp com as operações, o resultado e o drawdown.'],
 ['04','Libere o real','Passados os 30 dias com resultado consistente, vincule a conta real e o robô executa sozinho — com o mesmo relatório diário chegando.'],
];
const LP_FEATURES:any[]=[
 [DownloadCloud,'d','Smart Import','Os candles vêm da sua própria corretora pela ponte EA, com deduplicação automática e progresso por par e timeframe. Você não baixa CSV de lugar nenhum.'],
 [Brain,'c','Criar robô sem código','Médias, RSI, MACD, Bollinger, estocástico e mais, combinados em regras de entrada e saída explícitas. O MQL5 é gerado no fim.'],
 [Mic,'c','Agente de voz','Descreva a estratégia falando em português. O agente monta a configuração e devolve para você revisar antes de salvar.'],
 [FlaskConical,'a','Backtest Lab','Curva de capital, drawdown, profit factor, taxa de acerto e a lista completa de operações do período — não só o número final.'],
 [Dna,'a','Otimizador genético','Gerações de parâmetros avaliadas contra o histórico até convergir. Você define população, gerações, mínimo de trades e teto de drawdown.'],
 [ShieldCheck,'p','Validação MT5','Compare o backtest da plataforma com o do Strategy Tester, operação por operação, e veja onde os dois divergem.'],
 [RadioTower,'p','Teste real','Telemetria de conta, posições e ordens do robô em demo ou real. O EA executa; a plataforma só observa.'],
 [Trophy,'a','Ranking e comparação','Coloque robôs lado a lado no mesmo dataset e no mesmo período para ver qual sustenta o resultado.'],
 [MessageCircle,'p','Relatório no WhatsApp','O fechamento de cada dia chega no seu telefone: operações, resultado, saldo e drawdown. Você não precisa abrir a plataforma para saber como foi.'],
 [Link2,'p','Corretora vinculada','Conecte a conta da sua corretora e o robô passa a executar as ordens sozinho, seguindo exatamente a estratégia que você validou.'],
 [CalendarClock,'a','30 dias em demo','Antes de qualquer dinheiro real, o robô opera um mês inteiro em conta demo. Se não sustentar o resultado ali, você descobre sem pagar por isso.'],
];
const LP_OBJ:any[]=[
 ['O robô vai operar sozinho com o meu dinheiro?','Depende da rota que você escolher, e a escolha é sua. Na rota MetaTrader 5, quem executa é o Expert Advisor rodando dentro do seu terminal: a plataforma cria, testa, otimiza e monitora, sem ficar no caminho da ordem. Na rota de corretora vinculada, a plataforma envia as ordens que a estratégia gerar, seguindo exatamente a configuração que você validou nos 30 dias. Nas duas, o robô só sai da conta demo quando você liberar.',['como','Ver os quatro passos até a conta real']],
 ['E se o robô perder dinheiro nos 30 dias de teste?','Você descobre isso em conta demo, com dinheiro que não existe. É exatamente para isso que o teste serve. O robô só vai para a conta real depois que você olhar o resultado do mês e decidir liberar — a decisão é sua, não automática.',['prova','Ver como fica na prática']],
 ['O que a plataforma acessa na minha corretora?','O vínculo serve para enviar as ordens que a sua estratégia gerar e ler as posições e o saldo para montar o relatório. A estratégia que executa é a que você validou nos 30 dias, e você desfaz o vínculo quando quiser.'],
 ['E se o backtest da plataforma não bater com o do MT5?','Aí você não deveria confiar nele — e é por isso que a tela de Validação MT5 existe. Ela coloca os dois lado a lado, operação por operação, começando por horário e direção. Divergência aparece, não fica escondida.',['recursos','Ver a tela de Validação MT5']],
 ['Preciso saber programar?','Não. A estratégia é montada por indicadores e regras na tela, ou ditada por voz. O código MQL5 do Expert Advisor é gerado pela plataforma no fim do processo.'],
 ['Funciona com a minha corretora?','São duas rotas. Se a sua corretora oferece MetaTrader 5, você instala a ponte e o robô opera pelo seu próprio terminal. Se você prefere que a plataforma execute direto, a corretora precisa estar na lista de vínculo — hoje a IQ Option. As duas rotas usam a mesma estratégia e o mesmo teste de 30 dias.',['corretora','Ver as corretoras e as duas rotas']],
 ['Quanto vou gastar de verdade?','Você paga por ação e por indicador da estratégia. Uma estratégia de 3 indicadores custa R$ 0,78 para criar, R$ 0,30 por backtest e R$ 1,50 por otimização. Sem mensalidade, sem fidelidade, recarga por PIX quando quiser.',['precos','Ver a tabela de preços']],
 ['Meus dados ficam onde?','A base de candles e os robôs ficam no seu ambiente. Conta e carteira são autenticadas por token, e as chaves sensíveis do servidor nunca chegam ao navegador.'],
];
// `leva` (opcional) manda para a seção que responde a pergunta por inteiro — a resposta curta
// resolve a dúvida, o link resolve o assunto.
function Objecao({q,a,leva,ir}:any){
 const[open,setOpen]=useState(false), ref=useRef<any>(null), [h,setH]=useState(0), uid=useId(), btnId=uid+'-btn', bodyId=uid+'-body';
 useEffect(()=>{
  let vivo=true;
  const medir=()=>{if(vivo)setH(ref.current?.scrollHeight||0)};
  medir();
  window.addEventListener('resize',medir);
  document.fonts?.ready?.then(medir); // recalcula depois da troca de fonte (@fontsource carrega os woff2 async)
  return()=>{vivo=false;window.removeEventListener('resize',medir)};
 },[]);
 return <div className={'lpObj'+(open?' open':'')}>
  <button type="button" id={btnId} aria-expanded={open} aria-controls={bodyId} onClick={()=>setOpen(o=>!o)}><span>{q}</span><i/></button>
  <div className="lpObjBody" id={bodyId} role="region" aria-labelledby={btnId} style={{height:open?h+'px':'0px'}} ref={ref}><p>{a}</p>{leva&&<p className="lpObjLink"><a href={'#'+leva[0]} onClick={ir(leva[0])}>{leva[1]}</a></p>}</div>
 </div>;
}
// Exemplo do relatório diário que o robô envia. Valores ilustrativos.
const LP_RELATORIO:any[]=[
 ['Operações do dia','3 operações · 2 ganhos · 1 perda'],
 ['Resultado','+R$ 84,30'],
 ['Saldo','R$ 5.412,60'],
 ['Drawdown','3,1%'],
];
function Relatorio(){
 return <div className="lpRel">
  <div className="lpRelHead"><b>Relatório diário · EURUSD M5</b><em>exemplo</em></div>
  {LP_RELATORIO.map(([k,v]:any)=><div className="lpRelLinha" key={k}><span>{k}</span><b className="num">{v}</b></div>)}
  <p className="lpRelPe">Enviado todo dia no fechamento, direto no seu WhatsApp.</p>
 </div>;
}
// Corretoras conectáveis. Lista fornecida pelo cliente — não acrescente nomes.
const LP_CORRETORAS:any[]=[
 ['IQ Option','/corretoras/iq-option.png'],
];
function Corretoras(){
 const varias=LP_CORRETORAS.length>1;
 const trilha=varias?[...LP_CORRETORAS,...LP_CORRETORAS]:LP_CORRETORAS;
 return <div className={'lpBrokers'+(varias?'':' soUma')}>
  <p className="lpBrokersTit">Conecte a sua corretora</p>
  <div className={'lpBrokersJanela'+(varias?' rola':'')}>
   <div className="lpBrokersTrilha">
    {trilha.map(([nome,src]:any,i:number)=><div className="lpBroker" key={nome+i}>
     <img src={src} alt="" loading="lazy" onError={(e:any)=>{e.currentTarget.style.display='none';e.currentTarget.parentElement.classList.add('semLogo')}}/>
     <b>{nome}</b>
    </div>)}
   </div>
  </div>
 </div>;
}
// Ranking ilustrativo: a página é pública e o ranking real (/api/backtests) é por conta, então
// estes são exemplos rotulados — mesma regra das avaliações. A ordem aqui É informação: cada linha
// só está acima da outra por causa do profit factor.
// [posição, nome, par e timeframe, lucro, profit factor, acerto, drawdown, operações, cor, barras]
// `cor` e `barras` personalizam o robô de cada linha: a altura das três barras do visor acompanha
// a posição no ranking, então o robô do 1º lugar mostra o degrau mais alto.
const LP_RANKING:any[]=[
 ['01','Reversao_Londres','GBPUSD M15','9.870,40','1,86','63,4%','7,1%','742','var(--cy-300)',[6,9,13]],
 ['02','EMA_RSI_Ouro','XAUUSD M5','6.418,05','1,71','58,9%','9,4%','515','var(--tint-a-fg)',[5,8,11]],
 ['03','Tendencia_Asia','USDJPY M15','4.212,80','1,64','61,2%','8,3%','318','var(--tint-c-fg)',[5,7,9]],
 ['04','Rompimento_NY','EURUSD M5','2.640,15','1,42','54,7%','11,8%','196','var(--tint-p-fg)',[4,6,8]],
];
function LinhaRank({dados,i,ativo}:any){
 const[pos,nome,par,lucro,pf,acerto,dd,ops,cor,barras]=dados;
 const valor=useCountUp(lucro,ativo);
 return <li className={'lpRankItem'+(ativo?' on':'')} style={{'--i':i,'--bot':cor} as any}>
  <span className="lpRankPos num" aria-hidden="true">{pos}</span>
  <span className="lpRankBot"><Robo3D size={34} barras={barras}/></span>
  <div className="lpRankNome">
   <b>{nome}</b>
   <span>{par} · {ops} operações</span>
  </div>
  <div className="lpRankLucro">
   <b className="num">+R$ {valor}</b>
   <span>no período testado</span>
  </div>
  <dl className="lpRankMet">
   <div><dt>Profit factor</dt><dd className="num">{pf}</dd></div>
   <div><dt>Acerto</dt><dd className="num">{acerto}</dd></div>
   <div><dt>Drawdown</dt><dd className="num">{dd}</dd></div>
  </dl>
 </li>;
}
function RankingRobos(){
 const ref=useRef<any>(null), [ativo,setAtivo]=useState(false);
 useEffect(()=>{
  const el=ref.current; if(!el)return;
  if(prefereMovimentoReduzido()){setAtivo(true);return}
  const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){setAtivo(true);io.disconnect()}},{threshold:.2});
  io.observe(el);
  const t=setTimeout(()=>setAtivo(true),4000); // mesma rede de segurança das avaliações
  return()=>{io.disconnect();clearTimeout(t)};
 },[]);
 return <ol className="lpRank" ref={ref}>
  {LP_RANKING.map((d:any,i:number)=><LinhaRank key={d[1]} dados={d} i={i} ativo={ativo}/>)}
 </ol>;
}
// ATENÇÃO: personas de exemplo, não são clientes reais. A seção diz isso em dois lugares visíveis
// (selo no topo e nota no rodapé do bloco) — depoimento inventado apresentado como real seria fraude
// de propaganda, e a página inteira já segue o padrão de rotular o que é ilustrativo.
// [nome, iniciais, meta, texto, lucro, cenário, estrelas, curva de capital (0..100)]
const LP_AVALIACOES:any[]=[
 ['Marina A.','MA','Curitiba · usa há 8 meses','Eu travava na hora de deixar o robô sozinho. Ver o backtest bater com o Strategy Tester operação por operação foi o que me convenceu a ligar na conta real.','4.212,80','EURUSD M5 · 6 meses · 318 operações',5,[8,14,11,22,26,21,34,39,36,48,55,52,64,71,68,80,88,100]],
 ['Rogério P.','RP','Belo Horizonte · usa há 1 ano','O relatório no WhatsApp é o que me segura. Todo dia às 18h eu sei o que aconteceu sem precisar abrir a plataforma nem olhar gráfico.','9.870,40','GBPUSD M15 · 1 ano · 742 operações',5,[6,10,18,15,24,31,28,40,47,44,53,61,58,70,77,84,92,100]],
 ['Camila D.','CD','Recife · usa há 5 meses','Rodei os 30 dias na demo, o robô ficou no vermelho e eu não coloquei um real. Ajustei os parâmetros no otimizador, refiz o teste e só então liberei.','2.640,15','USDJPY M5 · 4 meses · 196 operações',4,[12,9,16,13,20,28,25,33,30,41,49,46,57,63,60,72,86,100]],
];
// Inclinação 3D seguindo o ponteiro. Publica --rx/--ry (rotação) e --gx/--gy (posição do brilho)
// no próprio cartão: o CSS faz o resto, sem re-render do React a cada mousemove.
function useTilt(max=10){
 const ref=useRef<any>(null);
 const mover=(e:any)=>{
  const el=ref.current; if(!el||prefereMovimentoReduzido())return;
  const r=el.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
  el.style.setProperty('--ry',((px-.5)*2*max).toFixed(2)+'deg');
  el.style.setProperty('--rx',((.5-py)*2*max).toFixed(2)+'deg');
  el.style.setProperty('--gx',(px*100).toFixed(1)+'%');
  el.style.setProperty('--gy',(py*100).toFixed(1)+'%');
 };
 const sair=()=>{const el=ref.current;if(!el)return;el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg')};
 return{ref,onMouseMove:mover,onMouseLeave:sair};
}
function Avaliacao({dados,i,ativo}:any){
 const[nome,iniciais,meta,texto,lucro,cenario,estrelas,curva]=dados;
 const tilt=useTilt(9);
 const valor=useCountUp(lucro,ativo);
 const pontos=curva.map((v:number,k:number)=>(k/(curva.length-1)*100).toFixed(1)+','+(40-v*0.36).toFixed(1)).join(' ');
 return <article className={'lpProvaCard'+(ativo?' on':'')} style={{'--i':i} as any} ref={tilt.ref} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave}>
  <div className="lpProvaBrilho" aria-hidden="true"/>
  <header className="lpProvaTopo">
   <span className="lpAvatar" aria-hidden="true"><i/><b>{iniciais}</b></span>
   <div><b>{nome}</b><span>{meta}</span></div>
  </header>
  <div className="lpEstrelas" aria-label={estrelas+' de 5'}>{[1,2,3,4,5].map(n=><span key={n} className={n<=estrelas?'on':''} style={{'--i':n} as any} aria-hidden="true">★</span>)}</div>
  <p className="lpProvaTxt">“{texto}”</p>
  <div className="lpLucro">
   <div className="lpLucroFrente">
    <span>Resultado no período</span>
    <b className="num">+R$ {valor}</b>
    <em>{cenario}</em>
   </div>
   <div className="lpLucroVerso" aria-hidden="true">
    <span>Curva de capital</span>
    <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="lpSpark"><polyline points={pontos}/></svg>
    <em>Exemplo ilustrativo · passe o mouse para ver</em>
   </div>
  </div>
 </article>;
}
function Avaliacoes(){
 const ref=useRef<any>(null), [ativo,setAtivo]=useState(false);
 useEffect(()=>{
  const el=ref.current; if(!el)return;
  if(prefereMovimentoReduzido()){setAtivo(true);return}
  const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){setAtivo(true);io.disconnect()}},{threshold:.25});
  io.observe(el);
  // Rede de segurança: os cartões entram com opacity:0 e só o observer os revela. Se ele não
  // disparar (aba em segundo plano, navegador exótico), a seção ficaria invisível — o que é pior
  // do que perder a animação.
  const t=setTimeout(()=>setAtivo(true),4000);
  return()=>{io.disconnect();clearTimeout(t)};
 },[]);
 return <div className="lpProvaCena" ref={ref}>
  {LP_AVALIACOES.map((d:any,i:number)=><Avaliacao key={d[0]} dados={d} i={i} ativo={ativo}/>)}
 </div>;
}

export default function Landing({setSession}:any){
 useReveal();
 const[auth,setAuth]=useState<'login'|'signup'|null>(null);
 const modalRef=useRef<any>(null);
 // A barra é sticky e no mobile ela cresce (os links viram uma faixa embaixo). Sem publicar a altura
 // real, a âncora parava com o título escondido atrás dela — no celular sumia o h2 inteiro.
 useEffect(()=>{
  const medir=()=>{const nav=document.querySelector('.lpNav') as HTMLElement|null;document.documentElement.style.setProperty('--lpNavH',(nav?.offsetHeight||73)+'px')};
  medir();window.addEventListener('resize',medir);return()=>window.removeEventListener('resize',medir);
 },[]);
 // Modal: trava a rolagem do fundo, joga o foco pra dentro, prende o Tab no diálogo e devolve o
 // foco pro botão que abriu. Sem isso o teclado percorria a landing inteira antes do formulário.
 useEffect(()=>{
  if(!auth)return;
  const anterior=document.activeElement as HTMLElement|null;
  document.body.classList.add('navLock');
  const foco=()=>{const alvo=(modalRef.current?.querySelector('input')||modalRef.current?.querySelector('button'))as HTMLElement|null;alvo?.focus()};
  const t=setTimeout(foco,0);
  const tecla=(e:any)=>{
   if(e.key==='Escape'){setAuth(null);return}
   if(e.key!=='Tab')return;
   const foco=modalRef.current?.querySelectorAll('a[href],button:not([disabled]),input,select,textarea');
   if(!foco?.length)return;
   const primeiro=foco[0] as HTMLElement,ultimo=foco[foco.length-1] as HTMLElement;
   if(e.shiftKey&&document.activeElement===primeiro){e.preventDefault();ultimo.focus()}
   else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primeiro.focus()}
  };
  window.addEventListener('keydown',tecla);
  return()=>{clearTimeout(t);window.removeEventListener('keydown',tecla);document.body.classList.remove('navLock');anterior?.focus?.()};
 },[auth]);
 // O hash tem que entrar no histórico: sem ele não dá para copiar o link de uma seção nem voltar.
 const ir=(id:string)=>(e:any)=>{e.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'','#'+id)};
 return <div className="lp">
  <header className="lpNav">
   <div className="lpNavIn">
    <Wordmark size={20}/>
    <nav className="lpLinks" aria-label="Seções da página">
     <a href="#como" onClick={ir('como')}>Como funciona</a>
     <a href="#recursos" onClick={ir('recursos')}>Recursos</a>
     <a href="#whatsapp" onClick={ir('whatsapp')}>Relatórios</a>
     <a href="#corretora" onClick={ir('corretora')}>Corretora</a>
     <a href="#prova" onClick={ir('prova')}>Avaliações</a>
     <a href="#ranking" onClick={ir('ranking')}>Ranking</a>
     <a href="#precos" onClick={ir('precos')}>Preços</a>
     <a href="#objecoes" onClick={ir('objecoes')}>Dúvidas</a>
    </nav>
    <div className="lpNavBtns">
     <button className="lpGhost" onClick={()=>setAuth('login')}>Entrar</button>
     <button className="lpCta" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
    </div>
   </div>
  </header>

  <main id="conteudo">
  <section className="lpHero">
   <div className="lpHeroTxt">
    <span className="lpBadge" style={{'--i':0} as any}>30 dias na conta demo antes de qualquer risco</span>
    <h1 style={{'--i':1} as any}>O passado não garante o futuro. Por isso o robô <span>prova antes</span> de operar com o seu dinheiro.</h1>
    <p style={{'--i':2} as any}>Monte a estratégia sem escrever código, coloque o robô 30 dias na conta demo da sua corretora, acompanhe cada dia pelo relatório no WhatsApp e só então libere a execução automática.</p>
    <div className="lpHeroBtns" style={{'--i':3} as any}>
     <button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
     <button className="lpGhost lpBig" onClick={ir('como')}>Ver como funciona</button>
    </div>
    <p className="lpMicro" style={{'--i':4} as any}>1º robô e 1º backtest grátis · sem mensalidade · recarga por PIX</p>
   </div>
   <div className="lpHeroArt" style={{'--i':3} as any}><Camadas/></div>
  </section>

  <section className="lpStrip">
   <div className="reveal"><b className="num">30</b><span>dias em conta demo antes de qualquer risco</span></div>
   <div className="reveal"><b className="num">R$ 0,26</b><span>por indicador para criar — sem mensalidade</span></div>
   <div className="reveal"><b className="num">0</b><span>linhas de código escritas por você</span></div>
   <div className="reveal"><b className="num">1×</b><span>por dia o relatório chega no seu WhatsApp</span></div>
  </section>

  <section id="como" className="lpSec">
   <h2 className="lpH2 reveal">Quatro etapas entre a ideia e o robô operando</h2>
   <p className="lpSub reveal">Nenhuma delas exige programação, e nenhuma pede que você confie num número sem ter visto o robô operar.</p>
   <div className="lpSteps">{LP_STEPS.map(([n,t,d]:any)=><div className="lpStep reveal" key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></div>)}</div>
   <div className="lpProva reveal">
    <div><h3>O backtest confere com o Strategy Tester</h3><p>A tela de Validação MT5 coloca as duas execuções lado a lado, operação por operação. Divergência aparece — não fica escondida atrás de um número final bonito.</p></div>
    <ReconPanel/>
   </div>
  </section>

  <section id="recursos" className="lpSec">
   <h2 className="lpH2 reveal">Cada etapa deixa um número que você pode conferir</h2>
   <p className="lpSub reveal">Da importação dos candles ao robô rodando em conta real.</p>
   <div className="lpFeat">{LP_FEATURES.map(([Ico,cat,t,d]:any)=><div className="lpCard reveal" key={t}><span className={'lpIco '+cat} aria-hidden="true"><Ico size={22} strokeWidth={2.2}/></span><h3>{t}</h3><p>{d}</p></div>)}</div>
  </section>

  <section id="whatsapp" className="lpSec lpSplit">
   <div>
    <h2 className="lpH2 reveal">O robô te procura. Você não precisa abrir a plataforma.</h2>
    <p className="lpSub reveal">No fechamento de cada dia o relatório chega no seu WhatsApp: quantas operações o robô fez, quanto ganhou ou perdeu, como está o saldo e o quanto o drawdown andou. Se algo sair da curva, você fica sabendo no mesmo dia — não no fim do mês.</p>
   </div>
   <div className="reveal"><Relatorio/></div>
  </section>

  <section id="corretora" className="lpSec">
   <h2 className="lpH2 reveal">Passados os 30 dias, o robô opera sozinho na sua corretora</h2>
   <p className="lpSub reveal">Você vincula a conta uma vez. O robô executa as ordens conforme a estratégia que você validou — e continua mandando o relatório diário.</p>
   <div className="reveal"><Corretoras/></div>
  </section>

  <section id="prova" className="lpSec">
   <h2 className="lpH2 reveal">Como fica na prática</h2>
   <p className="lpSub reveal">Três perfis de uso montados para mostrar o fluxo completo: validação, relatório diário e ajuste no otimizador. <b>São exemplos ilustrativos, não depoimentos de clientes reais.</b></p>
   <Avaliacoes/>
   <p className="lpProvaNota">Personas e valores fictícios, criados para ilustrar o produto. Resultado passado, real ou simulado, não garante resultado futuro.</p>
  </section>

  <section id="ranking" className="lpSec">
   <h2 className="lpH2 reveal">Ranking dos robôs</h2>
   <p className="lpSub reveal">Dentro da plataforma, todo robô testado entra num ranking ordenado por profit factor — não pelo lucro bruto, que qualquer estratégia arriscada infla. <b>Os quatro abaixo são exemplos ilustrativos.</b></p>
   <RankingRobos/>
   <p className="lpProvaNota">Robôs e números fictícios. No seu ranking entram apenas os seus robôs, com os dados do período que você escolher no backtest.</p>
  </section>

  <section id="precos" className="lpSec">
   <h2 className="lpH2 reveal">Você só paga pelo que usar</h2>
   <p className="lpSub reveal">Sem plano mensal, sem fidelidade. O preço é por indicador usado na estratégia.</p>
   <div className="lpPrice">
    <div className="lpPriceCard lpHighlight reveal">
     <span className="lpTag">Comece aqui</span>
     <h3>Grátis</h3><b className="num">R$ 0</b>
     <p>1ª criação de robô e 1º backtest por conta, sem cartão.</p>
     <ul><li><span className="lpTick" aria-hidden="true"><ArrowRight size={14}/></span>Acesso a todas as telas</li><li><span className="lpTick" aria-hidden="true"><ArrowRight size={14}/></span>Importação de candles do MT5</li><li><span className="lpTick" aria-hidden="true"><ArrowRight size={14}/></span>Exportação em .mq5 do robô que você criou no teste grátis</li></ul>
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
     <p className="lpMicro">O teste grátis vale para o 1º robô e o 1º backtest. O otimizador genético é cobrado desde a primeira vez.</p>
     <p className="lpExample">Na prática: uma estratégia com <b>3 indicadores</b> sai por <b className="num">R$ 0,78</b> para criar, <b className="num">R$ 0,30</b> por backtest e <b className="num">R$ 1,50</b> por otimização.</p>
     <p className="lpMicro">Recarga por PIX. O saldo fica na carteira e não vence.</p>
    </div>
   </div>
  </section>

  <section id="objecoes" className="lpSec">
   <h2 className="lpH2 reveal">O que costuma travar a decisão</h2>
   <div className="lpObjList">{LP_OBJ.map(([q,a,leva]:any)=><Objecao key={q} q={q} a={a} leva={leva} ir={ir}/>)}</div>
  </section>

  <section className="lpFinal">
   <h2>O passado não garante o futuro. Comece a construir o seu.</h2>
   <p>Crie a conta, monte o primeiro robô e rode o primeiro backtest sem pagar nada.</p>
   <div className="lpHeroBtns"><button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Criar conta grátis</button><button className="lpGhost lpBig" onClick={()=>setAuth('login')}>Já tenho conta</button></div>
  </section>

  </main>

  <footer className="lpFoot">
   <nav className="lpMapa" aria-label="Mapa da página">
    <div>
     <h3>A plataforma</h3>
     <ul>
      <li><a href="#como" onClick={ir('como')}>Como funciona</a></li>
      <li><a href="#recursos" onClick={ir('recursos')}>O que tem dentro</a></li>
      <li><a href="#whatsapp" onClick={ir('whatsapp')}>Relatório diário</a></li>
      <li><a href="#corretora" onClick={ir('corretora')}>Corretora vinculada</a></li>
     </ul>
    </div>
    <div>
     <h3>Antes de decidir</h3>
     <ul>
      <li><a href="#prova" onClick={ir('prova')}>Como fica na prática</a></li>
      <li><a href="#ranking" onClick={ir('ranking')}>Ranking dos robôs</a></li>
      <li><a href="#precos" onClick={ir('precos')}>Preços por indicador</a></li>
      <li><a href="#objecoes" onClick={ir('objecoes')}>Dúvidas frequentes</a></li>
     </ul>
    </div>
    <div>
     <h3>Sua conta</h3>
     <ul>
      <li><button type="button" onClick={()=>setAuth('signup')}>Criar conta grátis</button></li>
      <li><button type="button" onClick={()=>setAuth('login')}>Entrar</button></li>
      <li><a href="#precos" onClick={ir('precos')}>Recarga por PIX</a></li>
     </ul>
    </div>
   </nav>
   <p className="lpRisk"><b>Aviso de risco:</b> operar no mercado de câmbio envolve risco de perda do capital investido. Resultados de backtest são simulações sobre dados históricos e não garantem desempenho futuro. O Forex IA Studio é uma ferramenta de pesquisa e automação — não presta consultoria nem recomendação de investimento.</p>
   <p>© {new Date().getFullYear()} Forex IA Studio · Robot Wizard</p>
  </footer>

  {auth&&<div className="lpModal" role="dialog" aria-modal="true" aria-labelledby="authTitulo" ref={modalRef} onClick={e=>{if(e.target===e.currentTarget)setAuth(null)}}>
   <AuthCard setSession={setSession} initialMode={auth} onClose={()=>setAuth(null)}/>
  </div>}
 </div>
}
