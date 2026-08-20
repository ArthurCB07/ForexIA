import React,{useEffect,useMemo,useRef,useState}from'react';import{createRoot}from'react-dom/client';import{Database,Activity,Settings,Home,BarChart3,Trophy,DownloadCloud,LineChart as LineIcon,Mic,MicOff,Brain}from'lucide-react';import'./styles.css';
const api=async(u:string,o:any={})=>{
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(), o?.timeoutMs||20000);
  try{
    const r=await fetch(u,{...o,signal:ctrl.signal});
    const txt=await r.text();
    let data:any={};
    try{data=txt?JSON.parse(txt):{}}catch{
      const clean=String(txt||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
      data={ok:false,error:clean||'Resposta inválida'}
    }
    if(!r.ok)throw new Error(data?.error||('HTTP '+r.status));
    return data;
  }finally{clearTimeout(t)}
};const br=(n:any)=>Number(n||0).toLocaleString('pt-BR');const money=(v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

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

type Page='dashboard'|'import'|'datasets'|'viewer'|'builder'|'robots'|'compare'|'lab'|'validation'|'voice'|'ranking'|'setup';type DS={id:string;pair:string;timeframe:string;count:number;first:string;last:string};
function Sidebar({page,setPage}:any){const items:any[]=[
 ['dashboard',Home,'Dashboard'],
 ['import',DownloadCloud,'Smart Import'],
 ['datasets',Database,'Datasets'],
 ['viewer',BarChart3,'Visualizar'],
 ['builder',Brain,'Criar Robô'],
 ['robots',Database,'Meus Robôs'],
 ['compare',LineIcon,'Comparar'],
 ['lab',LineIcon,'Backtest Lab'],
 ['validation',LineIcon,'Validação MT5'],
 ['voice',Brain,'Agente de Voz'],
 ['ranking',Trophy,'Ranking'],
 ['setup',Settings,'Instalação']
];return <aside><div className="brand">🤖 FOREX <span>IA</span></div>{items.map(([id,Icon,label])=><button className={page===id?'active':''} onClick={()=>setPage(id)} key={id}><Icon size={18}/> {label}</button>)}</aside>}
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
function ImportPage({load,o}:any){const[mode,setMode]=useState(o.importConfig?.mode||'quick');async function save(){await api('/api/import/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,years:mode==='quick'?1:5,allowFullImport:mode==='full'})});load()}async function compact(){await api('/api/import/compact',{method:'POST'});load()}return <section><h1>Smart Import</h1><div className="panel"><p><b>Quick:</b> mantém base recente e compacta. <b>Full:</b> mantém histórico completo.</p><select value={mode} onChange={e=>setMode(e.target.value)}><option value="quick">Importação rápida: 1 ano + limites por timeframe</option><option value="full">Importação completa: 5 anos</option></select><button onClick={save}>Salvar modo</button><button onClick={compact}>Compactar banco atual</button></div></section>}
function Datasets({datasets,setPage,setSelected}:any){return <section><h1>Datasets</h1><div className="panel"><table><thead><tr><th>Par</th><th>TF</th><th>Candles</th><th>Início</th><th>Fim</th><th>Ações</th></tr></thead><tbody>{datasets.map((d:DS)=><tr key={d.id}><td>{d.pair}</td><td>{d.timeframe}</td><td>{br(d.count)}</td><td>{d.first}</td><td>{d.last}</td><td><button onClick={()=>{setSelected(d.id);setPage('viewer')}}>Ver</button></td></tr>)}</tbody></table></div></section>}
function Line({values}:{values:number[]}){if(!values?.length)return null;const w=1000,h=330,mn=Math.min(...values),mx=Math.max(...values);const y=(v:number)=>h-((v-mn)/(mx-mn||1))*h;const pts=values.map((v,i)=>`${i/(values.length-1||1)*w},${y(v)}`).join(' ');return <svg className="chart" viewBox={`0 0 ${w} ${h}`}><polyline points={pts} fill="none" stroke="#00e5ff" strokeWidth="3"/></svg>}
function CandleChart({candles=[],trades=[]}:{candles:any[],trades?:any[]}){if(!candles?.length)return <p>Sem candles para gráfico.</p>;const w=1100,h=420,pad=35;const hi=Math.max(...candles.map((c:any)=>c.high)),lo=Math.min(...candles.map((c:any)=>c.low));const y=(v:number)=>pad+(hi-v)/(hi-lo||1)*(h-pad*2);const x=(i:number)=>pad+i/(candles.length-1||1)*(w-pad*2);const cw=Math.max(3,Math.min(9,(w-pad*2)/candles.length*.55));const map=new Map(trades.map((t:any)=>[t.time,t]));return <svg className="candleChart" viewBox={`0 0 ${w} ${h}`}>{[0,1,2,3,4].map(i=><line key={'g'+i} x1={pad} x2={w-pad} y1={pad+i*(h-pad*2)/4} y2={pad+i*(h-pad*2)/4} stroke="#00e5ff22"/>)}{candles.map((c:any,i:number)=>{const up=c.close>=c.open;const cx=x(i),yo=y(c.open),yc=y(c.close),yh=y(c.high),yl=y(c.low),top=Math.min(yo,yc),body=Math.max(2,Math.abs(yo-yc));const t=map.get(c.time);return <g key={i}><line x1={cx} x2={cx} y1={yh} y2={yl} stroke={up?'#36ff8b':'#ff4d6d'} strokeWidth="1.3"/><rect x={cx-cw/2} y={top} width={cw} height={body} fill={up?'#36ff8b':'#ff4d6d'} opacity=".9"/>{t&&<><text x={cx-10} y={t.type==='CALL'?yh-18:yl+26} fill={t.type==='CALL'?'#36ff8b':'#ff4d6d'} fontSize="23" fontWeight="900">{t.type==='CALL'?'▲':'▼'}</text><text x={cx-18} y={t.type==='CALL'?yh-34:yl+44} fill={t.result>0?'#36ff8b':'#ff4d6d'} fontSize="10">{t.result>0?'WIN':'LOSS'}</text></>}</g>})}<text x={pad} y={h-8} fill="#8fb5c6">{candles[0]?.time}</text><text x={w-pad-150} y={h-8} fill="#8fb5c6">{candles[candles.length-1]?.time}</text></svg>}
function BarChart({rows,label='key'}:any){if(!rows?.length)return <p>Sem dados.</p>;const max=Math.max(...rows.map((x:any)=>Math.abs(x.profit)||1));return <div>{rows.map((r:any)=><div className="barrow" key={r[label]||r.key}><span>{r[label]||r.key}</span><div><i className={r.profit>=0?'pos':'neg'} style={{width:(Math.abs(r.profit)/max*100)+'%'}}/></div><b>{money(r.profit)}</b><em>{r.trades} ops • {r.winRate}%</em></div>)}</div>}
function Viewer({datasets,selected,setSelected}:any){const[c,setC]=useState<any[]>([]);useEffect(()=>{if(selected)api('/api/dataset/'+selected+'?limit=260').then(d=>setC(d.candles||[]))},[selected]);return <section><h1>Visualizar</h1><div className="panel"><select value={selected} onChange={e=>setSelected(e.target.value)}>{datasets.map((d:DS)=><option key={d.id} value={d.id}>{d.pair} {d.timeframe} - {br(d.count)}</option>)}</select>{c.length>0&&<CandleChart candles={c}/>}<table><tbody>{c.slice(-10).reverse().map((x:any)=><tr key={x.i}><td>{x.time}</td><td>{x.open}</td><td>{x.high}</td><td>{x.low}</td><td>{x.close}</td><td>RSI {Number(x.rsi14||0).toFixed(1)}</td></tr>)}</tbody></table></div></section>}
function Metric({name,value}:any){return <div><span>{name}</span><b>{value}</b></div>}
function LoadingOverlay({show,text='Processando...'}:any){return show?<div className="loadingOverlay"><div className="loaderCard"><div className="spinner"></div><b>{text}</b><p>A inteligência artificial está processando os candles e comparando os sinais. Aguarde, não clique novamente.</p></div></div>:null}

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
function VoiceAgent({apply}:any){const[text,setText]=useState(''),[parsed,setParsed]=useState<any>(null),[listening,setListening]=useState(false);const recRef=useRef<any>(null);function start(){const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR){alert('Seu navegador não liberou reconhecimento de voz. Use Chrome/Edge.');return}const rec=new SR();rec.lang='pt-BR';rec.continuous=false;rec.interimResults=false;rec.onresult=(e:any)=>{const tx=e.results[0][0].transcript;setText(tx);setParsed(parseVoiceToStrategy(tx));setListening(false)};rec.onerror=()=>setListening(false);rec.onend=()=>setListening(false);recRef.current=rec;setListening(true);rec.start()}function manual(){setParsed(parseVoiceToStrategy(text))}return <div className="panel voiceBox"><h2>Agente de Voz</h2><p>Exemplo: “Crie uma estratégia com EMA das 8 às 18” ou “usar RSI das 9 às 12”.</p><div className="voiceControls"><button onClick={start}>{listening?<MicOff/>:<Mic/>} {listening?'Ouvindo...':'Falar estratégia'}</button><button onClick={manual}>Interpretar texto</button></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Digite ou fale a estratégia aqui..."/>{parsed&&<div className="parsed"><b>Estratégia detectada:</b> Robô por Voz<br/><b>Indicadores:</b> {parsed.voiceStrategy?.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')}<br/><b>Horário:</b> {parsed.startHour} até {parsed.endHour}<br/><p>{parsed.explanation}</p><button onClick={()=>apply(parsed)}>Aplicar no Backtest Lab</button></div>}</div>}

function RobotBuilder({datasets,selected,setPage,setSelected,setVoiceConfig,voiceConfig}:any){
 const [name,setName]=useState('Robo_EMA_RSI');
 const [datasetId,setDatasetId]=useState(selected);
 const [indicators,setIndicators]=useState<any[]>([{type:'ema',period:20},{type:'rsi',period:14}]);
 const [mode,setMode]=useState('trend');
 const [filters,setFilters]=useState<any>({startHour:'00:00',endHour:'23:59'});
 const [saved,setSaved]=useState<any>(null); const [loading,setLoading]=useState(false); const [loadingText,setLoadingText]=useState('Processando...'); const [error,setError]=useState('');
 function addIndicator(){setIndicators([...indicators,{type:'ema',period:20}])}
 function updateIndicator(i:number,k:string,v:any){const arr=[...indicators];arr[i]={...arr[i],[k]:k==='period'?+v:v};setIndicators(arr)}
 function removeIndicator(i:number){setIndicators(indicators.filter((_,idx)=>idx!==i))}
 const voiceStrategy={mode,indicators};
 useEffect(()=>{if(voiceConfig?.voiceStrategy){setIndicators(voiceConfig.voiceStrategy.indicators||indicators);setMode(voiceConfig.voiceStrategy.mode||'trend');setFilters((f:any)=>({...f,startHour:voiceConfig.startHour||f.startHour,endHour:voiceConfig.endHour||f.endHour}))}},[voiceConfig]);
useEffect(()=>{loadCurrentRobot()},[]);
async function loadCurrentRobot(){
 try{
   const r=await api('/api/robots/current');
   if(r?.currentRobot){
     const j=r.currentRobot.json||{};
     const payload={id:r.currentRobot.id,name:j.name||r.currentRobot.name,voiceStrategy:j.voiceStrategy||{mode:'trend',indicators:[]},filters:j.filters||{startHour:'00:00',endHour:'23:59'},raw:j};
     setSelectedRobot(payload);setStrategy('voice');setVoiceStrategy(payload.voiceStrategy);
     setFilters((f:any)=>({...f,startHour:payload.filters.startHour||f.startHour,endHour:payload.filters.endHour||f.endHour}));
   }
 }catch(e){}
}

 const strategyPayload={name,voiceStrategy,filters,strategy:'voice'};
 async function save(){
   setError(''); setLoading(true); setLoadingText('Salvando robô...');
   try{
     const r=await api('/api/strategy/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(strategyPayload)});
     if(!r.ok) throw new Error(r.error||'Falha ao salvar');
     setSaved(r.strategy);
     alert('Robô salvo com sucesso. Acesse Meus Robôs.');
   }catch(e:any){setError(e.message||'Erro ao salvar robô')}
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
 <div className="panel"><h2>Indicadores do robô</h2>{indicators.map((ind:any,i:number)=><div className="indicatorRow" key={i}><select value={ind.type} onChange={e=>updateIndicator(i,'type',e.target.value)}><optgroup label="Tendência"><option value="ema">EMA</option><option value="sma">SMA</option><option value="wma">WMA</option><option value="hma">HMA</option><option value="vwap">VWAP</option><option value="supertrend">SuperTrend</option><option value="ichimoku">Ichimoku</option><option value="alligator">Alligator</option><option value="adx">ADX</option></optgroup><optgroup label="Momentum"><option value="rsi">RSI</option><option value="macd">MACD</option><option value="stochastic">Stochastic</option><option value="cci">CCI</option><option value="roc">ROC</option><option value="momentum">Momentum</option><option value="williams">Williams %R</option></optgroup><optgroup label="Volatilidade"><option value="atr">ATR</option><option value="bollinger">Bollinger Bands</option><option value="keltner">Keltner</option><option value="donchian">Donchian</option></optgroup><optgroup label="Volume"><option value="obv">OBV</option><option value="mfi">MFI</option><option value="volume profile">Volume Profile</option></optgroup><optgroup label="Preço"><option value="suporte">Suporte</option><option value="resistência">Resistência</option><option value="rompimento">Rompimento</option><option value="pullback">Pullback</option><option value="candlestick">Candlestick</option></optgroup></select><input type="number" value={ind.period||14} onChange={e=>updateIndicator(i,'period',e.target.value)} /><button onClick={()=>removeIndicator(i)}>Remover</button></div>)}<button onClick={addIndicator}>+ Adicionar indicador</button></div>
 <div className="panel"><h2>Resumo do robô</h2><pre>{JSON.stringify(strategyPayload,null,2)}</pre><button disabled={loading} onClick={save}>{loading?'Aguarde...':'Salvar Estratégia'}</button><button disabled={loading} onClick={applyBacktest}>Fazer Backtest na Plataforma</button><button disabled={loading} onClick={exportMt5}>Gerar Arquivo MT5 (.mq5)</button>{error&&<p className="warn">{error}</p>}{saved&&<p className="ok">Estratégia salva: {saved.name}</p>}</div></section>
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

function BacktestLab({datasets,selected,voiceConfig,setVoiceConfig,selectedRobot,setSelectedRobot}:any){const[id,setId]=useState(selected),[strategy,setStrategy]=useState('ema'),[result,setResult]=useState<any>(null);const[filters,setFilters]=useState<any>({startDate:'',endDate:'',startHour:'00:00',endHour:'23:59',weekdays:[1,2,3,4,5]});const[expiration,setExpiration]=useState(1),[payout,setPayout]=useState(.85),[stake,setStake]=useState(1),[initial,setInitial]=useState(100),[voiceStrategy,setVoiceStrategy]=useState<any>(null);const[robots,setRobots]=useState<any[]>([]),[robotId,setRobotId]=useState(''),[showAdvanced,setShowAdvanced]=useState(false);const{meta,preview}=useDatasetMeta(id,filters);
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
 async function run(){if(preview&&preview.count===0){alert('O filtro deixou 0 candles. Ajuste data ou horário.');return}setBtLoading(true);try{const bt=await api('/api/backtest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({datasetId:id,strategy,voiceStrategy,expiration,payout,stake,initial,filters})}); setResult(bt); if(selectedRobot?.id&&bt?.result?.trades){await fetch('/api/validation/platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:selectedRobot.id,robotId:selectedRobot.id,trades:bt.result.trades})})}}finally{setBtLoading(false)}}
 const[btLoading,setBtLoading]=useState(false);const m=result?.result?.metrics;const diag=result?.result?.diagnostic;
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
}<h2>Período</h2><div className="quickBtns"><button onClick={()=>setQuick(30)}>Últimos 30 dias</button><button onClick={()=>setQuick(90)}>3 meses</button><button onClick={()=>setQuick(180)}>6 meses</button><button onClick={()=>setQuick(365)}>1 ano</button><button onClick={()=>meta&&setFilters({...filters,startDate:meta.firstDate,endDate:meta.lastDate})}>Todo período</button></div><div className="grid"><label>Data inicial<input type="date" min={meta?.firstDate||''} max={meta?.lastDate||''} value={filters.startDate} onChange={e=>setFilters({...filters,startDate:e.target.value})}/></label><label>Data final<input type="date" min={meta?.firstDate||''} max={meta?.lastDate||''} value={filters.endDate} onChange={e=>setFilters({...filters,endDate:e.target.value})}/></label><label>Hora inicial<input type="time" value={filters.startHour} onChange={e=>setFilters({...filters,startHour:e.target.value})}/></label><label>Hora final<input type="time" value={filters.endHour} onChange={e=>setFilters({...filters,endHour:e.target.value})}/></label></div>{voiceStrategy&&<div className='parsed'><b>Robô carregado no Backtest:</b> {voiceStrategy.indicators?.map((x:any)=>x.type.toUpperCase()+' '+(x.period||'')).join(', ')} • modo {voiceStrategy.mode}</div>}{preview&&<div className={preview.ok?'preview ok':'preview warn'}>Prévia: {br(preview.afterFilters)} candles após filtros de {br(preview.total)} totais.</div>}<button disabled={btLoading || (preview&&preview.count===0)} onClick={run}>{btLoading?'Executando...':'Executar Backtest do Robô'}</button></div>
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
 <div className="panel"><h2>Objetivo</h2><p>Comparar a plataforma e o MetaTrader operação por operação. O alvo inicial é bater <b>horário + direção</b>; depois lucro financeiro.</p><div className='testAudit'><b>v107 Stable</b><br/>Importação somente por Run ID, sem cache antigo. Aguarda o CSV ficar estável para evitar travamento e evitar comparar robôs diferentes.</div></div>
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
function Ranking(){const[items,setItems]=useState<any[]>([]);useEffect(()=>{api('/api/backtests').then(setItems)},[]);return <section><h1>Ranking</h1>{items.map(x=><div className="rank" key={x.id}><h3>{x.pair} {x.timeframe}</h3><p>{x.result.metrics.score}/100 • Win {x.result.metrics.winRate}% • Lucro {money(x.result.metrics.profit)} • PF {x.result.metrics.profitFactor}</p></div>)}</section>}
function Setup(){return <section><h1>Instalação</h1><div className="panel"><h2>Migrar dados</h2><pre>1) Feche a v26 com CTRL+C
2) Copie a pasta data da versão anterior
3) Cole em C:\\forex_ia_studio_v27
4) Rode npm install e npm start</pre><h2>MT5</h2><p>Pode continuar com EA v24/v25/v26. WebRequest para <b>http://127.0.0.1:3001</b>.</p></div></section>}
function App(){const[page,setPage]=useState<Page>('dashboard'),[o,setO]=useState<any>({}),[status,setStatus]=useState<any[]>([]),[datasets,setDatasets]=useState<DS[]>([]),[selected,setSelected]=useState(''),[voiceConfig,setVoiceConfig]=useState<any>(null),[selectedRobot,setSelectedRobot]=useState<any>(null);async function load(){
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
useEffect(()=>{load();const t=setInterval(load,8000);return()=>clearInterval(t)},[]);function applyVoice(cfg:any){setVoiceConfig(cfg);setPage('builder')}return <div className="app"><Sidebar page={page} setPage={setPage}/><main><ErrorBoundary>{page==='dashboard'&&<Dashboard o={o} status={status}/>} {page==='import'&&<ImportPage load={load} o={o}/>} {page==='datasets'&&<Datasets datasets={datasets} setPage={setPage} setSelected={setSelected}/>} {page==='viewer'&&<Viewer datasets={datasets} selected={selected} setSelected={setSelected}/>} {page==='builder'&&<RobotBuilder datasets={datasets} selected={selected} setPage={setPage} setSelected={setSelected} setVoiceConfig={setVoiceConfig} voiceConfig={voiceConfig}/>} {page==='compare'&&<RobotCompare datasets={datasets} setPage={setPage} setSelected={setSelected} setVoiceConfig={setVoiceConfig} setSelectedRobot={setSelectedRobot}/>} {page==='robots'&&<RobotsVault setPage={setPage} setVoiceConfig={setVoiceConfig} setSelected={setSelected} setSelectedRobot={setSelectedRobot} datasets={datasets}/>} {page==='lab'&&<BacktestLab datasets={datasets} selected={selected} voiceConfig={voiceConfig} setVoiceConfig={setVoiceConfig} selectedRobot={selectedRobot} setSelectedRobot={setSelectedRobot}/>} {page==='validation'&&<ValidationMT5/>} {page==='voice'&&<VoicePage apply={applyVoice}/>} {page==='ranking'&&<Ranking/>} {page==='setup'&&<Setup/>}</ErrorBoundary></main></div>}
createRoot(document.getElementById('root')!).render(<App/>);
