import React,{useEffect,useState}from'react';
import{AuthCard}from'./main';
import{Mark,Wordmark}from'./brand';
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
export default function Landing({setSession}:any){
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
