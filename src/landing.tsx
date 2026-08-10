import React,{useEffect,useState}from'react';
import{ShieldCheck,DownloadCloud,Brain,Mic,FlaskConical,Dna,RadioTower,Trophy,ArrowRight}from'lucide-react';
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
function ReconPanel(){
 return <div className="lpRecon">
  <div className="lpReconHead"><b>Mesma estratégia, mesmo período</b><em>números ilustrativos</em></div>
  <div className="lpReconCols"><span/><span>Forex IA Studio</span><span>MT5 Strategy Tester</span></div>
  {LP_RECON.map(([label,a,b]:any)=><div className="lpReconRow" key={label}>
   <i>{label}</i><b className="num">{a}</b><b className="num">{b}</b>
  </div>)}
  <div className="lpReconSeal"><ShieldCheck size={16}/> Conferido operação por operação</div>
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
export default function Landing({setSession}:any){
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
    <span className="lpBadge">1º robô e 1º backtest grátis</span>
    <h1>O backtest só vale se bater com o do <span>MetaTrader 5</span>.</h1>
    <p>Importe os candles do seu próprio broker pela ponte EA, monte a estratégia sem código, otimize com algoritmo genético e exporte o Expert Advisor. Depois coloque os números lado a lado com o Strategy Tester.</p>
    <div className="lpHeroBtns">
     <button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
     <button className="lpGhost lpBig" onClick={ir('como')}>Ver como funciona</button>
    </div>
    <p className="lpMicro">Sem mensalidade · você paga por uso · recarga por PIX</p>
   </div>
   <div className="lpHeroArt"><ReconPanel/></div>
  </section>

  <section className="lpStrip">
   <div><b className="num">.mq5</b><span>Expert Advisor exportado, compilável no seu MT5</span></div>
   <div><b className="num">R$ 0,26</b><span>por indicador para criar — sem mensalidade</span></div>
   <div><b className="num">0</b><span>linhas de MQL5 escritas por você</span></div>
   <div><b className="num">100%</b><span>da execução dentro do seu MetaTrader 5</span></div>
  </section>

  <section id="como" className="lpSec">
   <h2 className="lpH2">Do primeiro candle ao robô compilado, em quatro etapas</h2>
   <p className="lpSub">Nenhuma delas exige programação. Você decide a lógica; a plataforma gera o código.</p>
   <div className="lpSteps">{LP_STEPS.map(([n,t,d]:any)=><div className="lpStep" key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></div>)}</div>
  </section>

  <section id="recursos" className="lpSec">
   <h2 className="lpH2">Cada etapa deixa um número que você pode conferir</h2>
   <p className="lpSub">Da importação dos candles ao robô rodando em conta real.</p>
   <div className="lpFeat">{LP_FEATURES.map(([Ico,cat,t,d]:any)=><div className="lpCard" key={t}><span className={'lpIco '+cat}><Ico size={22} strokeWidth={2.2}/></span><h3>{t}</h3><p>{d}</p></div>)}</div>
  </section>

  <section id="precos" className="lpSec">
   <h2 className="lpH2">Você só paga pelo que usar</h2>
   <p className="lpSub">Sem plano mensal, sem fidelidade. O preço é por indicador usado na estratégia.</p>
   <div className="lpPrice">
    <div className="lpPriceCard lpHighlight">
     <span className="lpTag">Comece aqui</span>
     <h3>Grátis</h3><b>R$ 0</b>
     <p>1ª criação de robô e 1º backtest por conta, sem cartão.</p>
     <ul><li><span className="lpTick"><ArrowRight size={14}/></span>Acesso a todas as telas</li><li><span className="lpTick"><ArrowRight size={14}/></span>Importação de candles do MT5</li><li><span className="lpTick"><ArrowRight size={14}/></span>Exportação do robô em .mq5</li></ul>
     <button className="lpCta" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
    </div>
    <div className="lpPriceCard">
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
   <h2 className="lpH2">O que costuma travar a decisão</h2>
   <div className="lpFaq">{LP_OBJ.map(([q,a]:any)=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
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
