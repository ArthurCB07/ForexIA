import React,{useEffect,useState}from'react';
import{ShieldCheck}from'lucide-react';
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
