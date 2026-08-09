
require('dotenv').config();
const express=require('express'),cors=require('cors'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {v4:uuidv4}=require('uuid');
const DATA_DIR = path.join(__dirname,'data');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
const app=express(),PORT=process.env.API_PORT||3001,VERSION='124.0.0';
const DATA=path.join(__dirname,'data'),DB=path.join(DATA,'db.json'),SETS=path.join(DATA,'datasets');
for(const p of [DATA,SETS]) if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true});
if(!fs.existsSync(DB)) fs.writeFileSync(DB,JSON.stringify({
 version:VERSION,users:[],datasets:[],backtests:[],mt5Status:[],
 importConfig:{mode:'quick',years:1,maxBarsByTimeframe:{M1:300000,M5:200000,M15:120000,H1:60000,D1:10000},allowFullImport:false}
},null,2));
app.use(cors()); app.use(express.json({limit:'25mb',strict:true}));
const db=()=>JSON.parse(fs.readFileSync(DB,'utf8'));
// db.json é lido e reescrito INTEIRO a cada request; a indentação dobrava o arquivo (100MB+)
// e travava o servidor. Gravar compacto não perde nenhum dado.
const save=d=>{d.version=VERSION;fs.writeFileSync(DB,JSON.stringify(d),'utf8')};
// Guardar a lista de operações de todo backtest fazia o db.json crescer sem limite.
// Mantém completos apenas os mais recentes (Validação MT5 usa o último com operações;
// o Ranking usa só as métricas, que continuam em todos).
// Poucos e nao dezenas: um backtest de M5 num ano de candles chega a 50 mil operacoes (~9MB cada)
// e o db.json inteiro e relido/reescrito a cada request. A Validacao MT5 usa so o mais recente.
const BACKTESTS_COM_OPERACOES=3;
function podarBacktests(d){
 const bts=Array.isArray(d.backtests)?d.backtests:[];
 if(bts.length<=BACKTESTS_COM_OPERACOES)return;
 const antigos=bts.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(BACKTESTS_COM_OPERACOES);
 for(const b of antigos){const t=b?.result?.trades;if(Array.isArray(t)&&t.length){b.result.tradesCount=t.length;delete b.result.trades}}
}

// =========================
// BILLING / CREDITS v125 - carteira real (Supabase) + PIX (Mercado Pago)
// =========================
const { authMiddleware, chargeWallet } = require('./billing/routes.cjs')({ app, logger: console });
function getIndicatorsCountFromStrategy(vs){
  const arr = vs?.indicators || vs?.voiceStrategy?.indicators || [];
  return Array.isArray(arr) ? arr.length : 0;
}
// Multi-usuário: sem dono, todo robô ficava visível para todos — um cliente pagava para criar
// e o próximo exportava de graça. Registros antigos foram migrados (migrar-donos.cjs).
const donoDe=r=>String(r?.userId||r?.json?.userId||'');
const ehDono=(r,userId)=>donoDe(r)===String(userId||'');
const somenteDoUsuario=(lista,userId)=>(Array.isArray(lista)?lista:[]).filter(r=>ehDono(r,userId));

// v1.2: Forward Testing local com alerta futuro via WhatsApp.
function timeToMinutesV12(value){const m=String(value||'').trim().match(/^(\d{2}):(\d{2})$/);if(!m)return null;const h=Number(m[1]),min=Number(m[2]);if(h<0||h>23||min<0||min>59)return null;return h*60+min}
app.post('/api/forward/setup',authMiddleware,(req,res)=>{try{const d=db();d.forwardTests=Array.isArray(d.forwardTests)?d.forwardTests:[];const robotId=String(req.body?.robotId||'').trim();const asset=String(req.body?.asset||'').trim().toUpperCase();const period=String(req.body?.period||'').trim();const whatsappNumber=String(req.body?.whatsappNumber||'').trim();const closingTime=String(req.body?.closingTime||'').trim();if(!robotId)return res.status(400).json({ok:false,error:'Selecione um robô.'});if(!asset)return res.status(400).json({ok:false,error:'Informe o ativo.'});if(!period)return res.status(400).json({ok:false,error:'Informe o período.'});if(!whatsappNumber)return res.status(400).json({ok:false,error:'Informe o WhatsApp.'});if(timeToMinutesV12(closingTime)===null)return res.status(400).json({ok:false,error:'Informe um horário de fechamento válido.'});const robot=findRobotUnified(robotId);const openingTime=String(req.body?.openingTime||robot?.json?.filters?.startHour||robot?.filters?.startHour||'00:00').slice(0,5);const openMin=timeToMinutesV12(openingTime),closeMin=timeToMinutesV12(closingTime);if(openMin!==null&&closeMin!==null&&closeMin<=openMin)return res.status(400).json({ok:false,error:'Horário de fechamento deve ser depois da abertura do robô.'});const simulation={id:uuidv4(),simulacao_id:uuidv4(),userId:req.user.id,robotId,asset,period,openingTime,closingTime,whatsappNumber,status:'active',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),dailyReports:[]};d.forwardTests.unshift(simulation);d.forwardTests=d.forwardTests.slice(0,500);save(d);res.json({ok:true,simulation,simulacao_id:simulation.simulacao_id})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post('/api/mt5/daily-report',(req,res)=>{try{const d=db();d.forwardTests=Array.isArray(d.forwardTests)?d.forwardTests:[];const simulacaoId=String(req.body?.simulacao_id||'').trim();if(!simulacaoId)return res.status(400).json({ok:false,error:'Informe o simulacao_id.'});const dailyResult=req.body?.dailyResult??{};const simulation=d.forwardTests.find(x=>x.simulacao_id===simulacaoId);if(!simulation)return res.status(404).json({ok:false,error:'Simulação não encontrada.'});const report={id:uuidv4(),simulacao_id:simulation.simulacao_id,dailyResult,receivedAt:new Date().toISOString()};simulation.dailyReports=Array.isArray(simulation.dailyReports)?simulation.dailyReports:[];simulation.dailyReports.unshift(report);simulation.updatedAt=new Date().toISOString();const payload={to:simulation.whatsappNumber,type:'forward_daily_report',simulacao_id:simulation.simulacao_id,asset:simulation.asset,period:simulation.period,closingTime:simulation.closingTime,dailyResult};console.log('FORWARD_TEST_WHATSAPP_PAYLOAD_v1_2',payload);save(d);res.json({ok:true,queued:true,payload,report})}catch(e){res.status(500).json({ok:false,error:e.message})}});

const safe=s=>String(s||'').replace(/[^A-Za-z0-9_-]/g,'_');

function norm(a){
 const seen=new Set();
 return(a||[]).filter(c=>{
  if(!c||!isFinite(+c.open)||!isFinite(+c.high)||!isFinite(+c.low)||!isFinite(+c.close))return false;
  const k=String(c.time); if(seen.has(k))return false; seen.add(k); return true;
 }).map(c=>({time:String(c.time),open:+c.open,high:+c.high,low:+c.low,close:+c.close,volume:+(c.volume||0)}))
 .sort((a,b)=>{const ta=new Date(a.time).getTime(),tb=new Date(b.time).getTime();return(isNaN(ta)||isNaN(tb))?a.time.localeCompare(b.time):ta-tb})
 .map((c,i)=>({...c,i}));
}
function datasetFile(pair,tf){return path.join(SETS,`dataset_${safe(pair)}_${safe(tf)}.json`)}
function readCandles(pair,tf){const f=datasetFile(pair,tf);if(!fs.existsSync(f))return[];try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return[]}}
function upsert(symbol,timeframe,candles,source='MT5 Bridge v25'){
 symbol=String(symbol).toUpperCase();timeframe=String(timeframe).toUpperCase();
 const map=new Map(); for(const c of readCandles(symbol,timeframe))map.set(String(c.time),c); for(const c of norm(candles))map.set(String(c.time),c);
 let merged=norm([...map.values()]);
 const d0=db(),max=d0.importConfig?.maxBarsByTimeframe?.[timeframe]||0;
 if(d0.importConfig?.mode==='quick'&&max>0&&merged.length>max)merged=merged.slice(-max).map((c,i)=>({...c,i}));
 const f=datasetFile(symbol,timeframe); fs.writeFileSync(f,JSON.stringify(merged),'utf8');
 const d=db(); let rec=d.datasets.find(x=>x.pair===symbol&&x.timeframe===timeframe);
 if(!rec){rec={id:uuidv4(),pair:symbol,timeframe,file:path.basename(f),source,count:0,first:'',last:'',createdAt:new Date().toISOString()};d.datasets.push(rec)}
 rec.source=source;rec.count=merged.length;rec.first=merged[0]?.time||'';rec.last=merged[merged.length-1]?.time||'';rec.lastReceived=(candles||[]).length;rec.updatedAt=new Date().toISOString();
 d.mt5Status.unshift({id:uuidv4(),type:'candles',bridge:'v25',pair:symbol,timeframe,received:(candles||[]).length,total:merged.length,mode:d.importConfig?.mode||'quick',createdAt:new Date().toISOString()});
 d.mt5Status=d.mt5Status.slice(0,500); save(d); return rec;
}

// v115: fila assíncrona para importação de candles do Bridge.
// O Bridge pode enviar muitos blocos enquanto o MT5 roda; responder rápido evita travar a API/frontend.
const candleQueue=[];
let candleProcessing=false;
function enqueueCandles(symbol,timeframe,candles,source){
  candleQueue.push({symbol,timeframe,candles,source,createdAt:Date.now()});
  if(!candleProcessing) setTimeout(processCandleQueue,20);
}
function processCandleQueue(){
  if(candleProcessing) return;
  candleProcessing=true;
  try{
    const batch=candleQueue.splice(0,candleQueue.length);
    const grouped=new Map();
    for(const item of batch){
      const key=String(item.symbol).toUpperCase()+'|'+String(item.timeframe).toUpperCase();
      const g=grouped.get(key)||{symbol:item.symbol,timeframe:item.timeframe,candles:[],source:item.source};
      g.candles.push(...(Array.isArray(item.candles)?item.candles:[]));
      g.source=item.source||g.source;
      grouped.set(key,g);
    }
    for(const g of grouped.values()){
      try{ upsert(g.symbol,g.timeframe,g.candles,g.source||'MT5 Bridge'); }
      catch(e){ console.error('v115 erro processando fila /api/mt5/candles:', e.message); }
    }
  }finally{
    candleProcessing=false;
    if(candleQueue.length) setTimeout(processCandleQueue,50);
  }
}
function overview(){
 const d=db(),total=d.datasets.reduce((a,b)=>a+(b.count||0),0),pairs=[...new Set(d.datasets.map(x=>x.pair))],tfs=[...new Set(d.datasets.map(x=>x.timeframe))],last=d.mt5Status[0]||null;
 const disk=fs.existsSync(SETS)?fs.readdirSync(SETS).reduce((s,f)=>s+fs.statSync(path.join(SETS,f)).size,0):0;
 const byPair={}; 
 for(const ds of d.datasets){
   byPair[ds.pair]=byPair[ds.pair]||{pair:ds.pair,datasets:0,candles:0,timeframes:[],last:''};
   byPair[ds.pair].datasets++;byPair[ds.pair].candles+=ds.count||0;
   if(!byPair[ds.pair].timeframes.includes(ds.timeframe))byPair[ds.pair].timeframes.push(ds.timeframe);
   if(!byPair[ds.pair].last || String(ds.last)>String(byPair[ds.pair].last)) byPair[ds.pair].last=ds.last;
 }
 const recent=d.mt5Status.filter(x=>x.type==='candles'&&Date.now()-new Date(x.createdAt).getTime()<60000).reduce((a,b)=>a+(b.received||0),0);
 const latestDataset=d.datasets.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]||null;
 const maxBars=d.importConfig?.maxBarsByTimeframe||{};
 let expected=0;
 for(const pair of pairs){for(const tf of tfs){expected += maxBars[tf] || 0}}
 let progress=expected?Math.min(100,+(total/expected*100).toFixed(1)):100;
 if(total>0 && progress===0) progress=0.1;
 return {
   version:VERSION,
   online:true,
   mt5Online:last?(Date.now()-new Date(last.createdAt).getTime()<120000):false,
   lastUpdate:last?.createdAt||null,
   lastCandle: latestDataset?{pair:latestDataset.pair,timeframe:latestDataset.timeframe,time:latestDataset.last,updatedAt:latestDataset.updatedAt,count:latestDataset.count}:null,
   datasets:d.datasets.length,
   robots:(d.strategies||[]).length,
   totalCandles:total,
   pairs:pairs.length,
   timeframes:tfs.length,
   diskMB:+(disk/1024/1024).toFixed(2),
   diskBytes:disk,
   candlesPerMinute:recent,
   byPair:Object.values(byPair),
   importConfig:d.importConfig,
   estimatedQuickTotal:expected,
   quickProgress:progress
 };
}
function ema(v,p){const k=2/(p+1),o=[];let prev=v[0]||0;for(let i=0;i<v.length;i++){prev=i?v[i]*k+prev*(1-k):v[i];o.push(prev)}return o}
function sma(v,p){const o=[];for(let i=0;i<v.length;i++){let s=0,n=0;for(let j=Math.max(0,i-p+1);j<=i;j++){s+=v[j];n++}o.push(s/n)}return o}
function rsi(v,p=14){const o=new Array(v.length).fill(50);let g=0,l=0;for(let i=1;i<=p&&i<v.length;i++){const d=v[i]-v[i-1];if(d>=0)g+=d;else l-=d}for(let i=p+1;i<v.length;i++){const d=v[i]-v[i-1];g=(g*(p-1)+(d>0?d:0))/p;l=(l*(p-1)+(d<0?-d:0))/p;const rs=l===0?100:g/l;o[i]=100-(100/(1+rs))}return o}
function atr(c,p=14){const tr=[];for(let i=0;i<c.length;i++){if(i===0)tr.push(c[i].high-c[i].low);else tr.push(Math.max(c[i].high-c[i].low,Math.abs(c[i].high-c[i-1].close),Math.abs(c[i].low-c[i-1].close)))}return sma(tr,p)}
function addInd(c){const cl=c.map(x=>x.close),e9=ema(cl,9),e21=ema(cl,21),e50=ema(cl,50),r=rsi(cl,14),a=atr(c,14);return c.map((x,i)=>({...x,ema9:e9[i],ema21:e21[i],ema50:e50[i],rsi14:r[i],atr14:a[i]}))}
function parseCandleDate(s){
 const str=String(s||'').trim();
 let m=str.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})[ T](\d{2}):(\d{2})/);
 if(m)return new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);
 m=str.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})$/);
 if(m)return new Date(+m[1],+m[2]-1,+m[3],0,0);
 m=str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?/);
 if(m)return new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0));
 const d=new Date(str.replace(' ','T'));
 return d;
}
function isoDayLocal(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function inFilters(c,filters){
 const dt=parseCandleDate(c.time); 
 if(filters?.startDate && dt<new Date(filters.startDate+'T00:00:00'))return false;
 if(filters?.endDate && dt>new Date(filters.endDate+'T23:59:59'))return false;
 if(filters?.startHour){const [h,m]=filters.startHour.split(':').map(Number); if(dt.getHours()*60+dt.getMinutes()<h*60+(m||0))return false}
 if(filters?.endHour){const [h,m]=filters.endHour.split(':').map(Number); if(dt.getHours()*60+dt.getMinutes()>h*60+(m||0))return false}
 if(filters?.weekdays?.length){const day=dt.getDay(); if(!filters.weekdays.includes(day))return false}
 return true;
}
function sliceCloses(c,i,period){return c.slice(Math.max(0,i-period+1),i+1).map(x=>x.close)}
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function std(a){const m=avg(a);return Math.sqrt(avg(a.map(x=>(x-m)*(x-m))))}
function getMA(c,i,kind,period){
 period=+(period||20); kind=(kind||'ema').toLowerCase();
 const vals=sliceCloses(c,i,period);
 if(kind==='sma')return avg(vals);
 if(kind==='wma'){let s=0,w=0;for(let j=0;j<vals.length;j++){s+=vals[j]*(j+1);w+=j+1}return w?s/w:0}
 if(kind==='hma'){const half=Math.max(1,Math.round(period/2));return getMA(c,i,'wma',half)}
 let k=2/(period+1),prev=vals[0]||0;for(const v of vals)prev=v*k+prev*(1-k);return prev;
}
function getRSI(c,i,period=14){
 const arr=c.slice(Math.max(0,i-period-1),i+1); if(arr.length<3)return 50;
 let g=0,l=0; for(let j=1;j<arr.length;j++){const d=arr[j].close-arr[j-1].close;if(d>=0)g+=d;else l-=d}
 if(l===0)return 100; const rs=g/l; return 100-(100/(1+rs));
}
function getATR(c,i,period=14){
 const arr=c.slice(Math.max(0,i-period+1),i+1); if(!arr.length)return 0;
 const trs=arr.map((x,j)=>{const prev=j?arr[j-1].close:x.close;return Math.max(x.high-x.low,Math.abs(x.high-prev),Math.abs(x.low-prev))});
 return avg(trs);
}
function getMACD(c,i,fast=12,slow=26,signal=9){
 const macd=getMA(c,i,'ema',fast)-getMA(c,i,'ema',slow);
 const vals=[]; for(let k=Math.max(0,i-signal+1);k<=i;k++) vals.push(getMA(c,k,'ema',fast)-getMA(c,k,'ema',slow));
 const sig=avg(vals); return {macd,signal:sig,hist:macd-sig};
}
function getStoch(c,i,period=14){
 const arr=c.slice(Math.max(0,i-period+1),i+1); const hi=Math.max(...arr.map(x=>x.high)),lo=Math.min(...arr.map(x=>x.low));
 return hi===lo?50:(c[i].close-lo)/(hi-lo)*100;
}
function getCCI(c,i,period=20){
 const arr=c.slice(Math.max(0,i-period+1),i+1); const tps=arr.map(x=>(x.high+x.low+x.close)/3); const ma=avg(tps); const md=avg(tps.map(x=>Math.abs(x-ma)));
 const tp=(c[i].high+c[i].low+c[i].close)/3; return md?((tp-ma)/(0.015*md)):0;
}
function getBollinger(c,i,period=20,mult=2){
 const vals=sliceCloses(c,i,period); const m=avg(vals),s=std(vals); return {middle:m,upper:m+mult*s,lower:m-mult*s};
}
function getDonchian(c,i,period=20){
 const arr=c.slice(Math.max(0,i-period+1),i+1); return {upper:Math.max(...arr.map(x=>x.high)),lower:Math.min(...arr.map(x=>x.low))};
}
function getVWAP(c,i,period=20){
 const arr=c.slice(Math.max(0,i-period+1),i+1); let pv=0,v=0; for(const x of arr){const vol=x.volume||1;pv+=((x.high+x.low+x.close)/3)*vol;v+=vol} return v?pv/v:c[i].close;
}
function getADX(c,i,period=14){const atr=getATR(c,i,period);return atr?Math.min(60,Math.abs(c[i].close-getMA(c,i,'ema',period))/atr*10):0}
function detectCandle(c,i,pattern){
 const x=c[i],prev=c[i-1]||x,body=Math.abs(x.close-x.open),range=x.high-x.low||1;
 if(pattern==='doji')return body/range<0.12;
 if(pattern==='engolfo')return (x.close>x.open&&prev.close<prev.open&&x.close>prev.open&&x.open<prev.close)||(x.close<x.open&&prev.close>prev.open&&x.close<prev.open&&x.open>prev.close);
 if(pattern==='martelo')return (Math.min(x.open,x.close)-x.low)/range>0.55&&body/range<0.35;
 return false;
}
function evalIndicatorCondition(c,i,cond){
 const type=(cond.type||'').toLowerCase(), mode=(cond.mode||'trend').toLowerCase(), p=+(cond.period||14), price=c[i].close;
 if(type==='ema'||type==='sma'||type==='wma'||type==='hma'){const ma=getMA(c,i,type,p);return mode==='bear'?price<ma:price>ma}
 if(type==='vwap'){const v=getVWAP(c,i,p);return mode==='bear'?price<v:price>v}
 if(type==='adx'){return getADX(c,i,p)>+(cond.threshold||20)}
 if(type==='supertrend'){const ma=getMA(c,i,'ema',p),atr=getATR(c,i,p);return mode==='bear'?price<ma-atr:price>ma+atr}
 if(type==='ichimoku'||type==='alligator'){return mode==='bear'?price<getMA(c,i,'sma',34):price>getMA(c,i,'sma',34)}
 if(type==='rsi'){const r=getRSI(c,i,p);if(mode==='reversal')return cond.side==='buy'?r<+(cond.buy||30):r>+(cond.sell||70);return cond.side==='buy'?r>+(cond.buy||50):r<+(cond.sell||50)}
 if(type==='macd'){const m=getMACD(c,i,12,26,9);return cond.side==='buy'?m.hist>0:m.hist<0}
 if(type==='stochastic'){const s=getStoch(c,i,p);return cond.side==='buy'?s<+(cond.buy||20):s>+(cond.sell||80)}
 if(type==='cci'){const x=getCCI(c,i,p);return cond.side==='buy'?x>+(cond.buy||0):x<-(+(cond.sell||0))}
 if(type==='roc'||type==='momentum'){const old=c[Math.max(0,i-p)]?.close||price;const roc=(price-old)/old*100;return cond.side==='buy'?roc>0:roc<0}
 if(type==='williams'){const s=getStoch(c,i,p)-100;return cond.side==='buy'?s< -80:s> -20}
 if(type==='atr'){return getATR(c,i,p)>0}
 if(type==='bollinger'){const b=getBollinger(c,i,p,2);return mode==='breakout'?(cond.side==='buy'?price>b.upper:price<b.lower):(cond.side==='buy'?price<b.lower:price>b.upper)}
 if(type==='keltner'){const ma=getMA(c,i,'ema',p),atr=getATR(c,i,p);return cond.side==='buy'?price>ma+1.5*atr:price<ma-1.5*atr}
 if(type==='donchian'){const d=getDonchian(c,i,p);return cond.side==='buy'?price>=d.upper:price<=d.lower}
 if(type==='obv'||type==='mfi'||type==='volume profile'||type==='volumeprofile')return true;
 if(type==='suporte'||type==='support'){const d=getDonchian(c,i,p);return price<=d.lower*1.001}
 if(type==='resistência'||type==='resistencia'||type==='resistance'){const d=getDonchian(c,i,p);return price>=d.upper*0.999}
 if(type==='rompimento'||type==='breakout'){const d=getDonchian(c,i,p);return cond.side==='buy'?price>d.upper:price<d.lower}
 if(type==='pullback'){const ma=getMA(c,i,'ema',p);return Math.abs(price-ma)/price<0.0015}
 if(type==='candlestick')return detectCandle(c,i,cond.pattern||'engolfo')
 return true;
}
function sig(c,i,p){
 if(i<60)return 0;
 const vs=p.voiceStrategy;
 if(vs&&Array.isArray(vs.indicators)&&vs.indicators.length){
   const buyOK=vs.indicators.every(x=>evalIndicatorCondition(c,i,{...x,side:'buy',mode:vs.mode||x.mode}));
   const sellOK=vs.indicators.every(x=>evalIndicatorCondition(c,i,{...x,side:'sell',mode:vs.mode||x.mode}));
   if(buyOK&&!sellOK)return 1; if(sellOK&&!buyOK)return -1; return 0;
 }
 if(vs){
   const maKind=vs.maKind||'ema', maPeriod=+(vs.maPeriod||20);
   const price=c[i-1].close, ma=getMA(c,i-1,maKind,maPeriod), r=getRSI(c,i-1,+(vs.rsiPeriod||14));
   if((vs.mode||'trend')==='reversal'){ if(price>ma&&r<=+(vs.buyRsi||30))return 1; if(price<ma&&r>=+(vs.sellRsi||70))return -1; }
   else { if(price>ma&&r>=+(vs.buyRsi||50))return 1; if(price<ma&&r<=+(vs.sellRsi||50))return -1; }
   return 0;
 }
 if(p.strategy==='ema'){
  if(c[i-1].ema9>c[i-1].ema21&&c[i-2].ema9<=c[i-2].ema21)return 1;
  if(c[i-1].ema9<c[i-1].ema21&&c[i-2].ema9>=c[i-2].ema21)return -1;
 }
 if(p.strategy==='rsi'){if(c[i-1].rsi14<=30)return 1;if(c[i-1].rsi14>=70)return -1}
 if(p.strategy==='mhi'){const a=c[i-3],b=c[i-2],cc=c[i-1],g=[a,b,cc].filter(x=>x.close>x.open).length,red=[a,b,cc].filter(x=>x.close<x.open).length;if(red>g)return 1;if(g>red)return -1}
 return 0;
}
function groupKey(time,type){
 const d=parseCandleDate(time);
 if(type==='hour')return String(d.getHours()).padStart(2,'0')+':00';
 if(type==='month')return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
 if(type==='weekday')return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()];
 return d.toISOString().slice(0,10);
}
function computeStats(trades,eq,init){
 let grossWin=0,grossLoss=0,maxWinSeq=0,maxLossSeq=0,winSeq=0,lossSeq=0;
 for(const t of trades){if(t.result>0){grossWin+=t.result;winSeq++;lossSeq=0}else if(t.result<0){grossLoss+=Math.abs(t.result);lossSeq++;winSeq=0}else{winSeq=0;lossSeq=0}maxWinSeq=Math.max(maxWinSeq,winSeq);maxLossSeq=Math.max(maxLossSeq,lossSeq)}
 const wins=trades.filter(t=>t.result>0),losses=trades.filter(t=>t.result<0);
 const avgWin=wins.length?grossWin/wins.length:0,avgLoss=losses.length?grossLoss/losses.length:0,profit=eq[eq.length-1]-init;
 return {grossWin:+grossWin.toFixed(2),grossLoss:+grossLoss.toFixed(2),profitFactor:trades.length?(grossLoss?+(grossWin/grossLoss).toFixed(2):999):0,payoff:avgLoss?+(avgWin/avgLoss).toFixed(2):0,expectancy:trades.length?+(profit/trades.length).toFixed(3):0,avgWin:+avgWin.toFixed(2),avgLoss:+avgLoss.toFixed(2),maxWinSeq,maxLossSeq};
}
function backtest(candles,p){
 const c=addInd(candles),exp=Math.max(1,parseInt(p.expiration||1)),pay=+(p.payout||.85),stake=+(p.stake||1);
 let bal=+(p.initial||100),init=bal,peak=bal,dd=0,w=0,l=0,d=0;const eq=[bal],trades=[];
 for(let i=60;i<c.length-exp-1;i++){
  if(!inFilters(c[i],p.filters))continue;
  const s=sig(c,i,p); if(!s)continue;
  let res=0,entry=c[i].open,exit=c[i+exp].close;
  if(s===1){if(exit>entry)res=stake*pay;else if(exit<entry)res=-stake}
  if(s===-1){if(exit<entry)res=stake*pay;else if(exit>entry)res=-stake}
  bal+=res;if(res>0)w++;else if(res<0)l++;else d++;peak=Math.max(peak,bal);dd=Math.max(dd,((peak-bal)/peak)*100);
  trades.push({time:c[i].time,type:s===1?'CALL':'PUT',entry,exit,result:+res.toFixed(2),balance:+bal.toFixed(2),index:i,day:groupKey(c[i].time,'day'),month:groupKey(c[i].time,'month'),hour:groupKey(c[i].time,'hour'),weekday:groupKey(c[i].time,'weekday')});
  eq.push(+bal.toFixed(2)); i+=exp-1;
 }
 const total=w+l+d,wr=total?w/total*100:0,profit=bal-init;const extra=computeStats(trades,eq,init);
 let score=0;
 if(total>0){
   score=(wr>=60?35:wr>=55?25:wr>=52?15:0)+(dd<=10?25:dd<=20?15:dd<=35?8:0)+(total>=300?20:total>=100?12:total>=40?6:0)+(profit>0?20:0);
 }
 const group=(type)=>{const m={};for(const t of trades){const k=t[type];m[k]=m[k]||{key:k,profit:0,trades:0,wins:0,losses:0};m[k].profit+=t.result;m[k].trades++;if(t.result>0)m[k].wins++;if(t.result<0)m[k].losses++}return Object.values(m).map(x=>({...x,profit:+x.profit.toFixed(2),winRate:x.trades?+(x.wins/x.trades*100).toFixed(1):0})).sort((a,b)=>String(a.key).localeCompare(String(b.key)))}
 const candlesInFilter=c.filter(x=>inFilters(x,p.filters)).length;
 const diagnostic={
   totalCandles:c.length,
   candlesAfterFilters:candlesInFilter,
   reason: total>0 ? 'OK' : (candlesInFilter<80 ? 'Poucos candles após filtro de data/horário' : 'Estratégia não gerou sinais no período selecionado')
 };
 return {metrics:{initial:init,balance:+bal.toFixed(2),profit:+profit.toFixed(2),wins:w,losses:l,draws:d,total,winRate:+wr.toFixed(2),drawdown:+dd.toFixed(2),score:Math.min(100,Math.round(score)),...extra},diagnostic,equity:eq,trades,chartCandles:c.slice(-420),daily:group('day'),monthly:group('month'),hourly:group('hour'),weekday:group('weekday')};
}
function loadSet(id){const d=db(),rec=d.datasets.find(x=>x.id===id);if(!rec)return null;return{rec,candles:JSON.parse(fs.readFileSync(path.join(SETS,rec.file),'utf8'))}}

app.post('/api/mt5/status',(req,res)=>{const d=db();d.mt5Status.unshift({id:uuidv4(),type:'status',bridge:req.body.bridge||'v25',...req.body,createdAt:new Date().toISOString()});d.mt5Status=d.mt5Status.slice(0,500);save(d);res.json({ok:true,version:VERSION})});
app.post('/api/mt5/candles',(req,res)=>{try{const{symbol,timeframe,candles,source}=req.body||{};if(!symbol||!timeframe||!Array.isArray(candles))return res.status(400).json({ok:false,error:'Formato inválido',version:VERSION});enqueueCandles(symbol,timeframe,candles,source||'MT5 Bridge');res.json({ok:true,version:VERSION,queued:true,received:candles.length,queue:candleQueue.length})}catch(e){res.status(500).json({ok:false,error:e.message,version:VERSION})}});
app.get('/api/version',(req,res)=>res.json({version:VERSION,project:'Forex IA Studio Backtest Lab'}));
app.get('/api/mt5/status',(req,res)=>res.json(db().mt5Status.slice(0,100)));
app.get('/api/mt5/overview',(req,res)=>res.json(overview()));
app.get('/api/mt5/datasets',(req,res)=>res.json(db().datasets.sort((a,b)=>a.pair.localeCompare(b.pair)||a.timeframe.localeCompare(b.timeframe))));
app.get('/api/datasets',(req,res)=>res.json(db().datasets.slice().sort((a,b)=>String(a.pair).localeCompare(String(b.pair))||String(a.timeframe).localeCompare(String(b.timeframe)))));
app.post('/api/import/config',(req,res)=>{const d=db();d.importConfig={...d.importConfig,...req.body};save(d);res.json({ok:true,importConfig:d.importConfig})});
app.post('/api/import/compact',(req,res)=>{const d=db();let changed=0;for(const ds of d.datasets){const max=d.importConfig?.maxBarsByTimeframe?.[ds.timeframe]||0;if(max>0){const f=path.join(SETS,ds.file);let arr=JSON.parse(fs.readFileSync(f,'utf8'));if(arr.length>max){arr=arr.slice(-max).map((c,i)=>({...c,i}));fs.writeFileSync(f,JSON.stringify(arr),'utf8');ds.count=arr.length;ds.first=arr[0]?.time||'';ds.last=arr[arr.length-1]?.time||'';changed++}}}save(d);res.json({ok:true,changed})});

app.get('/api/dataset/:id/meta',(req,res)=>{
 const rec=db().datasets.find(x=>x.id===req.params.id);
 if(!rec)return res.status(404).json({erro:'Dataset não encontrado'});
 const candles=JSON.parse(fs.readFileSync(path.join(SETS,rec.file),'utf8'));
 const first=candles[0], last=candles[candles.length-1];
 const byHour={}, byDate={};
 for(const c of candles){
   const d=parseCandleDate(c.time);
   if(isNaN(d.getTime()))continue;
   const h=String(d.getHours()).padStart(2,'0')+':00';
   const day=isoDayLocal(d);
   byHour[h]=(byHour[h]||0)+1;
   byDate[day]=(byDate[day]||0)+1;
 }
 res.json({dataset:rec,count:candles.length,first:first?.time||'',last:last?.time||'',firstDate:first?isoDayLocal(parseCandleDate(first.time)):'',lastDate:last?isoDayLocal(parseCandleDate(last.time)):'',byHour,byDate});
});
app.post('/api/dataset/:id/filter-preview',(req,res)=>{
 const rec=db().datasets.find(x=>x.id===req.params.id);
 if(!rec)return res.status(404).json({erro:'Dataset não encontrado'});
 const candles=JSON.parse(fs.readFileSync(path.join(SETS,rec.file),'utf8'));
 const filters=req.body?.filters||{};
 const after=candles.filter(c=>inFilters(c,filters)).length;
 res.json({total:candles.length,afterFilters:after,ok:after>=80});
});

app.get('/api/dataset/:id',(req,res)=>{const rec=db().datasets.find(x=>x.id===req.params.id);if(!rec)return res.status(404).json({erro:'Dataset não encontrado'});let candles=JSON.parse(fs.readFileSync(path.join(SETS,rec.file),'utf8'));candles=addInd(candles);res.json({dataset:rec,candles:candles.slice(-Math.min(parseInt(req.query.limit||800),5000))})});
app.post('/api/backtest',authMiddleware,async(req,res)=>{try{const ds=loadSet(req.body.datasetId);if(!ds)return res.status(404).json({erro:'Dataset não encontrado'});if(ds.candles.length<80)return res.status(400).json({erro:'Poucos candles'});const indicators=getIndicatorsCountFromStrategy(req.body.voiceStrategy||{});const billing=await chargeWallet(req.user,'backtest',indicators,'Backtest do robô');const d=db();const result=backtest(ds.candles,req.body),rec={id:uuidv4(),userId:req.user.id,datasetId:req.body.datasetId,pair:ds.rec.pair,timeframe:ds.rec.timeframe,params:req.body,result,billing:{cost:billing.cost,indicators:billing.indicators,balanceAfter:billing.balanceAfter},createdAt:new Date().toISOString()};d.backtests.push(rec);podarBacktests(d);save(d);res.json(rec)}catch(e){res.status(e.status||500).json({ok:false,error:e.message,code:e.code,cost:e.cost,balance:e.balance})}});
app.get('/api/backtests',authMiddleware,(req,res)=>res.json(somenteDoUsuario(db().backtests,req.user.id).slice().reverse()));

// =========================
// Genetic Optimizer v119
// Executa otimização rápida na plataforma. O MT5 fica apenas para validação final.
// =========================
function cloneJson(x){ return JSON.parse(JSON.stringify(x||{})); }
function indicatorRanges(type, current){
  const t=String(type||'').toLowerCase();
  const cur=Number(current||0);
  const unique=a=>Array.from(new Set(a.filter(n=>Number.isFinite(+n)&&+n>0).map(n=>Math.round(+n))));
  if(t==='ema'||t==='sma'||t==='wma'||t==='hma') return unique([cur,5,8,10,13,14,20,21,30,34,50,55,89]);
  if(t==='rsi') return unique([cur,7,9,10,12,14,18,21,28]);
  if(t==='macd') return unique([cur,6,8,10,12,14,18,20,21,26,30]);
  if(t==='williams'||t==='roc'||t==='momentum'||t==='adx'||t==='stochastic'||t==='cci') return unique([cur,7,9,10,12,14,18,20,22,28,34]);
  if(t==='alligator'||t==='ichimoku') return unique([cur,13,20,21,34,55]);
  return unique([cur,7,10,14,20,30]);
}
function fitnessFromMetrics(m, opts={}){
  const minTrades=Number(opts.minTrades||20);
  const ddLimit=Number(opts.maxDrawdown||80);
  const total=Number(m.total||m.trades||0), profit=Number(m.profit||0), dd=Number(m.drawdown||0), wr=Number(m.winRate||0), pf=Number(m.profitFactor||0);
  let score = profit + (wr*0.25) + (pf*10) - (dd*1.2);
  if(total<minTrades) score -= (minTrades-total)*8;
  if(dd>ddLimit) score -= (dd-ddLimit)*10;
  if(total===0) score -= 9999;
  return Number(score.toFixed(4));
}
function randomChoice(arr){return arr[Math.floor(Math.random()*arr.length)]}
function mutateStrategy(base, ranges, rate=0.35){
  const vs=cloneJson(base);
  vs.indicators=(vs.indicators||[]).map((ind,idx)=>{
    const out={...ind}; const r=ranges[idx]||[out.period||14];
    if(Math.random()<rate || !out.period) out.period=randomChoice(r);
    if(String(out.type||'').toLowerCase()==='rsi'){
      if(Math.random()<rate) out.buy=randomChoice([45,48,50,52,55,60]);
      if(Math.random()<rate) out.sell=randomChoice([55,52,50,48,45,40]);
    }
    if(String(out.type||'').toLowerCase()==='adx' && Math.random()<rate) out.threshold=randomChoice([12,15,18,20,22,25,30]);
    return out;
  });
  if(Math.random()<0.15) vs.mode = randomChoice(['trend','trend','trend','reversal']);
  return vs;
}
function strategyKey(vs){return JSON.stringify((vs.indicators||[]).map(x=>({t:String(x.type||'').toLowerCase(),p:+x.period||0,b:x.buy,s:x.sell,th:x.threshold,m:x.mode||vs.mode})).concat([{mode:vs.mode||'trend'}]));}
// Progresso real do otimizador. O laço genético é síncrono e trava o event loop, então ele
// devolve o controle (setImmediate) a cada indivíduo — só assim /progress consegue responder
// durante a execução. Antes disso o front mostrava uma barra estimada por cronômetro.
const optimizerJobs=new Map();
const OPT_JOB_TTL=10*60*1000;
function optJobCleanup(){const now=Date.now();for(const [k,j] of optimizerJobs){if(j.finishedAt&&now-j.finishedAt>OPT_JOB_TTL)optimizerJobs.delete(k)}}
const optTick=()=>new Promise(r=>setImmediate(r));
app.get('/api/optimizer/progress/:jobId',authMiddleware,(req,res)=>{
  const j=optimizerJobs.get(String(req.params.jobId));
  if(!j)return res.status(404).json({ok:false,error:'Execução não encontrada'});
  if(j.userId&&req.user?.id&&j.userId!==req.user.id)return res.status(403).json({ok:false,error:'Execução de outro usuário'});
  res.json({ok:true,done:j.done,cancelled:j.cancelled,tested:j.tested,plannedTests:j.plannedTests,generation:j.generation,generations:j.generations,bestFitness:j.bestFitness,bestProfit:j.bestProfit,bestTrades:j.bestTrades,startedAt:j.startedAt});
});
app.post('/api/optimizer/cancel/:jobId',authMiddleware,(req,res)=>{
  const j=optimizerJobs.get(String(req.params.jobId));
  if(!j)return res.status(404).json({ok:false,error:'Execução não encontrada'});
  if(j.userId&&req.user?.id&&j.userId!==req.user.id)return res.status(403).json({ok:false,error:'Execução de outro usuário'});
  j.cancelled=true; res.json({ok:true});
});
app.post('/api/optimizer/genetic',authMiddleware,async(req,res)=>{
  try{
    const {datasetId, robotId, voiceStrategy, filters, expiration=1, payout=.85, stake=1, initial=100, population=36, generations=6, minTrades=20, maxDrawdown=120, jobId}=req.body||{};
    const ds=loadSet(datasetId); if(!ds)return res.status(404).json({ok:false,error:'Dataset não encontrado'});
    let baseVS=cloneJson(voiceStrategy);
    let robot=null;
    if(robotId){
      robot=findRobotUnified(robotId);
      if(robot && !ehDono(robot,req.user.id)) return res.status(403).json({ok:false,error:'Este robô pertence a outra conta.'});
      if(robot && (!baseVS || !Array.isArray(baseVS.indicators) || !baseVS.indicators.length)){
        baseVS=cloneJson(robot.json?.voiceStrategy || robot.voiceStrategy || robot.strategy?.voiceStrategy || {});
      }
    }
    if(!baseVS || !Array.isArray(baseVS.indicators) || !baseVS.indicators.length){
      return res.status(400).json({ok:false,error:'Selecione um robô com indicadores para otimizar.', debug:{robotId, robotFound:!!robot, robotName:robot?.name||robot?.json?.name||'', keys:robot?Object.keys(robot):[]}});
    }
    const billing=await chargeWallet(req.user,'optimizer',baseVS.indicators.length,'Otimização genética');
    const baseReq={datasetId,strategy:'voice',voiceStrategy:baseVS,filters:filters||{},expiration,payout,stake,initial};
    const baseline=backtest(ds.candles,baseReq);
    const ranges=baseVS.indicators.map(x=>indicatorRanges(x.type,x.period));
    const seen=new Set(); const evaluated=[];
    const totalPlanned=1+Math.max(4,Number(population||36))+(Number(generations||6)*Number(population||36));
    optJobCleanup();
    const job={userId:req.user?.id||null,startedAt:Date.now(),tested:0,plannedTests:totalPlanned,generation:0,generations:Number(generations||6),bestFitness:0,bestProfit:0,bestTrades:0,done:false,cancelled:false,finishedAt:0};
    if(jobId)optimizerJobs.set(String(jobId),job);
    function evaluate(vs,gen){
      const k=strategyKey(vs); if(seen.has(k)) return null; seen.add(k);
      const bt=backtest(ds.candles,{...baseReq,voiceStrategy:vs});
      const m=bt.metrics||{}; const fit=fitnessFromMetrics(m,{minTrades,maxDrawdown});
      const total=Number(m.total||m.trades||0), dd=Number(m.drawdown||0), pf=Number(m.profitFactor||0);
      const reliable = total>=Number(minTrades||20) && dd<=Number(maxDrawdown||120) && pf>=0.8;
      const row={generation:gen,fitness:fit,reliable,voiceStrategy:vs,metrics:m,indicators:(vs.indicators||[]).map(x=>({type:x.type,period:x.period,buy:x.buy,sell:x.sell,threshold:x.threshold}))};
      evaluated.push(row);
      job.tested=evaluated.length; job.generation=gen;
      if(fit>job.bestFitness){job.bestFitness=fit;job.bestProfit=Number(m.profit||0);job.bestTrades=total}
      return row;
    }
    evaluate(baseVS,0);
    for(let i=0;i<Math.max(4,Number(population));i++){ if(job.cancelled)break; evaluate(mutateStrategy(baseVS,ranges,0.9),0); await optTick(); }
    for(let g=1; g<=Number(generations||6) && !job.cancelled; g++){
      evaluated.sort((a,b)=>b.fitness-a.fitness);
      const parents=evaluated.slice(0,Math.min(10,evaluated.length));
      for(let i=0;i<Number(population||36);i++){
        if(job.cancelled)break;
        const a=cloneJson(randomChoice(parents).voiceStrategy), b=cloneJson(randomChoice(parents).voiceStrategy);
        const child=cloneJson(a);
        child.indicators=child.indicators.map((ind,idx)=> Math.random()<0.5 ? ind : cloneJson((b.indicators||[])[idx]||ind));
        evaluate(mutateStrategy(child,ranges,0.28),g);
        await optTick();
      }
    }
    job.done=true; job.finishedAt=Date.now();
    evaluated.sort((a,b)=>b.fitness-a.fitness);
    const eligible=evaluated.filter(x=>x.reliable).sort((a,b)=>b.fitness-a.fitness);
    const best=(eligible[0]||evaluated[0]||null);
    const top=(eligible.length?eligible:evaluated).slice(0,20);
    const improvement=best?Number((Number(best.metrics.profit||0)-Number(baseline.metrics.profit||0)).toFixed(2)):0;
    const plannedTests=1+Math.max(4,Number(population||36))+(Number(generations||6)*Number(population||36));
    const curve=[];
    for(let g=0;g<=Number(generations||6);g++){
      const rows=evaluated.filter(x=>x.generation<=g).sort((a,b)=>b.fitness-a.fitness);
      if(rows[0])curve.push({generation:g,profit:Number(rows[0].metrics.profit||0),fitness:rows[0].fitness,trades:Number(rows[0].metrics.total||0)});
    }
    const confidence = !best ? {level:'Baixa',stars:1,message:'Nenhuma configuração encontrada.'} :
      Number(best.metrics.total||0)<Number(minTrades||20) ? {level:'Baixa',stars:1,message:'Poucas operações. Resultado pode ser sorte; aumente período ou mínimo de trades.'} :
      Number(best.metrics.total||0)<50 ? {level:'Média',stars:3,message:'Quantidade moderada de operações. Valide no MT5 e em outro período.'} :
      {level:'Alta',stars:5,message:'Quantidade de operações adequada para este período.'};
    res.json({ok:true,version:VERSION,cancelled:job.cancelled,billing:{cost:billing.cost,indicators:billing.indicators,balanceAfter:billing.balanceAfter},robot:{id:robotId,name:robot?.name||robot?.json?.name||''},tested:evaluated.length,plannedTests,baseline:{voiceStrategy:baseVS,metrics:baseline.metrics},best,top,improvement,confidence,curve});
  }catch(e){
    if(jobId){const j=optimizerJobs.get(String(jobId)); if(j){j.done=true;j.finishedAt=Date.now()}}
    res.status(e.status||500).json({ok:false,error:e.message,code:e.code,cost:e.cost,balance:e.balance,stack:e.stack,version:VERSION})
  }
});
app.post('/api/optimizer/save',authMiddleware,(req,res)=>{
  try{
    const {name, baseRobotId, voiceStrategy}=req.body||{};
    if(!voiceStrategy || !Array.isArray(voiceStrategy.indicators)) return res.status(400).json({ok:false,error:'voiceStrategy inválida'});
    const d=db();
    const base=findRobotUnified(baseRobotId) || null;
    const baseName=(base?.name||base?.json?.name||'Robo');
    if(base && !ehDono(base,req.user.id)) return res.status(403).json({ok:false,error:'Este robô pertence a outra conta.'});
    const rec={
      id:uuidv4(),
      name:name||(baseName+'_OPT'),
      json:{...(base?.json||{}),name:name||(baseName+'_OPT'),voiceStrategy,strategy:'voice',optimizedFrom:baseRobotId||null},
      userId:req.user.id,
      source:'optimizer-v119',schema:'forex-ia-robot-folder-v1',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    };
    // Salva no mesmo local usado pela tela Meus Robôs (/api/strategies), para não reaparecer robô antigo/deletado.
    d.strategies=d.strategies||[];
    d.strategies.push(rec);
    save(d);
    res.json({ok:true,robot:rec});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});




function makeMql5Strategy(req){
 const rawName = String(req.name || 'ForexIA_Robo_Gerado').replace(/[^a-zA-Z0-9_]/g,'_');
 const vs = req.voiceStrategy || {};
 const indicators = Array.isArray(vs.indicators) ? vs.indicators : [];
 const find = (type, def) => {
   const item = indicators.find(x => String(x.type || '').toLowerCase() === type);
   return Number(item && item.period ? item.period : def);
 };
 const ema = find('ema',20);
 const sma = find('sma',20);
 const rsi = find('rsi',14);
 const will = find('williams',14);
 const useSma = indicators.some(x => String(x.type || '').toLowerCase() === 'sma');
 const useMacd = indicators.some(x => String(x.type || '').toLowerCase() === 'macd');
 const useWilliams = indicators.some(x => String(x.type || '').toLowerCase() === 'williams');
 const hIni = parseInt(String(req.filters?.startHour || '00:00').slice(0,2)) || 0;
 const hFim = parseInt(String(req.filters?.endHour || '23:59').slice(0,2)) || 23;
 const trendLine = useSma ? 'sma[0]' : 'ema[0]';
 const macdFlag = useMacd ? 'true' : 'false';
 const willFlag = useWilliams ? 'true' : 'false';

 return [
'//+------------------------------------------------------------------+',
'//| '+rawName+'.mq5',
'//| Gerado pelo Forex IA Studio v33',
'//| EA independente para Strategy Tester, sem WebRequest',
'//+------------------------------------------------------------------+',
'#property strict',
'#property version "1.330"',
'#include <Trade/Trade.mqh>',
'CTrade trade;',
'',
'input double Lote = 0.01;',
'input int EMA_Period = '+ema+';',
'input int SMA_Period = '+sma+';',
'input int RSI_Period = '+rsi+';',
'input int Williams_Period = '+will+';',
'input int StopLoss_Points = 300;',
'input int TakeProfit_Points = 450;',
'input int HoraInicio = '+hIni+';',
'input int HoraFim = '+hFim+';',
'input ulong Magic = 33033;',
'',
'int hEma=-1;',
'int hSma=-1;',
'int hRsi=-1;',
'int hMacd=-1;',
'int hWpr=-1;',
'datetime lastBarTime=0;',
'',
'int OnInit(){',
'   trade.SetExpertMagicNumber(Magic);',
'   hEma = iMA(_Symbol,_Period,EMA_Period,0,MODE_EMA,PRICE_CLOSE);',
'   hSma = iMA(_Symbol,_Period,SMA_Period,0,MODE_SMA,PRICE_CLOSE);',
'   hRsi = iRSI(_Symbol,_Period,RSI_Period,PRICE_CLOSE);',
'   hMacd = iMACD(_Symbol,_Period,12,26,9,PRICE_CLOSE);',
'   hWpr = iWPR(_Symbol,_Period,Williams_Period);',
'   if(hEma==INVALID_HANDLE || hSma==INVALID_HANDLE || hRsi==INVALID_HANDLE){',
'      Print("Erro ao criar indicadores.");',
'      return INIT_FAILED;',
'   }',
'   Print("Forex IA v33 iniciado: ", _Symbol, " ", EnumToString(_Period));',
'   return INIT_SUCCEEDED;',
'}',
'',
'bool NewBar(){',
'   datetime t = iTime(_Symbol,_Period,0);',
'   if(t != lastBarTime){ lastBarTime = t; return true; }',
'   return false;',
'}',
'',
'bool HorarioPermitido(){',
'   MqlDateTime t;',
'   TimeToStruct(TimeCurrent(),t);',
'   return (t.hour >= HoraInicio && t.hour <= HoraFim);',
'}',
'',
'bool TemPosicao(){',
'   for(int i=PositionsTotal()-1;i>=0;i--){',
'      ulong ticket = PositionGetTicket(i);',
'      if(PositionSelectByTicket(ticket)){',
'         if(PositionGetString(POSITION_SYMBOL)==_Symbol && PositionGetInteger(POSITION_MAGIC)==(long)Magic)',
'            return true;',
'      }',
'   }',
'   return false;',
'}',
'',
'void OnTick(){',
'   if(!NewBar()) return;',
'   if(!HorarioPermitido()) return;',
'   if(TemPosicao()) return;',
'',
'   double ema[2];',
'   double sma[2];',
'   double rsi[2];',
'   double macdMain[2];',
'   double macdSignal[2];',
'   double wpr[2];',
'   double closePrice[2];',
'   ArraySetAsSeries(ema,true);',
'   ArraySetAsSeries(sma,true);',
'   ArraySetAsSeries(rsi,true);',
'   ArraySetAsSeries(macdMain,true);',
'   ArraySetAsSeries(macdSignal,true);',
'   ArraySetAsSeries(wpr,true);',
'   ArraySetAsSeries(closePrice,true);',
'',
'   if(CopyBuffer(hEma,0,0,2,ema)<=0) return;',
'   if(CopyBuffer(hSma,0,0,2,sma)<=0) return;',
'   if(CopyBuffer(hRsi,0,0,2,rsi)<=0) return;',
'   if(CopyClose(_Symbol,_Period,0,2,closePrice)<=0) return;',
'',
'   bool macdOkBuy = true;',
'   bool macdOkSell = true;',
'   if('+macdFlag+'){',
'      if(CopyBuffer(hMacd,0,0,2,macdMain)>0 && CopyBuffer(hMacd,1,0,2,macdSignal)>0){',
'         macdOkBuy = macdMain[0] > macdSignal[0];',
'         macdOkSell = macdMain[0] < macdSignal[0];',
'      }',
'   }',
'',
'   bool willOkBuy = true;',
'   bool willOkSell = true;',
'   if('+willFlag+'){',
'      if(CopyBuffer(hWpr,0,0,2,wpr)>0){',
'         willOkBuy = wpr[0] < -50;',
'         willOkSell = wpr[0] > -50;',
'      }',
'   }',
'',
'   double trendValue = '+trendLine+';',
'   bool buy = closePrice[0] > trendValue && rsi[0] > 50 && macdOkBuy && willOkBuy;',
'   bool sell = closePrice[0] < trendValue && rsi[0] < 50 && macdOkSell && willOkSell;',
'',
'   double ask = SymbolInfoDouble(_Symbol,SYMBOL_ASK);',
'   double bid = SymbolInfoDouble(_Symbol,SYMBOL_BID);',
'   double point = SymbolInfoDouble(_Symbol,SYMBOL_POINT);',
'',
'   if(buy){',
'      double sl = ask - StopLoss_Points*point;',
'      double tp = ask + TakeProfit_Points*point;',
'      bool ok = trade.Buy(Lote,_Symbol,ask,sl,tp,"ForexIA v33 BUY");',
'      Print("BUY sinal. RSI=",rsi[0]," ok=",ok," erro=",GetLastError());',
'   }',
'',
'   if(sell){',
'      double sl = bid + StopLoss_Points*point;',
'      double tp = bid - TakeProfit_Points*point;',
'      bool ok = trade.Sell(Lote,_Symbol,bid,sl,tp,"ForexIA v33 SELL");',
'      Print("SELL sinal. RSI=",rsi[0]," ok=",ok," erro=",GetLastError());',
'   }',
'}',
''
 ].join('\r\n');
}

// O .mq5 é o produto final: sem authMiddleware qualquer um gerava robôs de graça, sem conta,
// furando toda a cobrança. Exportar um robô já pago (body.id salvo) é grátis; exportar uma
// estratégia avulsa cobra o mesmo que criar, senão bastaria pular o "Salvar" para não pagar.
app.post('/api/robot/export-mt5',authMiddleware,async(req,res)=>{
 try{
   const body=req.body||{};
   const d0=db();
   const jaPago=body.id && (Array.isArray(d0.strategies)?d0.strategies:[]).some(x=>x.id===body.id && ehDono(x,req.user.id));
   if(!jaPago) await chargeWallet(req.user,'create',getIndicatorsCountFromStrategy(body.voiceStrategy||body),'Exportação de robô MT5');
   let code=makeMql5Strategy(body); code=String(code).replace(/\\n/g,'\r\n').replace(/\\r/g,''); code=code.replace(/input\s+int\s+StopLoss_Points\s*=\s*\d+\s*;/g,'input int StopLoss_Points = 0; // v53 validação: SL desligado'); code=code.replace(/input\s+int\s+TakeProfit_Points\s*=\s*\d+\s*;/g,'input int TakeProfit_Points = 0; // v53 validação: TP desligado');
   const filename=safe((body.name||'ForexIA_Robo_Gerado'))+'.mq5';
   res.setHeader('Content-Type','text/plain; charset=utf-8');
   res.setHeader('Content-Disposition','attachment; filename="'+filename+'"');
   res.send(code);
 }catch(e){
   console.error('Erro ao gerar MQ5:', e);
   res.status(e.status||500).json({ok:false,error:e.message,code:e.code,cost:e.cost,balance:e.balance,stack:String(e.stack||'')});
 }
});
app.post('/api/strategy/save',authMiddleware,async(req,res)=>{
 try{
   const d=db();
   d.strategies=Array.isArray(d.strategies)?d.strategies:[];
   const body=req.body||{};
   const rec={
     id: body.id || uuidv4(),
     name: body.name || 'Estratégia sem nome',
     json: body,
     userId: req.user.id,
     createdAt: body.createdAt || new Date().toISOString(),
     updatedAt: new Date().toISOString()
   };
   const idx=d.strategies.findIndex(x=>x.id===rec.id);
   if(idx>=0 && !ehDono(d.strategies[idx],req.user.id)) return res.status(403).json({ok:false,error:'Este robô pertence a outra conta.'});
   let billing=null;
   if(idx<0){ billing=await chargeWallet(req.user,'create',getIndicatorsCountFromStrategy(body.voiceStrategy||body),'Criação de robô'); }
   if(idx>=0)d.strategies[idx]=rec; else d.strategies.push(rec);
   save(d);
   res.json({ok:true,strategy:rec,total:d.strategies.length,billing});
 }catch(e){res.status(e.status||500).json({ok:false,error:e.message,code:e.code,cost:e.cost,balance:e.balance})}
});
app.get('/api/strategies',authMiddleware,(req,res)=>{const d=db();res.json(somenteDoUsuario(d.strategies,req.user.id).slice().reverse())});


app.delete('/api/strategies/:id',(req,res)=>{
 const d=db(); d.strategies=d.strategies||[];
 const before=d.strategies.length;
 d.strategies=d.strategies.filter(x=>x.id!==req.params.id);
 save(d); res.json({ok:true,deleted:before-d.strategies.length});
});



function allRobotsUnified(){
 const d=db();
 const out=[];
 const seen=new Set();
 const add=(r,source)=>{
   if(!r) return;
   const json=r.json||r.config||r;
   const id=String(r.id||r.robotId||r.uuid||json.id||json.robotId||json.uuid||'').trim();
   if(!id || seen.has(id)) return;
   seen.add(id);
   out.push({
     ...r,
     id,
     name:r.name||json.name||'Robô sem nome',
     userId:r.userId||json.userId||'', // robôs em pasta guardam o dono dentro do robot.json
     json,
     source:source||r.source||'db',
     createdAt:r.createdAt||json.createdAt||new Date().toISOString(),
     updatedAt:r.updatedAt||json.updatedAt||new Date().toISOString()
   });
 };
 for(const r of (Array.isArray(d.strategies)?d.strategies:[])) add(r,'strategies');
 for(const r of (Array.isArray(d.robots)?d.robots:[])) add(r,'robots');
 for(const r of (Array.isArray(d.savedRobots)?d.savedRobots:[])) add(r,'savedRobots');
 try{ for(const r of readRobotFolders()) add(r,'data/robots'); }catch(e){}
 try{
   const pdir=path.join(DATA_DIR,'projects');
   if(fs.existsSync(pdir)){
     for(const f of fs.readdirSync(pdir)){
       const jf=path.join(pdir,f,'robot.json');
       if(fs.existsSync(jf)) add(JSON.parse(fs.readFileSync(jf,'utf8')),'data/projects');
     }
   }
 }catch(e){}
 return out.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
}
function findRobotUnified(id){
 const key=String(id||'').trim();
 return allRobotsUnified().find(r=>String(r.id)===key || String(r.name)===key || String(r.json?.name)===key)||null;
}

function validationFileTokens(runId=''){
  const tokens=[];
  const add=(x)=>{ const v=String(x||'').toLowerCase().trim(); if(v && !tokens.includes(v)) tokens.push(v); };
  add(runId);
  const r=findRobotUnified(runId);
  if(r){
    add(r.id);
    add(r.name);
    add(r.json?.name);
    add(safeId(r.name||r.json?.name||''));
    add(mqlSafeName(r.name||r.json?.name||''));
  }
  return tokens.filter(Boolean);
}
app.get('/api/robots',authMiddleware,(req,res)=>{
 try{
   res.json(somenteDoUsuario(allRobotsUnified(),req.user.id));
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.get('/api/robots/:id',authMiddleware,(req,res)=>{
 try{
   const robot=findRobotUnified(req.params.id);
   if(robot && !ehDono(robot,req.user.id)) return res.status(403).json({ok:false,error:'Este robô pertence a outra conta.'});
   if(!robot)return res.status(404).json({ok:false,error:'Robô não encontrado'});
   res.json({ok:true,robot});
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});

app.post('/api/robots/current',(req,res)=>{
 try{
   const d=db();
   const id=req.body?.id||null;
   const robot=findRobotUnified(id);
   d.currentRobotId=robot?robot.id:null;
   save(d);
   res.json({ok:true,currentRobot:robot});
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.get('/api/robots/current',(req,res)=>{
 try{
   const d=db();
   const robot=findRobotUnified(d.currentRobotId) || allRobotsUnified()[0] || null;
   res.json({ok:true,currentRobot:robot});
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.post('/api/robots/clear-current',(req,res)=>{
 const d=db(); d.currentRobotId=null; save(d); res.json({ok:true});
});

// =========================
// VOICE MONITOR / WHATSAPP EVOLUTION v123
// =========================
const WHATSAPP_OUTBOX = path.join(DATA_DIR,'whatsapp_outbox.json');
const WHATSAPP_CONFIG = path.join(DATA_DIR,'whatsapp_config.json');
function readJsonArray(file){try{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[]}catch(e){return []}}
function writeJsonArray(file,arr){fs.writeFileSync(file,JSON.stringify(arr,null,2),'utf8')}
function readJsonObject(file,def={}){try{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):def}catch(e){return def}}
function writeJsonObject(file,obj){fs.writeFileSync(file,JSON.stringify(obj,null,2),'utf8')}
function normalizeWhatsapp(n){return String(n||'').replace(/[^0-9+]/g,'').trim()}
function pushWhatsappOutbox(payload){
 const list=readJsonArray(WHATSAPP_OUTBOX);
 const rec={id:uuidv4(),status:'pending',provider:'outbox',createdAt:new Date().toISOString(),...payload};
 list.unshift(rec); writeJsonArray(WHATSAPP_OUTBOX,list.slice(0,500)); return rec;
}
function updateWhatsappOutbox(id,patch){
 const list=readJsonArray(WHATSAPP_OUTBOX);
 const idx=list.findIndex(x=>x.id===id);
 if(idx>=0){list[idx]={...list[idx],...patch,updatedAt:new Date().toISOString()};writeJsonArray(WHATSAPP_OUTBOX,list.slice(0,500));return list[idx]}
 return null;
}
function whatsappDigits(n){
 let d=String(n||'').replace(/\D/g,'');
 // Se o usuário digitar DDD+número brasileiro sem DDI, adiciona 55.
 if(d.length===10 || d.length===11) d='55'+d;
 return d;
}
function getWhatsappConfig(){
 const saved=readJsonObject(WHATSAPP_CONFIG,{});
 return {
   provider: saved.provider || process.env.WHATSAPP_PROVIDER || 'outbox',
   evolutionUrl: saved.evolutionUrl || process.env.EVOLUTION_URL || process.env.EVO_API_URL || 'http://localhost:8080',
   globalKey: saved.globalKey || process.env.EVOLUTION_GLOBAL_KEY || process.env.EVO_GLOBAL_KEY || process.env.EVOLUTION_APIKEY || '',
   instanceName: saved.instanceName || process.env.EVOLUTION_INSTANCE || process.env.EVO_INSTANCE || 'forex-ia',
   instanceToken: saved.instanceToken || process.env.EVOLUTION_INSTANCE_TOKEN || process.env.EVO_API_KEY || process.env.EVOLUTION_APIKEY || '',
   updatedAt: saved.updatedAt || null,
   lastStatus: saved.lastStatus || null,
   lastQr: saved.lastQr || null
 };
}
function publicWhatsappConfig(){
 const c=getWhatsappConfig();
 return {...c,globalKey:c.globalKey?'********':'',instanceToken:c.instanceToken?'********':'',configured:!!(c.evolutionUrl&&c.instanceName&&(c.instanceToken||c.globalKey))};
}
function saveWhatsappConfig(input){
 const current=getWhatsappConfig();
 const next={...current};
 if(input.provider!==undefined) next.provider=String(input.provider||'outbox');
 if(input.evolutionUrl!==undefined) next.evolutionUrl=String(input.evolutionUrl||'').replace(/\/$/,'');
 if(input.instanceName!==undefined) next.instanceName=String(input.instanceName||'forex-ia').trim();
 // Não sobrescreve chaves por ******** quando vier da tela.
 if(input.globalKey!==undefined && String(input.globalKey)!=='********') next.globalKey=String(input.globalKey||'').trim();
 if(input.instanceToken!==undefined && String(input.instanceToken)!=='********') next.instanceToken=String(input.instanceToken||'').trim();
 next.updatedAt=new Date().toISOString();
 writeJsonObject(WHATSAPP_CONFIG,next);
 return next;
}
async function evoFetch(pathUrl,{method='GET',body=null,useGlobal=false}={}){
 const c=getWhatsappConfig();
 const base=String(c.evolutionUrl||'').replace(/\/$/,'');
 const key=useGlobal ? (c.globalKey||c.instanceToken) : (c.instanceToken||c.globalKey);
 if(!base) throw new Error('Evolution URL não configurada. Ex.: http://localhost:8080');
 if(!key) throw new Error('API Key/Token da Evolution não configurado.');
 if(typeof fetch!=='function') throw new Error('Node sem fetch nativo. Use Node 18+.');
 const resp=await fetch(base+pathUrl,{method,headers:{'Content-Type':'application/json','apikey':key},body:body?JSON.stringify(body):undefined});
 const txt=await resp.text().catch(()=>'');
 let json=null; try{json=txt?JSON.parse(txt):null}catch{}
 if(!resp.ok){const msg=json?.message||json?.error||txt||('HTTP '+resp.status); const err=new Error(String(msg).slice(0,600)); err.status=resp.status; err.response=json||txt; throw err;}
 return json ?? {raw:txt,status:resp.status};
}
function extractQrPayload(obj){
 const q=obj?.qrcode?.base64 || obj?.qrcode || obj?.base64 || obj?.code || obj?.pairingCode || obj?.qr || null;
 if(!q) return null;
 const str=String(q);
 if(str.startsWith('data:image')) return str;
 // Alguns endpoints devolvem apenas o código base64, outros devolvem pairingCode/code textual.
 if(str.length>200) return 'data:image/png;base64,'+str;
 return str;
}
async function sendWhatsappNow(to,message){
 const cfg=getWhatsappConfig();
 const provider=String(cfg.provider||'outbox').toLowerCase();
 if(provider==='evolution'){
  if(!cfg.evolutionUrl||!cfg.instanceName)return {sent:false,provider:'evolution',error:'Evolution API não configurada. Abra Instalação > WhatsApp Evolution.'};
  const number=whatsappDigits(to);
  const payload={number,text:message};
  const data=await evoFetch(`/message/sendText/${encodeURIComponent(cfg.instanceName)}`,{method:'POST',body:payload,useGlobal:false});
  return {sent:true,provider:'evolution',status:200,response:JSON.stringify(data).slice(0,1000),error:null};
 }
 return {sent:false,provider:'outbox',error:'WhatsApp real não configurado. A mensagem foi salva em data/whatsapp_outbox.json.'};
}
function voiceSignalMessage({robotName,mode,indicators,pair='EURUSD',timeframe='M5',direction='COMPRA'}){
 return `🤖 FOREX IA - Entrada detectada\n\nRobô: ${robotName||'Robô por Voz'}\nAtivo: ${pair}\nDireção: ${direction}\nTimeframe: ${timeframe}\nEstratégia: ${indicators||'Estratégia por voz'}\nModo: ${mode||'sinal'}\nHorário: ${new Date().toLocaleString('pt-BR')}\n\nConfira na plataforma antes de operar.`;
}
app.get('/api/whatsapp/config',(req,res)=>{res.json({ok:true,config:publicWhatsappConfig(),outbox:readJsonArray(WHATSAPP_OUTBOX).slice(0,20)})});
app.post('/api/whatsapp/config',(req,res)=>{try{const cfg=saveWhatsappConfig(req.body||{});res.json({ok:true,config:publicWhatsappConfig(),saved:{...cfg,globalKey:cfg.globalKey?'********':'',instanceToken:cfg.instanceToken?'********':''}})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post('/api/whatsapp/evolution/create-instance',async (req,res)=>{
 try{
  saveWhatsappConfig(req.body||{});
  const cfg=getWhatsappConfig();
  if(!cfg.instanceName)return res.status(400).json({ok:false,error:'Informe o nome da instância.'});
  const payload={instanceName:cfg.instanceName,qrcode:true,integration:req.body?.integration||'WHATSAPP-BAILEYS'};
  const data=await evoFetch('/instance/create',{method:'POST',body:payload,useGlobal:true});
  const token=data?.hash || data?.token || data?.instance?.token || cfg.instanceToken || '';
  const qr=extractQrPayload(data);
  const saved=saveWhatsappConfig({provider:'evolution',instanceToken:token,instanceName:cfg.instanceName});
  saved.lastQr=qr; saved.lastStatus='created'; writeJsonObject(WHATSAPP_CONFIG,saved);
  res.json({ok:true,config:publicWhatsappConfig(),tokenCreated:!!token,qrcode:qr,data});
 }catch(e){res.status(e.status||500).json({ok:false,error:e.message,response:e.response||null})}
});
app.get('/api/whatsapp/evolution/connect',async (req,res)=>{
 try{
  const cfg=getWhatsappConfig();
  const data=await evoFetch(`/instance/connect/${encodeURIComponent(cfg.instanceName)}`,{method:'GET',useGlobal:true});
  const qr=extractQrPayload(data);
  const saved=getWhatsappConfig(); saved.lastQr=qr; saved.lastStatus='connecting'; saved.updatedAt=new Date().toISOString(); writeJsonObject(WHATSAPP_CONFIG,saved);
  res.json({ok:true,qrcode:qr,data,config:publicWhatsappConfig()});
 }catch(e){res.status(e.status||500).json({ok:false,error:e.message,response:e.response||null})}
});
app.get('/api/whatsapp/evolution/status',async (req,res)=>{
 try{
  const cfg=getWhatsappConfig();
  const data=await evoFetch(`/instance/connectionState/${encodeURIComponent(cfg.instanceName)}`,{method:'GET',useGlobal:true});
  const state=data?.instance?.state || data?.state || data?.connectionState || 'desconhecido';
  const saved=getWhatsappConfig(); saved.lastStatus=state; saved.updatedAt=new Date().toISOString(); writeJsonObject(WHATSAPP_CONFIG,saved);
  res.json({ok:true,state,data,config:publicWhatsappConfig()});
 }catch(e){res.status(e.status||500).json({ok:false,error:e.message,response:e.response||null})}
});
app.post('/api/whatsapp/evolution/logout',async (req,res)=>{
 try{
  const cfg=getWhatsappConfig();
  const data=await evoFetch(`/instance/logout/${encodeURIComponent(cfg.instanceName)}`,{method:'POST',useGlobal:true});
  const saved=getWhatsappConfig(); saved.lastStatus='logout'; saved.lastQr=null; saved.updatedAt=new Date().toISOString(); writeJsonObject(WHATSAPP_CONFIG,saved);
  res.json({ok:true,data,config:publicWhatsappConfig()});
 }catch(e){res.status(e.status||500).json({ok:false,error:e.message,response:e.response||null})}
});
app.post('/api/whatsapp/test',async (req,res)=>{
 try{
  const whatsapp=normalizeWhatsapp(req.body?.whatsapp);
  if(!whatsapp)return res.status(400).json({ok:false,error:'Informe o WhatsApp do usuário.'});
  const msg=voiceSignalMessage({robotName:req.body?.robotName,mode:req.body?.mode,indicators:req.body?.indicators});
  const rec=pushWhatsappOutbox({to:whatsapp,type:'test_signal',message:msg,meta:req.body||{}});
  const delivery=await sendWhatsappNow(whatsapp,msg).catch(e=>({sent:false,provider:'error',error:e.message,response:e.response||null}));
  const updated=updateWhatsappOutbox(rec.id,{status:delivery.sent?'sent':'queued',provider:delivery.provider,delivery});
  res.json({ok:true,sent:!!delivery.sent,queued:updated||rec,delivery,note:delivery.sent?'Mensagem enviada pelo WhatsApp.':'Mensagem salva na fila. Configure Evolution API para envio real.'});
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.post('/api/voice-monitor/start',async (req,res)=>{
 try{
  const d=db(); d.voiceMonitors=Array.isArray(d.voiceMonitors)?d.voiceMonitors:[];
  const robot=findRobotUnified(req.body?.robotId);
  if(!robot)return res.status(404).json({ok:false,error:'Robô não encontrado.'});
  const whatsapp=normalizeWhatsapp(req.body?.whatsapp);
  if(!whatsapp)return res.status(400).json({ok:false,error:'Informe o WhatsApp do usuário.'});
  const mode=String(req.body?.mode||'signal');
  const monitor={id:uuidv4(),robotId:robot.id,robotName:req.body?.robotName||robot.name,mode,whatsapp,sendEntries:req.body?.sendEntries!==false,sendCloses:!!req.body?.sendCloses,dailyReport:!!req.body?.dailyReport,active:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  d.voiceMonitors.unshift(monitor); d.voiceMonitors=d.voiceMonitors.slice(0,200); save(d);
  const indicators=(robot.json?.voiceStrategy?.indicators||[]).map(x=>String(x.type||'').toUpperCase()+' '+(x.period||'')).join(', ');
  const msg=voiceSignalMessage({robotName:monitor.robotName,mode,indicators});
  const out=pushWhatsappOutbox({to:whatsapp,type:'monitor_started',message:msg,meta:{monitorId:monitor.id,robotId:robot.id}});
  const delivery=await sendWhatsappNow(whatsapp,msg).catch(e=>({sent:false,provider:'error',error:e.message,response:e.response||null}));
  const updated=updateWhatsappOutbox(out.id,{status:delivery.sent?'sent':'queued',provider:delivery.provider,delivery});
  res.json({ok:true,sent:!!delivery.sent,monitor,queued:updated||out,delivery,note:delivery.sent?'Monitor iniciado e mensagem enviada.':'Monitor iniciado. Mensagem salva na fila; configure Evolution API para envio real.'});
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.get('/api/voice-monitor',(req,res)=>{try{const d=db();res.json({ok:true,monitors:d.voiceMonitors||[],outbox:readJsonArray(WHATSAPP_OUTBOX).slice(0,50)})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.get('/api/whatsapp/status',(req,res)=>{res.json({ok:true,provider:getWhatsappConfig().provider,evolutionConfigured:publicWhatsappConfig().configured,config:publicWhatsappConfig(),outbox:readJsonArray(WHATSAPP_OUTBOX).slice(0,20)})});



// =========================
// VALIDATION CORE v50
// =========================
const validationDir = path.join(DATA_DIR,'validation');
if(!fs.existsSync(validationDir)) fs.mkdirSync(validationDir,{recursive:true});

// Cache leve para evitar reler CSV grande a cada clique.
// Chave = caminho + mtime + tamanho. Se o MT5 gerar novo arquivo, o cache invalida sozinho.
const mt5CsvCache = new Map();
function readFileCached(file, parser){
  const st = fs.statSync(file);
  const key = file + '|' + st.mtimeMs + '|' + st.size;
  if(mt5CsvCache.has(key)) return mt5CsvCache.get(key);
  // Limita cache para não crescer indefinidamente.
  if(mt5CsvCache.size > 20) mt5CsvCache.clear();
  const rows = parser(fs.readFileSync(file,'utf8'));
  mt5CsvCache.set(key, rows);
  return rows;
}

function safeId(x){
  return String(x||'default').replace(/[^a-zA-Z0-9_-]/g,'_');
}



// =========================
// MT5 CSV IMPORT - v71
// Lê automaticamente arquivos gerados pelo EA no Strategy Tester.
// Procura em Common\Files e também em MQL5\Files dos terminais.
// =========================
function csvCell(v){
  return String(v ?? '').trim().replace(/^"|"$/g,'');
}
function parseMt5ValidationCsv(text){
  const lines = String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
  if(lines.length < 2) return [];
  const headers = lines[0].split(';').map(h=>csvCell(h));
  const out = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(';');
    if(cols.length < 3) continue;
    const row = {};
    headers.forEach((h,idx)=>row[h]=csvCell(cols[idx]));
    const time = row.time || row.barTime || row.datetime || row.date || '';
    const signal = String(row.signal || row.type || row.direction || '').toUpperCase();
    if(!time || !signal) continue;
    out.push({
      runId: row.runId || '',
      symbol: row.symbol || '',
      timeframe: String(row.timeframe || '').replace('PERIOD_',''),
      time,
      barTime: time,
      signal,
      type: signal,
      price: Number(row.price || row.open || 0),
      ema: row.ema !== undefined ? Number(row.ema) : undefined,
      sma: row.sma !== undefined ? Number(row.sma) : undefined,
      rsi: row.rsi !== undefined ? Number(row.rsi) : undefined,
      roc: row.roc !== undefined ? Number(row.roc) : undefined,
      williams: row.williams !== undefined ? Number(row.williams) : undefined,
      macd: row.macd !== undefined ? Number(row.macd) : undefined,
      macdSignal: row.macdSignal !== undefined ? Number(row.macdSignal) : undefined,
      source: 'csv'
    });
  }
  return out;
}

function parseMt5AuditCsv(text){
  const lines = String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
  if(lines.length < 2) return [];
  const headers = lines[0].split(';').map(h=>csvCell(h));
  const out=[];
  for(let i=1;i<lines.length;i++){
    const cols=lines[i].split(';');
    if(cols.length < 5) continue;
    const row={}; headers.forEach((h,idx)=>row[h]=csvCell(cols[idx]));
    const time=row.barTime||row.time||row.datetime||'';
    if(!time) continue;
    const signal=String(row.signal||row.type||'').toUpperCase();
    const bool=v=>['1','true','sim','yes'].includes(String(v||'').toLowerCase());
    const num=v=>{const n=Number(v); return Number.isFinite(n)?n:undefined};
    out.push({
      runId:row.runId||'', symbol:row.symbol||'', timeframe:String(row.timeframe||'').replace('PERIOD_',''),
      time, barTime:time, shift:num(row.shift), barIndexFromNow:num(row.barIndexFromNow),
      open:num(row.open), high:num(row.high), low:num(row.low), close:num(row.close), entryPrice:num(row.entryPrice), price:num(row.entryPrice||row.open),
      signal, type:signal, reason:row.reason||'', inHour:bool(row.inHour), warmupOK:bool(row.warmupOK),
      ema:num(row.ema), rsi:num(row.rsi), macd:num(row.macd), macdSignal:num(row.macdSignal), macdHist:num(row.macdHist), roc:num(row.roc),
      condCloseGtEma:bool(row.condCloseGtEma), condCloseLtEma:bool(row.condCloseLtEma), condRsiGt50:bool(row.condRsiGt50), condRsiLt50:bool(row.condRsiLt50),
      condMacdUp:bool(row.condMacdUp), condMacdDown:bool(row.condMacdDown), buyOK:bool(row.buyOK), sellOK:bool(row.sellOK), useMACD:bool(row.useMACD),
      emaPeriod:num(row.emaPeriod), rsiPeriod:num(row.rsiPeriod), macdFast:num(row.macdFast), macdSlow:num(row.macdSlow), macdSignalPeriod:num(row.macdSignalPeriod),
      source:'audit-csv'
    });
  }
  return out;
}
function walkForAuditCsv(dir, depth=0, acc=[]){
  try{
    if(!dir || !fs.existsSync(dir) || depth > 6) return acc;
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,ent.name);
      if(ent.isDirectory()){
        if(['node_modules','bases','logs','tester','config','cache'].includes(ent.name.toLowerCase())) continue;
        walkForAuditCsv(full, depth+1, acc);
      }else if(/^ForexIA_MT5_AUDIT_.*\.csv$/i.test(ent.name)){
        const st=fs.statSync(full); acc.push({path:full,name:ent.name,mtimeMs:st.mtimeMs,size:st.size});
      }
    }
  }catch(_e){}
  return acc;
}
function findLatestMt5AuditCsv(runId=''){
  let files=[]; for(const d of mt5CsvSearchDirs()) files=files.concat(walkForAuditCsv(d));
  const seen=new Set(); files=files.filter(f=>{const k=f.path.toLowerCase(); if(seen.has(k))return false; seen.add(k); return true;});
  const tokens=validationFileTokens(runId).map(x=>String(x).toLowerCase()).filter(Boolean);
  if(tokens.length){ files=files.filter(f=>tokens.some(tok=>f.name.toLowerCase().includes(tok))); }
  files.sort((a,b)=>b.mtimeMs-a.mtimeMs); return files[0]||null;
}
function loadMt5AuditWithCsvFallback(runId){
  const safe=safeId(runId);
  const found=findLatestMt5AuditCsv(safe);
  if(found){
    const audit=readFileCached(found.path, parseMt5AuditCsv);
    if(audit.length) return {audit, source:'audit-csv', csvFile:found.path};
  }
  return {audit:[], source:'none', csvFile:null};
}
function indexAuditV80(audit){
  const byKey=new Map(), byTime=new Map();
  for(const a of audit||[]){
    const n=normalizedOpV75(a,{symbol:a.symbol,timeframe:a.timeframe});
    const k=keyV75(n), t=timeKeyV75(n);
    if(k && !byKey.has(k)) byKey.set(k,a);
    if(t && !byTime.has(t)) byTime.set(t,a);
  }
  return {byKey,byTime};
}
function auditDiagnosisV80(d, auditRow){
  if(!auditRow) return 'Sem linha de auditoria do MT5 para este candle';
  const pSig=normalizeSignalV75(d.platform), mSig=normalizeSignalV75(d.mt5||auditRow);
  if(d.reason==='Sinal diferente'){
    const parts=[];
    if(auditRow.reason) parts.push('MT5: '+auditRow.reason);
    if(auditRow.signal==='CALL') parts.push(`CALL por close>${auditRow.emaPeriod||20}EMA=${auditRow.condCloseGtEma}, RSI>50=${auditRow.condRsiGt50}, MACD up=${auditRow.condMacdUp}`);
    if(auditRow.signal==='PUT') parts.push(`PUT por close<EMA=${auditRow.condCloseLtEma}, RSI<50=${auditRow.condRsiLt50}, MACD down=${auditRow.condMacdDown}`);
    return parts.join(' | ') || `Sinal plataforma=${pSig}, MT5=${mSig}`;
  }
  if(d.reason==='Preço diferente') return `MT5 usa entryPrice=${auditRow.entryPrice}; open=${auditRow.open}; close=${auditRow.close}; diferença=${d.priceDiffPips} pips`;
  if(d.reason==='Falta na plataforma') return `MT5 gerou sinal extra: ${auditRow.reason||auditRow.signal}`;
  if(d.reason==='Falta no MT5') return 'Candle existe na plataforma, mas não foi encontrado como sinal válido no CSV de validação MT5';
  return auditRow.reason || '';
}



// =========================
// REPLAY ENGINE v90
// Compara candle por candle usando o CSV de auditoria do MT5 como verdade detalhada.
// O objetivo é descobrir exatamente qual condição impede chegar a 100%.
// =========================
function inferRootCauseV90(platformOp, auditRow, diff){
  if(!auditRow) return 'Sem auditoria MT5 para este candle';
  const pSig = normalizeSignalV75(platformOp||{});
  const mSig = normalizeSignalV75(auditRow||{});
  if(!pSig && mSig) return 'MT5 gerou sinal, plataforma não gerou sinal neste candle';
  if(pSig && !mSig) return 'Plataforma gerou sinal, MT5 não gerou sinal neste candle';
  if(pSig && mSig && pSig !== mSig){
    const near=[];
    if(Number.isFinite(Number(auditRow.rsi)) && Math.abs(Number(auditRow.rsi)-50)<=1.0) near.push('RSI próximo de 50');
    if(Number.isFinite(Number(auditRow.macdHist)) && Math.abs(Number(auditRow.macdHist))<=0.00002) near.push('MACD histograma próximo de zero');
    if(Number.isFinite(Number(auditRow.close)) && Number.isFinite(Number(auditRow.ema)) && Math.abs(Number(auditRow.close)-Number(auditRow.ema))<=0.00002) near.push('Close próximo da EMA');
    return `Sinal diferente: plataforma=${pSig}, MT5=${mSig}` + (near.length?` (${near.join(', ')})`:'');
  }
  if(diff && diff.reason==='Preço diferente') return `Preço diferente: MT5 entry=${auditRow.entryPrice}, open=${auditRow.open}, close=${auditRow.close}`;
  return auditRow.reason || 'Mesmo candle encontrado; verificar preço/arredondamento';
}

function buildReplayReportV90(platformOps, auditRows, diffs){
  const auditIndex = indexAuditV80(auditRows||[]);
  const diffIndex = new Map();
  for(const d of diffs||[]){
    const target = d.platform || d.mt5 || {};
    const k = keyV75(target) || timeKeyV75(target);
    if(k && !diffIndex.has(k)) diffIndex.set(k,d);
  }
  let candleMatches=0, signalMatches=0, missingAudit=0, signalMismatch=0, priceMismatch=0, platformOnly=0;
  const first=[];
  const rootCounts={};
  for(let i=0;i<(platformOps||[]).length;i++){
    const p=normalizedOpV75(platformOps[i]);
    const a=auditIndex.byKey.get(keyV75(p)) || auditIndex.byTime.get(timeKeyV75(p));
    const d=diffIndex.get(keyV75(p)) || diffIndex.get(timeKeyV75(p));
    if(!a){
      missingAudit++; platformOnly++;
      const root='Sem candle equivalente no AUDIT do MT5'; rootCounts[root]=(rootCounts[root]||0)+1;
      if(first.length<50) first.push({index:i+1,time:p.time,platform:p,mt5:null,audit:null,reason:'Falta auditoria MT5',rootCause:root});
      continue;
    }
    candleMatches++;
    const pSig=normalizeSignalV75(p), mSig=normalizeSignalV75(a);
    const pd=pipDiffV75(p.price, a.entryPrice ?? a.price ?? a.open, p.symbol||a.symbol);
    const priceOk = pd===null || Math.abs(pd)<=2;
    if(pSig===mSig && priceOk){ signalMatches++; continue; }
    if(pSig!==mSig) signalMismatch++; else priceMismatch++;
    const root=inferRootCauseV90(p,a,d||{reason:pSig!==mSig?'Sinal diferente':'Preço diferente',priceDiffPips:pd});
    rootCounts[root]=(rootCounts[root]||0)+1;
    if(first.length<50) first.push({index:i+1,time:p.time,platform:p,mt5:{...a,signal:mSig,price:a.entryPrice??a.price??a.open},audit:a,reason:pSig!==mSig?'Sinal diferente':'Preço diferente',priceDiffPips:pd,rootCause:root,conditions:{close:a.close,ema:a.ema,rsi:a.rsi,macd:a.macd,macdSignal:a.macdSignal,macdHist:a.macdHist,condCloseGtEma:a.condCloseGtEma,condCloseLtEma:a.condCloseLtEma,condRsiGt50:a.condRsiGt50,condRsiLt50:a.condRsiLt50,condMacdUp:a.condMacdUp,condMacdDown:a.condMacdDown,reason:a.reason}});
  }
  const total=(platformOps||[]).length;
  const agreement=total?Number((signalMatches/total*100).toFixed(2)):0;
  const topRootCauses=Object.entries(rootCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([reason,count])=>({reason,count}));
  return {version:'90.0.0',mode:'candle_replay_audit',totalPlatformCandles:total,auditCandles:(auditRows||[]).length,candleMatches,signalMatches,agreement,missingAudit,platformOnly,signalMismatch,priceMismatch,topRootCauses,firstDifferences:first};
}

function walkForCsv(dir, depth=0, acc=[]){
  try{
    if(!dir || !fs.existsSync(dir) || depth > 6) return acc;
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const full = path.join(dir, ent.name);
      if(ent.isDirectory()){
        // Evita varredura pesada em pastas grandes que não interessam.
        if(['node_modules','bases','logs','tester','config','cache'].includes(ent.name.toLowerCase())) continue;
        walkForCsv(full, depth+1, acc);
      }else if(/^ForexIA_MT5_VALIDATION_.*\.csv$/i.test(ent.name)){
        const st = fs.statSync(full);
        acc.push({path:full,name:ent.name,mtimeMs:st.mtimeMs,size:st.size});
      }
    }
  }catch(_e){}
  return acc;
}
function mt5CsvSearchDirs(){
  const dirs = [];
  const add = d => { if(d && !dirs.includes(d)) dirs.push(d); };
  const app = process.env.APPDATA || (process.platform==='win32' ? path.join(process.env.USERPROFILE||'', 'AppData','Roaming') : '');
  const local = process.env.LOCALAPPDATA || (process.platform==='win32' ? path.join(process.env.USERPROFILE||'', 'AppData','Local') : '');
  if(app){
    add(path.join(app,'MetaQuotes','Terminal','Common','Files'));
    add(path.join(app,'MetaQuotes','Terminal'));
  }
  if(local){
    add(path.join(local,'MetaQuotes','Terminal','Common','Files'));
    add(path.join(local,'MetaQuotes','Terminal'));
  }
  // Pasta do projeto: permite copiar o CSV para data/validation_csv se o Windows bloquear o caminho do APPDATA.
  add(path.join(DATA_DIR,'validation_csv'));
  add(process.cwd());
  return dirs;
}
function findLatestMt5Csv(runId=''){
  let files = [];
  for(const d of mt5CsvSearchDirs()) files = files.concat(walkForCsv(d));
  const seen = new Set();
  files = files.filter(f=>{const k=f.path.toLowerCase(); if(seen.has(k))return false; seen.add(k); return true;});
  const tokens = validationFileTokens(runId).map(x=>String(x).toLowerCase()).filter(Boolean);
  if(tokens.length){
    const matched = files.filter(f=>{
      const n=f.name.toLowerCase();
      return tokens.some(tok=> n.includes(tok));
    });
    // v108: se existe CSV do nome/id do robô, usa somente ele. Isso evita importar CSV de outro robô.
    files = matched;
  }
  files.sort((a,b)=>b.mtimeMs-a.mtimeMs);
  return files[0] || null;
}

function fileStateForImport(found){
  if(!found) return {ready:false, state:'missing', reason:'Nenhum CSV encontrado para este robô'};
  const ageMs = Date.now() - Number(found.mtimeMs||0);
  if(!found.size || found.size < 20) return {ready:false, state:'empty', reason:'CSV ainda vazio'};
  // Se o MT5 acabou de alterar o CSV, não leia ainda. Isso evita travamento e leitura parcial.
  if(ageMs < 1800) return {ready:false, state:'writing', reason:'CSV ainda sendo gravado pelo MT5', ageMs};
  try{
    const fd = fs.openSync(found.path, 'r');
    fs.closeSync(fd);
  }catch(e){
    return {ready:false, state:'locked', reason:'CSV bloqueado pelo MT5', code:e.code||''};
  }
  return {ready:true, state:'ready', reason:'CSV pronto para importação', ageMs};
}

function loadMt5TradesWithCsvFallback(runId, opts={}){
  const safe = safeId(runId);
  const jsonFile = path.join(validationDir, safe + '.json');
  let trades = [];
  let source = 'none';
  let csvFile = null;
  let csvMeta = null;

  // v107: NÃO usa cache antigo se não existir CSV do mesmo Run ID.
  // Isso evita cair de 100%/98% para 93% por comparar AT01 com CSV antigo do Teste 2.
  const found = findLatestMt5Csv(safe);
  const state = fileStateForImport(found);
  if(found && state.ready){
    try{
      const csvTrades = readFileCached(found.path, parseMt5ValidationCsv);
      if(csvTrades.length){
        trades = csvTrades;
        source = 'csv';
        csvFile = found.path;
        csvMeta = {name:found.name,mtimeMs:found.mtimeMs,size:found.size,state:state.state};
        try{
          const metaFile = path.join(validationDir, safe + '_mt5_meta.json');
          const oldMeta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile,'utf8')) : null;
          if(!oldMeta || oldMeta.mtimeMs!==found.mtimeMs || oldMeta.size!==found.size){
            fs.writeFileSync(jsonFile, JSON.stringify(trades,null,2), 'utf8');
            fs.writeFileSync(metaFile, JSON.stringify(csvMeta,null,2), 'utf8');
          }
        }catch(_e){}
      }
    }catch(e){
      return {trades:[], source:'csv-error', csvFile:found.path, csvMeta:{name:found.name,mtimeMs:found.mtimeMs,size:found.size,state:'read-error',error:e.message}};
    }
  }else if(opts.allowCached === true && fs.existsSync(jsonFile)){
    // Só usa cache quando explicitamente solicitado. A validação normal não usa, para não misturar robôs.
    try{
      const arr = JSON.parse(fs.readFileSync(jsonFile,'utf8'));
      trades = Array.isArray(arr) ? arr : [];
      source = trades.length ? 'cache' : 'none';
    }catch(_e){}
  }
  if(found && !csvMeta) csvMeta = {name:found.name,mtimeMs:found.mtimeMs,size:found.size,state:state.state,reason:state.reason};
  return {trades, source, csvFile, csvMeta, csvReady:state.ready, csvState:state};
}



// =========================
// PLATFORM AUTO IMPORT - v72
// Se o Backtest Lab foi executado, mas o arquivo runId_platform.json não existe,
// usa automaticamente o backtest mais recente compatível com o CSV do MT5.
// =========================
function normalizeValidationTrade(t){
  const sig = String(t?.signal || t?.type || t?.direction || '').toUpperCase();
  return {
    ...t,
    time: String(t?.time || t?.barTime || t?.datetime || ''),
    barTime: String(t?.barTime || t?.time || t?.datetime || ''),
    signal: sig,
    type: sig,
    price: Number(t?.price ?? t?.entry ?? t?.open ?? 0),
    entry: Number(t?.entry ?? t?.price ?? t?.open ?? 0),
    source: t?.source || 'platform-backtest'
  };
}
function loadPlatformTradesWithBacktestFallback(runId, mt5Trades=[]){
  const safe = safeId(runId);
  const pf = path.join(validationDir, safe + '_platform.json');
  let trades = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf,'utf8')) : [];
  let source = trades.length ? 'platform-json' : 'none';
  let backtestId = null;

  if(!trades.length){
    const d = db();
    let candidates = Array.isArray(d.backtests) ? d.backtests.slice() : [];
    const mt5Symbol = String(mt5Trades?.[0]?.symbol || '').toUpperCase();
    const mt5Tf = String(mt5Trades?.[0]?.timeframe || '').replace('PERIOD_','').toUpperCase();
    if(mt5Symbol || mt5Tf){
      const filtered = candidates.filter(b => (!mt5Symbol || String(b.pair||'').toUpperCase()===mt5Symbol) && (!mt5Tf || String(b.timeframe||'').toUpperCase()===mt5Tf));
      if(filtered.length) candidates = filtered;
    }
    candidates.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    const bt = candidates.find(b => Array.isArray(b?.result?.trades) && b.result.trades.length);
    if(bt){
      trades = bt.result.trades.map(normalizeValidationTrade);
      source = 'latest-backtest';
      backtestId = bt.id;
      try{ fs.writeFileSync(pf, JSON.stringify(trades,null,2), 'utf8'); }catch(_e){}
    }
  }else{
    trades = trades.map(normalizeValidationTrade);
  }
  return {trades, source, backtestId};
}

app.post('/api/validation/mt5/trade',(req,res)=>{
  try{
    const body=req.body||{};
    const runId=safeId(body.runId||body.robotId||body.id||'default');
    const file=path.join(validationDir,runId+'.json');
    const arr=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
    arr.push({...body,receivedAt:new Date().toISOString()});
    fs.writeFileSync(file,JSON.stringify(arr,null,2),'utf8');
    res.json({ok:true,runId,total:arr.length});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});

app.get('/api/validation/mt5/:runId',(req,res)=>{
  try{
    const runId=safeId(req.params.runId);
    const loaded = loadMt5TradesWithCsvFallback(runId);
    res.json({ok:true,runId,total:loaded.trades.length,trades:loaded.trades,source:loaded.source,csvFile:loaded.csvFile,csvState:loaded.csvState?.state||'missing',csvStateReason:loaded.csvState?.reason||''});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});

app.delete('/api/validation/mt5/:runId',(req,res)=>{
  const runId=safeId(req.params.runId);
  const files=[path.join(validationDir,runId+'.json'), path.join(validationDir,runId+'_mt5_meta.json')];
  let removed=0;
  for(const file of files){ try{ if(fs.existsSync(file)){ fs.unlinkSync(file); removed++; } }catch(_e){} }
  res.json({ok:true,runId,removed});
});

app.post('/api/validation/platform',(req,res)=>{
  try{
    const body=req.body||{};
    const runId=safeId(body.runId||body.robotId||body.id||'default');
    const file=path.join(validationDir,runId+'_platform.json');
    fs.writeFileSync(file,JSON.stringify(body.trades||[],null,2),'utf8');
    res.json({ok:true,runId,total:(body.trades||[]).length});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});

app.get('/api/validation/platform/:runId',(req,res)=>{
  try{
    const runId=safeId(req.params.runId);
    const loadedMt5 = loadMt5TradesWithCsvFallback(runId);
    const loadedPlatform = loadPlatformTradesWithBacktestFallback(runId, loadedMt5.trades);
    if(!loadedMt5.trades.length && loadedMt5.source!=='csv'){
      return res.json({ok:true,runId,platformTotal:loadedPlatform.trades.length,mt5Total:0,mt5FilteredTotal:0,same:0,agreement:0,differences:[],stats:{same:0,comparable:0,signalDifferent:0,priceDifferent:0,missingMt5:0,extraMt5:0},replayV90:null,mt5Source:loadedMt5.source,mt5State:loadedMt5.csvState?.state||'missing',mt5StateReason:loadedMt5.csvState?.reason||'Aguardando CSV do MT5 deste robô.',csvFile:loadedMt5.csvFile,auditSource:'none',auditFile:null,auditTotal:0,platformSource:loadedPlatform.source,notice:loadedMt5.csvState?.reason||'Aguardando CSV do MT5 deste robô.'});
    }
    res.json({ok:true,runId,total:loadedPlatform.trades.length,trades:loadedPlatform.trades,source:loadedPlatform.source,backtestId:loadedPlatform.backtestId});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});


// =========================
// VALIDATION COMPARE v75
// Compara por chave (symbol + timeframe + horário), não por posição na lista.
// Isso evita comparar operação 1 da plataforma com operação 1 do MT5 quando há candles extras.
// =========================
function normalizeSignalV75(x){
  const s = String(x?.signal || x?.type || x?.direction || '').toUpperCase().trim();
  if(['BUY','CALL','UP','COMPRA'].includes(s)) return 'CALL';
  if(['SELL','PUT','DOWN','VENDA'].includes(s)) return 'PUT';
  return s;
}
function normalizeTfV75(x){
  return String(x || '').toUpperCase().replace('PERIOD_','').trim();
}
function normalizeSymbolV75(x){
  return String(x || '').toUpperCase().replace(/[^A-Z0-9]/g,'').trim();
}
function normalizeTimeV75(x){
  let t = String(x || '').trim();
  if(!t) return '';
  t = t.replace('T',' ').replace(/-/g,'.').replace(/Z$/,'');
  const m = t.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
  if(m) return `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
  return t.slice(0,16);
}
function timeMsV75(x){
  const t = normalizeTimeV75(x);
  const m = t.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
  if(!m) return NaN;
  return Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
}
function normalizedOpV75(op, meta={}){
  const time = normalizeTimeV75(op?.time || op?.barTime || op?.datetime || op?.date);
  return {
    ...op,
    symbol: normalizeSymbolV75(op?.symbol || op?.pair || meta.symbol || meta.pair),
    timeframe: normalizeTfV75(op?.timeframe || op?.tf || meta.timeframe),
    time,
    barTime: time,
    signal: normalizeSignalV75(op),
    type: normalizeSignalV75(op),
    price: Number(op?.price ?? op?.entry ?? op?.open ?? 0)
  };
}
function keyV75(op){
  const s = normalizeSymbolV75(op?.symbol || op?.pair);
  const tf = normalizeTfV75(op?.timeframe || op?.tf);
  const t = normalizeTimeV75(op?.time || op?.barTime || op?.datetime || op?.date);
  return `${s}|${tf}|${t}`;
}
function timeKeyV75(op){
  return normalizeTimeV75(op?.time || op?.barTime || op?.datetime || op?.date);
}
function indexOpsV75(ops){
  const byKey = new Map(), byTime = new Map();
  for(const op of ops){
    const k = keyV75(op), tk = timeKeyV75(op);
    if(k && !byKey.has(k)) byKey.set(k, op);
    if(tk && !byTime.has(tk)) byTime.set(tk, op);
  }
  return {byKey, byTime};
}
function pipDiffV75(a,b,symbol=''){
  const x=Number(a||0), y=Number(b||0);
  if(!x || !y) return null;
  const isJpy = /JPY/i.test(symbol||'');
  const pip = isJpy ? 0.01 : 0.0001;
  return Number(((x-y)/pip).toFixed(1));
}
function compareValidationV75(platformRaw, mt5Raw){
  const meta = {
    symbol: platformRaw.find(x=>x?.symbol||x?.pair)?.symbol || platformRaw.find(x=>x?.symbol||x?.pair)?.pair || mt5Raw.find(x=>x?.symbol||x?.pair)?.symbol,
    timeframe: platformRaw.find(x=>x?.timeframe||x?.tf)?.timeframe || mt5Raw.find(x=>x?.timeframe||x?.tf)?.timeframe
  };
  const platform = platformRaw.map(x=>normalizedOpV75(x, meta));
  let mt5 = mt5Raw.map(x=>normalizedOpV75(x, meta));

  // Se existe período da plataforma, filtra o MT5 para o mesmo intervalo com margem de 1 candle/hora.
  const times = platform.map(x=>timeMsV75(x.time)).filter(Number.isFinite);
  let range = null;
  if(times.length){
    const min = Math.min(...times), max = Math.max(...times);
    range = {start:new Date(min).toISOString(), end:new Date(max).toISOString()};
    mt5 = mt5.filter(x => {
      const ms = timeMsV75(x.time);
      if(!Number.isFinite(ms)) return true;
      return ms >= min - 60*60*1000 && ms <= max + 60*60*1000;
    });
  }

  const mtIndex = indexOpsV75(mt5);
  const platformIndex = indexOpsV75(platform);
  const matchedMt5 = new Set();
  const differences=[];
  let same=0, signalDifferent=0, priceDifferent=0, missingMt5=0;
  const priceTolerancePips = 2;

  for(let i=0;i<platform.length;i++){
    const p = platform[i];
    const k = keyV75(p);
    let m = mtIndex.byKey.get(k);
    if(!m) m = mtIndex.byTime.get(timeKeyV75(p)); // fallback se símbolo/timeframe vier vazio em algum lado
    if(!m){
      missingMt5++;
      if(differences.length<300) differences.push({index:i+1,reason:'Falta no MT5',platform:p,mt5:null,key:k});
      continue;
    }
    matchedMt5.add(keyV75(m));
    const pSig = normalizeSignalV75(p), mSig = normalizeSignalV75(m);
    const pd = pipDiffV75(p.price, m.price, p.symbol || m.symbol);
    const priceOk = pd===null || Math.abs(pd)<=priceTolerancePips;
    if(pSig === mSig && priceOk){
      same++;
    }else{
      if(pSig !== mSig) signalDifferent++;
      else priceDifferent++;
      if(differences.length<300) differences.push({
        index:i+1,
        reason:pSig!==mSig?'Sinal diferente':'Preço diferente',
        platform:p,
        mt5:m,
        key:k,
        priceDiffPips:pd,
        indicators:{
          ema:{platform:p.ema,mt5:m.ema},
          rsi:{platform:p.rsi,mt5:m.rsi},
          macd:{platform:p.macd,mt5:m.macd},
          macdSignal:{platform:p.macdSignal,mt5:m.macdSignal},
          williams:{platform:p.williams,mt5:m.williams},
          roc:{platform:p.roc,mt5:m.roc}
        }
      });
    }
  }

  let extraMt5=0;
  for(const m of mt5){
    const k = keyV75(m);
    if(!platformIndex.byKey.has(k) && !platformIndex.byTime.has(timeKeyV75(m))){
      extraMt5++;
      if(differences.length<300) differences.push({index:platform.length+extraMt5,reason:'Falta na plataforma',platform:null,mt5:m,key:k});
    }
  }
  const comparable = platform.length;
  const agreement = comparable ? Number((same/comparable*100).toFixed(2)) : 0;
  return {platform, mt5, same, agreement, differences, stats:{same, comparable, signalDifferent, priceDifferent, missingMt5, extraMt5, mt5FilteredTotal:mt5.length, mt5OriginalTotal:mt5Raw.length, range}};
}



// v107: limpa somente cache MT5 do Run ID selecionado, sem apagar backtest da plataforma.
app.post('/api/validation/clear-mt5/:runId',(req,res)=>{
  try{
    const runId=safeId(req.params.runId);
    const files=[path.join(validationDir, runId+'.json'), path.join(validationDir, runId+'_mt5_meta.json')];
    let removed=0;
    for(const f of files){ try{ if(fs.existsSync(f)){ fs.unlinkSync(f); removed++; } }catch(_e){} }
    res.json({ok:true,runId,removed});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});

// =========================
// VALIDATION LIGHT STATUS v107
// Endpoint leve para o frontend monitorar CSV sem ler o arquivo inteiro.
// Evita travamentos quando o MT5 está escrevendo ou quando o CSV é grande.
// =========================
app.get('/api/validation/status/:runId',(req,res)=>{
  try{
    const runId=safeId(req.params.runId);
    const found=findLatestMt5Csv(runId);
    const csvState=fileStateForImport(found);
    // v107: status leve não lê o CSV nem usa cache antigo. Apenas informa se o arquivo certo existe.
    let mt5Total=0;
    let platformTotal=0, platformSource='none';
    try{
      const pf=path.join(validationDir, runId + '_platform.json');
      if(fs.existsSync(pf)){
        const arr=JSON.parse(fs.readFileSync(pf,'utf8'));
        platformTotal=Array.isArray(arr)?arr.length:0;
        platformSource='platform-json';
      }else{
        const d=db();
        const bts=Array.isArray(d.backtests)?d.backtests.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)):[];
        const bt=bts.find(b=>Array.isArray(b?.result?.trades)&&b.result.trades.length);
        if(bt){ platformTotal=bt.result.trades.length; platformSource='latest-backtest'; }
      }
    }catch(_e){}
    res.json({
      ok:true,
      version:VERSION,
      runId,
      mt5Found:!!found,
      mt5Ready:!!csvState.ready,
      mt5State:csvState.state,
      mt5StateReason:csvState.reason,
      mt5File:found?{name:found.name,path:found.path,mtimeMs:found.mtimeMs,size:found.size}:null,
      mt5Total,
      platformTotal,
      platformSource,
      apiOnline:true,
      note:found?(csvState.ready?'CSV encontrado e pronto para importar.':'CSV encontrado, aguardando o MT5 terminar de gravar.'):'Aguardando CSV do MT5 deste robô.'
    });
  }catch(e){res.status(500).json({ok:false,error:e.message,version:VERSION})}
});

app.get('/api/validation/compare/:runId',(req,res)=>{
  try{
    const runId=safeId(req.params.runId);
    const loadedMt5 = loadMt5TradesWithCsvFallback(runId);
    const loadedPlatform = loadPlatformTradesWithBacktestFallback(runId, loadedMt5.trades);
    const c = compareValidationV75(loadedPlatform.trades, loadedMt5.trades);
    const loadedAudit = loadMt5AuditWithCsvFallback(runId);
    const auditIndex = indexAuditV80(loadedAudit.audit);
    c.differences = c.differences.map(d=>{
      const target = d.mt5 || d.platform || {};
      const a = auditIndex.byKey.get(keyV75(target)) || auditIndex.byTime.get(timeKeyV75(target));
      return {...d, audit:a||null, auditDiagnosis:auditDiagnosisV80(d,a)};
    });
    const replayV90 = buildReplayReportV90(c.platform, loadedAudit.audit, c.differences);
    res.json({ok:true,runId,platformTotal:c.platform.length,mt5Total:loadedMt5.trades.length,mt5FilteredTotal:c.mt5.length,same:c.same,agreement:c.agreement,differences:c.differences,stats:{...c.stats,auditTotal:loadedAudit.audit.length,auditSource:loadedAudit.source},replayV90,mt5Source:loadedMt5.source,csvFile:loadedMt5.csvFile,auditSource:loadedAudit.source,auditFile:loadedAudit.csvFile,auditTotal:loadedAudit.audit.length,platformSource:loadedPlatform.source,backtestId:loadedPlatform.backtestId,notice: c.platform.length? '' : 'Nenhuma operação Web encontrada. Execute o Backtest Lab antes da validação.'});
  }catch(e){res.status(500).json({ok:false,error:e.message,stack:e.stack})}
});

app.get('/api/validation/debug/:runId',(req,res)=>{
  try{
    const runId=safeId(req.params.runId);
    const at = normalizeTimeV75(req.query.time || '');
    const loadedMt5 = loadMt5TradesWithCsvFallback(runId);
    const loadedPlatform = loadPlatformTradesWithBacktestFallback(runId, loadedMt5.trades);
    const c = compareValidationV75(loadedPlatform.trades, loadedMt5.trades);
    const loadedAudit = loadMt5AuditWithCsvFallback(runId);
    const findAt = (arr)=> at ? arr.find(x=>normalizeTimeV75(x.time||x.barTime)===at) : null;
    const auditAt = findAt(loadedAudit.audit);
    res.json({ok:true,runId,time:at||null,summary:{platformTotal:c.platform.length,mt5Total:loadedMt5.trades.length,mt5FilteredTotal:c.mt5.length,same:c.same,agreement:c.agreement,stats:{...c.stats,auditTotal:loadedAudit.audit.length,auditSource:loadedAudit.source}},platform:findAt(c.platform),mt5:findAt(c.mt5),audit:auditAt,firstDifferences:c.differences.slice(0,20)});
  }catch(e){res.status(500).json({ok:false,error:e.message,stack:e.stack})}
});


app.get('/api/validation/replay/:runId',(req,res)=>{
  try{
    const runId=safeId(req.params.runId);
    const loadedMt5 = loadMt5TradesWithCsvFallback(runId);
    const loadedPlatform = loadPlatformTradesWithBacktestFallback(runId, loadedMt5.trades);
    const c = compareValidationV75(loadedPlatform.trades, loadedMt5.trades);
    const loadedAudit = loadMt5AuditWithCsvFallback(runId);
    const replayV90 = buildReplayReportV90(c.platform, loadedAudit.audit, c.differences);
    res.json({ok:true,runId,replayV90,platformSource:loadedPlatform.source,mt5Source:loadedMt5.source,auditSource:loadedAudit.source,auditFile:loadedAudit.csvFile,csvFile:loadedMt5.csvFile});
  }catch(e){res.status(500).json({ok:false,error:e.message,stack:e.stack})}
});

app.get('/api/validation/audit/:runId',(req,res)=>{
  try{
    const runId=safeId(req.params.runId);
    const loaded = loadMt5AuditWithCsvFallback(runId);
    const time = normalizeTimeV75(req.query.time||'');
    let rows = loaded.audit;
    if(time) rows = rows.filter(x=>normalizeTimeV75(x.time||x.barTime)===time);
    res.json({ok:true,runId,total:loaded.audit.length,returned:Math.min(rows.length,200),source:loaded.source,csvFile:loaded.csvFile,rows:rows.slice(0,200)});
  }catch(e){res.status(500).json({ok:false,error:e.message,stack:e.stack})}
});

app.get('/api/validation/mt5-csv/scan',(req,res)=>{
  try{
    let files=[];
    for(const d of mt5CsvSearchDirs()) files=files.concat(walkForCsv(d));
    files.sort((a,b)=>b.mtimeMs-a.mtimeMs);
    let auditFiles=[]; for(const d of mt5CsvSearchDirs()) auditFiles=auditFiles.concat(walkForAuditCsv(d)); auditFiles.sort((a,b)=>b.mtimeMs-a.mtimeMs); res.json({ok:true,dirs:mt5CsvSearchDirs(),total:files.length,files:files.slice(0,20),auditTotal:auditFiles.length,auditFiles:auditFiles.slice(0,20)});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});

// =========================
// UNIFIED CONFIG v53
// =========================
function normalizeRobotConfig(robot, extra={}){
  const j = robot?.json || robot || {};
  const vs = j.voiceStrategy || j.strategyConfig || {mode:'trend',indicators:[]};
  const globalMode = String(vs.mode || j.mode || 'trend').toLowerCase();
  const indicators = (vs.indicators||[]).map(x=>({
    ...x,
    type:String(x.type||'').toLowerCase(),
    period:Number(x.period||14),
    mode:String(x.mode||globalMode).toLowerCase(),
    buy:x.buy,
    sell:x.sell,
    threshold:x.threshold,
    pattern:x.pattern
  }));
  return {
    version:'113.0.0',
    robotId: robot?.id || j.id || extra.robotId || '',
    name: j.name || robot?.name || extra.name || 'Robo',
    mode: globalMode,
    indicators,
    voiceStrategy:{mode:globalMode,indicators},
    filters: j.filters || {startHour:'00:00',endHour:'23:59'},
    execution:{
      model:'binary_candle',
      entryTiming:'next_bar_open',
      expirationCandles:Number(extra.expiration||j.expiration||1),
      stake:Number(extra.stake||j.stake||1),
      payout:Number(extra.payout||j.payout||0.85),
      initialBalance:Number(extra.initial||j.initial||100)
    },
    mt5Compatibility:{
      enabled:true,
      lot:0.01,
      stopLossPoints:0,
      takeProfitPoints:0,
      useFixedSLTP:false,
      note:'Validação usa expiração por candle e payout fixo na plataforma. SL/TP fica desligado para não mudar a lógica.'
    }
  };
}

app.get('/api/robots/:id/config',(req,res)=>{
  const r=findRobotCompat(req.params.id);
  if(!r) return res.status(404).json({ok:false,error:'Robô não encontrado'});
  res.json({ok:true,config:normalizeRobotConfig(r)});
});

app.get('/api/validation/checklist/:id',(req,res)=>{
  const r=findRobotCompat(req.params.id);
  if(!r) return res.status(404).json({ok:false,error:'Robô não encontrado'});
  const cfg=normalizeRobotConfig(r);
  const checks=[
    ['Robô salvo',!!r],
    ['Configuração única JSON',!!cfg],
    ['Indicadores definidos',cfg.indicators.length>0],
    ['Horário definido',!!cfg.filters.startHour && !!cfg.filters.endHour],
    ['Expiração por candle',cfg.execution.expirationCandles>=1],
    ['Payout definido',cfg.execution.payout>0],
    ['SL/TP desligado no MT5',cfg.mt5Compatibility.useFixedSLTP===false],
    ['Modelo de execução documentado',cfg.execution.model==='binary_candle']
  ];
  res.json({ok:true,checks:checks.map(([name,ok])=>({name,ok})),config:cfg});
});


// =========================
// MT5 VALIDATION EA v54
// =========================
function mqlName(s){
  return String(s||'ForexIA_Validation').replace(/[^a-zA-Z0-9_]/g,'_');
}
function makeValidationMq5(robot, cfg){
  const name=mqlName(cfg.name||robot?.name||'ForexIA_Validation');
  const robotId=String(cfg.robotId||robot?.id||'default');
  const inds=cfg.indicators||[];
  const ema=inds.find(x=>x.type==='ema')?.period||20;
  const sma=inds.find(x=>x.type==='sma')?.period||20;
  const rsi=inds.find(x=>x.type==='rsi')?.period||14;
  const roc=inds.find(x=>x.type==='roc')?.period||20;
  const will=inds.find(x=>x.type==='williams')?.period||14;
  const exp=cfg.execution?.expirationCandles||1;
  const startHour=(cfg.filters?.startHour||'00:00').slice(0,2);
  const endHour=(cfg.filters?.endHour||'23:59').slice(0,2);
  return `//+------------------------------------------------------------------+
//| ${name}.mq5                                                      |
//| Forex IA Studio v54 - EA de validação Web x MetaTrader           |
//| Objetivo: gerar sinais SEM SL/TP para comparar com a plataforma. |
//+------------------------------------------------------------------+
#property strict
#property version "54.00"
#property description "EA de validação gerado pelo Forex IA. Sem SL/TP. Expiração por candle."

#include <Trade/Trade.mqh>
CTrade trade;

input string Validation_RunId = "${robotId}";
input string ApiHost = "http://127.0.0.1:3001";
input double Lot = 0.01;
input int EMA_Period = ${ema};
input int SMA_Period = ${sma};
input int RSI_Period = ${rsi};
input int ROC_Period = ${roc};
input int Williams_Period = ${will};
input int Expiration_Candles = ${exp};
input int HoraInicio = ${Number(startHour)||0};
input int HoraFim = ${Number(endHour)||23};
input long Magic = 54054;

// IMPORTANTE PARA VALIDAÇÃO:
// StopLoss e TakeProfit ficam DESLIGADOS.
// A plataforma usa payout/expiração; portanto o MT5 só registra o sinal.
input int StopLoss_Points = 0;
input int TakeProfit_Points = 0;

int hEMA=-1, hSMA=-1, hRSI=-1, hWPR=-1, hMACD=-1;
datetime lastBar=0;
int pendingBars=0;
ulong pendingTicket=0;

bool InHour(){
  MqlDateTime t; TimeToStruct(TimeCurrent(),t);
  if(HoraInicio<=HoraFim) return (t.hour>=HoraInicio && t.hour<=HoraFim);
  return (t.hour>=HoraInicio || t.hour<=HoraFim);
}

double Buf(int handle,int buffer,int shift){
  double v[];
  ArraySetAsSeries(v,true);
  if(CopyBuffer(handle,buffer,shift,1,v)<=0) return EMPTY_VALUE;
  return v[0];
}

double ROC(int period,int shift){
  double c0=iClose(_Symbol,_Period,shift);
  double c1=iClose(_Symbol,_Period,shift+period);
  if(c1==0) return 0;
  return (c0-c1)/c1*100.0;
}

string JsonEscape(string s){
  StringReplace(s,"\\\\","\\\\\\\\");
  StringReplace(s,"\\\"","\\\\\\\"");
  return s;
}

void SendValidation(string signal, datetime barTime, double price, double ema, double sma, double rsi, double roc, double wpr){
  string url=ApiHost+"/api/validation/mt5/trade";
  string urlWizard=ApiHost+"/api/validation/mt5/trade-wizard";
  string body="{";
  body+="\\\"runId\\\":\\\""+JsonEscape(Validation_RunId)+"\\\",";
  body+="\\\"robotId\\\":\\\""+JsonEscape(Validation_RunId)+"\\\",";
  body+="\\\"symbol\\\":\\\""+_Symbol+"\\\",";
  body+="\\\"timeframe\\\":\\\""+EnumToString(_Period)+"\\\",";
  body+="\\\"time\\\":\\\""+TimeToString(barTime,TIME_DATE|TIME_MINUTES)+"\\\",";
  body+="\\\"signal\\\":\\\""+signal+"\\\",";
  body+="\\\"price\\\":"+DoubleToString(price,_Digits)+",";
  body+="\\\"ema\\\":"+DoubleToString(ema,8)+",";
  body+="\\\"sma\\\":"+DoubleToString(sma,8)+",";
  body+="\\\"rsi\\\":"+DoubleToString(rsi,4)+",";
  body+="\\\"roc\\\":"+DoubleToString(roc,6)+",";
  body+="\\\"williams\\\":"+DoubleToString(wpr,4);
  body+="}";
  char data[], result[];
  string headers="Content-Type: application/json\\r\\n";
  StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
  ResetLastError();
  int code=WebRequest("POST",url,headers,3000,data,result,headers);
  Print("VALIDATION ",signal," ",TimeToString(barTime,TIME_DATE|TIME_MINUTES)," HTTP=",code," err=",GetLastError());
}

int OnInit(){
  trade.SetExpertMagicNumber(Magic);
  hEMA=iMA(_Symbol,_Period,EMA_Period,0,MODE_EMA,PRICE_CLOSE);
  hSMA=iMA(_Symbol,_Period,SMA_Period,0,MODE_SMA,PRICE_CLOSE);
  hRSI=iRSI(_Symbol,_Period,RSI_Period,PRICE_CLOSE);
  hWPR=iWPR(_Symbol,_Period,Williams_Period);
  if(hEMA<0 || hSMA<0 || hRSI<0 || hWPR<0){
    Print("Erro criando indicadores.");
    return INIT_FAILED;
  }
  Print("Forex IA Validation v54 iniciado. RunId=",Validation_RunId," SEM SL/TP.");
  return INIT_SUCCEEDED;
}

void OnDeinit(const int reason){
  if(hEMA>=0) IndicatorRelease(hEMA);
  if(hSMA>=0) IndicatorRelease(hSMA);
  if(hRSI>=0) IndicatorRelease(hRSI);
  if(hWPR>=0) IndicatorRelease(hWPR);
}

void CloseExpired(){
  if(pendingTicket==0) return;
  pendingBars++;
  if(pendingBars>=Expiration_Candles){
    if(PositionSelect(_Symbol)){
      trade.PositionClose(_Symbol);
    }
    pendingTicket=0;
    pendingBars=0;
  }
}

void OnTick(){
  datetime bt=iTime(_Symbol,_Period,0);
  if(bt==lastBar) return;
  lastBar=bt;

  CloseExpired();
  if(!InHour()) return;

  // Validação usa candle fechado: shift 1. Entrada na abertura da próxima vela.
  int sh=1;
  double ema=Buf(hEMA,0,sh);
  double sma=Buf(hSMA,0,sh);
  double r=Buf(hRSI,0,sh);
  double w=Buf(hWPR,0,sh);
  double roc=ROC(ROC_Period,sh);
  double close=iClose(_Symbol,_Period,sh);
  if(ema==EMPTY_VALUE || sma==EMPTY_VALUE || r==EMPTY_VALUE || w==EMPTY_VALUE) return;

  bool buy=false, sell=false;

  // Lógica-base v54 para validação:
  // trend: compra quando close > EMA e RSI >= 50; venda quando close < EMA e RSI <= 50.
  // Indicadores extras servem como confirmação leve, sem SL/TP.
  buy = (close > ema && r >= 50);
  sell = (close < ema && r <= 50);

  // Williams confirma extremos relativos quando presente.
  if(Williams_Period>0){
    buy = buy && (w > -80);
    sell = sell && (w < -20);
  }

  if(PositionSelect(_Symbol)) return;

  double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
  double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);
  datetime signalTime=iTime(_Symbol,_Period,sh);

  if(buy){
    if(trade.Buy(Lot,_Symbol,ask,0,0,"ForexIA Validation BUY")){
      pendingTicket=trade.ResultOrder();
      pendingBars=0;
      SendValidation("BUY",signalTime,ask,ema,sma,r,roc,w);
    }
  }else if(sell){
    if(trade.Sell(Lot,_Symbol,bid,0,0,"ForexIA Validation SELL")){
      pendingTicket=trade.ResultOrder();
      pendingBars=0;
      SendValidation("SELL",signalTime,bid,ema,sma,r,roc,w);
    }
  }
}

void OnDeinit(const int reason){
   bool ok1 = PublishTmpAsFinal(CsvTmpFile(), CsvFile());
   bool ok2 = true;
   if(Gravar_Auditoria) ok2 = PublishTmpAsFinal(AuditTmpFile(), AuditFile());
   Print("FOREX IA v115 FINALIZADO. CSV=", CsvFile(), " publicado=", ok1, " audit=", ok2, " reason=", reason);
}
//+------------------------------------------------------------------+
`;
}

app.post('/api/robots/:id/validation-mq5',(req,res)=>{
  try{
    const r=findRobotCompat(req.params.id);
    if(!r) return res.status(404).json({ok:false,error:'Robô não encontrado'});
    const cfg=normalizeRobotConfig(r,req.body||{});
    const code=makeValidationMq5(r,cfg).replace(/\\n/g,'\r\n');
    const fileName=mqlName(cfg.name||r.name)+'_VALIDATION_v54.mq5';
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${fileName}"`);
    res.send(code);
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});


app.get('/api/validation/health',(req,res)=>{
  res.json({ok:true,version:VERSION||'55.0.0',message:'Validation API online'});
});




// =========================
// DATA AUTO FALLBACK v59
// =========================
function dataCandidates(){
  const base=__dirname;
  return [
    path.join(base,'data'),
    path.join(base,'..','data'),
    path.join(base,'..','v58','data'),
    path.join(base,'..','v57','data'),
    path.join(base,'..','v56','data'),
    path.join(base,'..','v55','data'),
    path.join(base,'..','v54','data'),
    path.join(base,'..','v53','data'),
    path.join(base,'..','v52','data'),
    path.join(base,'..','v51','data'),
    path.join(base,'..','v50','data')
  ];
}
function hasRobotsIn(dir){
  try{
    if(fs.existsSync(path.join(dir,'db.json'))){
      const db=JSON.parse(fs.readFileSync(path.join(dir,'db.json'),'utf8'));
      if(Array.isArray(db)&&db.length) return true;
      if(Array.isArray(db.robots)&&db.robots.length) return true;
      if(Array.isArray(db.savedRobots)&&db.savedRobots.length) return true;
    }
    if(fs.existsSync(path.join(dir,'robots.json'))){
      const r=JSON.parse(fs.readFileSync(path.join(dir,'robots.json'),'utf8'));
      if(Array.isArray(r)&&r.length) return true;
      if(Array.isArray(r.robots)&&r.robots.length) return true;
    }
    const rd=path.join(dir,'robots');
    if(fs.existsSync(rd) && fs.readdirSync(rd).some(f=>f.toLowerCase().endsWith('.json'))) return true;
  }catch(e){}
  return false;
}
function activeDataDir(){
  for(const d of dataCandidates()){
    if(fs.existsSync(d) && hasRobotsIn(d)) return d;
  }
  return DATA_DIR;
}
app.get('/api/data-diagnostics',(req,res)=>{
  const rows=dataCandidates().map(d=>({
    dir:d,
    exists:fs.existsSync(d),
    hasRobots:fs.existsSync(d)?hasRobotsIn(d):false,
    db:fs.existsSync(path.join(d,'db.json')),
    robotsJson:fs.existsSync(path.join(d,'robots.json')),
    robotsFolder:fs.existsSync(path.join(d,'robots'))
  }));
  res.json({ok:true,activeDataDir:activeDataDir(),currentDataDir:DATA_DIR,candidates:rows});
});

// =========================
// ROBOT DATABASE COMPAT v58
// =========================
function readRobotsCompat(){
  const out=[];
  const seen=new Set();
  function add(r){
    if(!r) return;
    const id=r.id || r.uuid || r.robotId || r.json?.id || r.json?.uuid || r.config?.id || r.meta?.id;
    const name=r.name || r.json?.name || r.config?.name || r.meta?.name || 'Robô sem nome';
    const key=id || name+'_'+JSON.stringify(r).slice(0,80);
    if(seen.has(key)) return;
    seen.add(key);
    out.push({...r,id:id||key,name});
  }

  const dirs=[activeDataDir(), ...dataCandidates()];
  for(const dir of [...new Set(dirs)]){
    try{
      const dbFile=path.join(dir,'db.json');
      if(fs.existsSync(dbFile)){
        const db=JSON.parse(fs.readFileSync(dbFile,'utf8'));
        if(Array.isArray(db)) db.forEach(add);
        if(Array.isArray(db.robots)) db.robots.forEach(add);
        if(Array.isArray(db.savedRobots)) db.savedRobots.forEach(add);
        if(db.robot) add(db.robot);
      }
    }catch(e){ console.log('readRobotsCompat db.json',dir,e.message); }

    try{
      const robotsFile=path.join(dir,'robots.json');
      if(fs.existsSync(robotsFile)){
        const arr=JSON.parse(fs.readFileSync(robotsFile,'utf8'));
        if(Array.isArray(arr)) arr.forEach(add);
        else if(Array.isArray(arr.robots)) arr.robots.forEach(add);
      }
    }catch(e){ console.log('readRobotsCompat robots.json',dir,e.message); }

    try{
      const robotsDir=path.join(dir,'robots');
      if(fs.existsSync(robotsDir)){
        for(const f of fs.readdirSync(robotsDir)){
          if(!f.toLowerCase().endsWith('.json')) continue;
          try{ add(JSON.parse(fs.readFileSync(path.join(robotsDir,f),'utf8'))); }catch(e){}
        }
      }
    }catch(e){ console.log('readRobotsCompat folder',dir,e.message); }
  }
  
  // projects fallback inside readRobotsCompat
  try{
    const root=path.join(DATA_DIR,'projects');
    if(fs.existsSync(root)){
      for(const f of fs.readdirSync(root)){
        const jf=path.join(root,f,'robot.json');
        if(fs.existsSync(jf)) add(JSON.parse(fs.readFileSync(jf,'utf8')));
      }
    }
  }catch(e){}
  try{ readRobotFolders().forEach(add); }catch(e){}
  return out;
}

function findRobotCompat(idOrName){
  const folderRobot=findRobotFolderCompat(idOrName); if(folderRobot) return folderRobot;
  const list=readRobotsCompat();
  const key=String(idOrName||'').trim();
  return list.find(r =>
    String(r.id||'')===key ||
    String(r.uuid||'')===key ||
    String(r.robotId||'')===key ||
    String(r.json?.id||'')===key ||
    String(r.json?.uuid||'')===key ||
    String(r.name||'')===key ||
    String(r.json?.name||'')===key
  );
}

app.get('/api/robots-compat',(req,res)=>{
  const robots=readRobotsCompat();
  res.json({ok:true,total:robots.length,robots:robots.map(r=>({id:r.id,name:r.name,indicators:r.json?.voiceStrategy?.indicators||r.voiceStrategy?.indicators||[]}))});
});



// =========================
// ROBOT FOLDER STORAGE v67
// =========================
function robotsFolderRoot(){
  const dir=path.join(DATA_DIR,'robots');
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  return dir;
}
function safeRobotId(id){
  return String(id||crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g,'_');
}
function robotFolder(id){
  const dir=path.join(robotsFolderRoot(),safeRobotId(id));
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  return dir;
}
function robotNameOf(r){
  return r?.name || r?.json?.name || r?.config?.name || 'Robô sem nome';
}
function robotIdOf(r){
  return r?.id || r?.uuid || r?.robotId || r?.json?.id || r?.json?.uuid || r?.config?.id || crypto.randomUUID();
}
function normalizeRobotFolderRecord(r){
  const id=robotIdOf(r);
  const name=robotNameOf(r);
  const json=r?.json || r?.config || r || {};
  return {
    schema:'forex-ia-robot-folder-v1',
    id,
    name,
    json,
    createdAt:r?.createdAt || new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
}
function writeRobotFolder(r){
  const rec=normalizeRobotFolderRecord(r);
  const dir=robotFolder(rec.id);
  fs.writeFileSync(path.join(dir,'robot.json'),JSON.stringify(rec,null,2),'utf8');
  return {record:rec,dir};
}
function readRobotFolders(){
  const root=robotsFolderRoot();
  const out=[];
  for(const f of fs.readdirSync(root)){
    const dir=path.join(root,f);
    const jf=path.join(dir,'robot.json');
    if(fs.existsSync(jf)){
      try{
        const rec=JSON.parse(fs.readFileSync(jf,'utf8'));
        out.push({...rec,folder:dir,files:fs.readdirSync(dir)});
      }catch(e){}
    }
  }
  return out;
}
function findRobotFolderCompat(idOrName){
  const key=String(idOrName||'').trim();
  return readRobotFolders().find(r=>String(r.id)===key || String(r.name)===key || String(r.json?.name)===key);
}
function extractRobotsFromDbFile(file){
  const out=[];
  try{
    if(!fs.existsSync(file)) return out;
    const db=JSON.parse(fs.readFileSync(file,'utf8'));
    if(Array.isArray(db)) out.push(...db);
    if(Array.isArray(db.robots)) out.push(...db.robots);
    if(Array.isArray(db.savedRobots)) out.push(...db.savedRobots);
    if(Array.isArray(db.projects)) out.push(...db.projects);
    if(db.robot) out.push(db.robot);
  }catch(e){ console.log('extractRobotsFromDbFile',file,e.message); }
  return out;
}
function migrateAllRobotsToFolders(){
  const migrated=[];
  const sources=[];
  for(const d of dataCandidates ? dataCandidates() : [DATA_DIR]){
    sources.push(path.join(d,'db.json'), path.join(d,'robots.json'));
  }
  for(const file of sources){
    for(const r of extractRobotsFromDbFile(file)){
      const rec=writeRobotFolder(r).record;
      migrated.push({id:rec.id,name:rec.name,source:file});
    }
  }
  // também pega projetos v67
  try{
    const projectsDir=path.join(DATA_DIR,'projects');
    if(fs.existsSync(projectsDir)){
      for(const f of fs.readdirSync(projectsDir)){
        const jf=path.join(projectsDir,f,'robot.json');
        if(fs.existsSync(jf)){
          const rec=writeRobotFolder(JSON.parse(fs.readFileSync(jf,'utf8'))).record;
          migrated.push({id:rec.id,name:rec.name,source:jf});
        }
      }
    }
  }catch(e){}
  return migrated;
}
app.post('/api/robots-folder/migrate',(req,res)=>{
  try{res.json({ok:true,migrated:migrateAllRobotsToFolders(),robots:readRobotFolders()})}
  catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.get('/api/robots-folder',(req,res)=>{
  try{res.json({ok:true,total:readRobotFolders().length,robots:readRobotFolders()})}
  catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.post('/api/robots-folder/import',(req,res)=>{
  try{
    const r=req.body||{};
    const saved=writeRobotFolder(r);
    res.json({ok:true,robot:saved.record,folder:saved.dir});
  }catch(e){res.status(500).json({ok:false,error:e.message})}
});

// =========================
// ROBOT PROJECT STRUCTURE v67
// =========================
function robotProjectRoot(){
  const dir=path.join(DATA_DIR,'projects');
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  return dir;
}
function projectDirFor(id){
  const safe=String(id||'robot').replace(/[^a-zA-Z0-9_-]/g,'_');
  const dir=path.join(robotProjectRoot(),safe);
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  return dir;
}
function normalizeRobotForProject(r){
  const id=r?.id || r?.uuid || r?.robotId || r?.json?.id || r?.json?.uuid || crypto.randomUUID();
  const name=r?.name || r?.json?.name || 'Robô sem nome';
  const json=r?.json || r || {};
  return {
    schema:'forex-ia-robot-project-v1',
    id, name,
    json,
    createdAt:r?.createdAt || new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
}
function saveRobotProject(r, mq5Code){
  const p=normalizeRobotForProject(r);
  const dir=projectDirFor(p.id);
  fs.writeFileSync(path.join(dir,'robot.json'),JSON.stringify(p,null,2),'utf8');
  if(mq5Code){
    const fname=mqlSafeName(p.name||'Robo')+'_VALIDATION_v67.mq5';
    fs.writeFileSync(path.join(dir,fname),mq5Code,'utf8');
    fs.writeFileSync(path.join(dir,'last_validation_mq5.txt'),fname,'utf8');
  }
  return {project:p,dir};
}
function migrateRobotsToProjects(){
  const robots=readRobotsCompat();
  const migrated=[];
  for(const r of robots){
    const p=normalizeRobotForProject(r);
    const dir=projectDirFor(p.id);
    if(!fs.existsSync(path.join(dir,'robot.json'))){
      fs.writeFileSync(path.join(dir,'robot.json'),JSON.stringify(p,null,2),'utf8');
    }
    migrated.push({id:p.id,name:p.name,dir});
  }
  return migrated;
}
function readProjects(){
  const root=robotProjectRoot();
  const out=[];
  for(const f of fs.readdirSync(root)){
    const dir=path.join(root,f);
    const jf=path.join(dir,'robot.json');
    if(fs.existsSync(jf)){
      try{
        const p=JSON.parse(fs.readFileSync(jf,'utf8'));
        out.push({...p,projectDir:dir,files:fs.readdirSync(dir)});
      }catch(e){}
    }
  }
  return out;
}
app.post('/api/projects/migrate',(req,res)=>{
  try{res.json({ok:true,migrated:migrateRobotsToProjects()})}
  catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.get('/api/projects',(req,res)=>{
  try{res.json({ok:true,total:readProjects().length,projects:readProjects()})}
  catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.get('/api/projects/:id',(req,res)=>{
  const p=readProjects().find(x=>x.id===req.params.id);
  if(!p) return res.status(404).json({ok:false,error:'Projeto não encontrado'});
  res.json({ok:true,project:p});
});

// =========================
// MQ5 VALIDATION DOWNLOAD v67
// =========================
function mqlSafeName(s){
  return String(s||'ForexIA_Validation').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_]/g,'_').replace(/_+/g,'_').slice(0,64) || 'ForexIA_Validation';
}
function buildValidationMq5(robot, cfg){
  const safe=mqlSafeName(cfg.name||robot?.name||'ForexIA_Validation');
  const robotId=String(cfg.robotId||robot?.id||'default');
  const inds=cfg.indicators||[];
  const get=(t,d)=>Number((inds.find(x=>x.type===t)||{}).period||d);
  const ema=get('ema',20), sma=get('sma',20), rsi=get('rsi',14), roc=get('roc',20), will=get('williams',14), macd=get('macd',12);
  const exp=Number(cfg.execution?.expirationCandles||1);
  const startH=Number(String(cfg.filters?.startHour||'00:00').slice(0,2))||0;
  const endH=Number(String(cfg.filters?.endHour||'23:59').slice(0,2))||23;
  return `//+------------------------------------------------------------------+
//| ${safe}_VALIDATION_v67.mq5                                       |
//| Forex IA Studio v67 - Expert Advisor de Validacao MT5            |
//| Sem StopLoss/TakeProfit. Registra sinais para comparar Web x MT5.|
//+------------------------------------------------------------------+
#property strict
#property version "67.00"
#property description "FOREX IA Validation EA: sem SL/TP, expiração por candle, log via WebRequest."

#include <Trade/Trade.mqh>
CTrade trade;

input string Validation_RunId = "${robotId}";
input string ApiHost = "http://127.0.0.1:3001";
input double Lot = 0.01;

input int EMA_Period = ${ema};
input int SMA_Period = ${sma};
input int RSI_Period = ${rsi};
input int ROC_Period = ${roc};
input int Williams_Period = ${will};
input int MACD_Fast = 12;
input int MACD_Slow = 26;
input int MACD_Signal = 9;

input int Expiration_Candles = ${exp};
input int HoraInicio = ${startH};
input int HoraFim = ${endH};
input long Magic = 67067;

// VALIDACAO: manter ZERO.
// O backtest da plataforma usa expiração/payout, então SL e TP mudariam a lógica.
input int StopLoss_Points = 0;
input int TakeProfit_Points = 0;

int hEMA=-1, hSMA=-1, hRSI=-1, hWPR=-1, hMACD=-1;
datetime lastBar=0;
ulong pendingTicket=0;
int pendingBars=0;

bool InHour(){
  MqlDateTime t; TimeToStruct(TimeCurrent(),t);
  if(HoraInicio<=HoraFim) return (t.hour>=HoraInicio && t.hour<=HoraFim);
  return (t.hour>=HoraInicio || t.hour<=HoraFim);
}
double Buf(int handle,int buffer,int shift){
  double v[]; ArraySetAsSeries(v,true);
  if(CopyBuffer(handle,buffer,shift,1,v)<=0) return EMPTY_VALUE;
  return v[0];
}
double CalcROC(int period,int shift){
  double c0=iClose(_Symbol,_Period,shift);
  double c1=iClose(_Symbol,_Period,shift+period);
  if(c1==0) return 0.0;
  return (c0-c1)/c1*100.0;
}
string EscapeJson(string s){
  StringReplace(s,"\\\\","\\\\\\\\");
  StringReplace(s,"\\\"","\\\\\\\"");
  return s;
}
void SendValidation(string signal, datetime barTime, double price, double ema, double sma, double rsi, double roc, double wpr, double macdMain, double macdSig){
  string url=ApiHost+"/api/validation/mt5/trade";
  string urlWizard=ApiHost+"/api/validation/mt5/trade-wizard";
  string body="{";
  body+="\\\"runId\\\":\\\""+EscapeJson(Validation_RunId)+"\\\",";
  body+="\\\"robotId\\\":\\\""+EscapeJson(Validation_RunId)+"\\\",";
  body+="\\\"symbol\\\":\\\""+_Symbol+"\\\",";
  body+="\\\"timeframe\\\":\\\""+EnumToString(_Period)+"\\\",";
  body+="\\\"time\\\":\\\""+TimeToString(barTime,TIME_DATE|TIME_MINUTES)+"\\\",";
  body+="\\\"signal\\\":\\\""+signal+"\\\",";
  body+="\\\"price\\\":"+DoubleToString(price,_Digits)+",";
  body+="\\\"ema\\\":"+DoubleToString(ema,8)+",";
  body+="\\\"sma\\\":"+DoubleToString(sma,8)+",";
  body+="\\\"rsi\\\":"+DoubleToString(rsi,4)+",";
  body+="\\\"roc\\\":"+DoubleToString(roc,6)+",";
  body+="\\\"williams\\\":"+DoubleToString(wpr,4)+",";
  body+="\\\"macd\\\":"+DoubleToString(macdMain,8)+",";
  body+="\\\"macdSignal\\\":"+DoubleToString(macdSig,8);
  body+="}";
  char data[], result[];
  string headers="Content-Type: application/json\\r\\n";
  StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
  ResetLastError();
  int code=WebRequest("POST",url,headers,5000,data,result,headers);
  char result2[];
  int code2=WebRequest("POST",urlWizard,headers,5000,data,result2,headers);
  Print("FOREX IA VALIDATION | ",signal," | ",TimeToString(barTime,TIME_DATE|TIME_MINUTES)," | HTTP=",code," | WIZARD=",code2," | err=",GetLastError());
}
int OnInit(){
  trade.SetExpertMagicNumber(Magic);
  hEMA=iMA(_Symbol,_Period,EMA_Period,0,MODE_EMA,PRICE_CLOSE);
  hSMA=iMA(_Symbol,_Period,SMA_Period,0,MODE_SMA,PRICE_CLOSE);
  hRSI=iRSI(_Symbol,_Period,RSI_Period,PRICE_CLOSE);
  hWPR=iWPR(_Symbol,_Period,Williams_Period);
  hMACD=iMACD(_Symbol,_Period,MACD_Fast,MACD_Slow,MACD_Signal,PRICE_CLOSE);
  if(hEMA<0 || hSMA<0 || hRSI<0 || hWPR<0 || hMACD<0){
    Print("FOREX IA VALIDATION ERRO: falha ao criar indicadores.");
    return INIT_FAILED;
  }
  Print("FOREX IA VALIDATION v67 iniciado. RunId=",Validation_RunId," | SEM SL/TP | ApiHost=",ApiHost);
  return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){
  if(hEMA>=0) IndicatorRelease(hEMA);
  if(hSMA>=0) IndicatorRelease(hSMA);
  if(hRSI>=0) IndicatorRelease(hRSI);
  if(hWPR>=0) IndicatorRelease(hWPR);
  if(hMACD>=0) IndicatorRelease(hMACD);
}
void CloseExpired(){
  if(pendingTicket==0) return;
  pendingBars++;
  if(pendingBars>=Expiration_Candles){
    if(PositionSelect(_Symbol)) trade.PositionClose(_Symbol);
    pendingTicket=0;
    pendingBars=0;
  }
}
void OnTick(){
  datetime bt=iTime(_Symbol,_Period,0);
  if(bt==lastBar) return;
  lastBar=bt;

  CloseExpired();
  if(!InHour()) return;
  if(PositionSelect(_Symbol)) return;

  int sh=1; // candle fechado. Entrada na abertura da próxima vela.
  double ema=Buf(hEMA,0,sh);
  double sma=Buf(hSMA,0,sh);
  double r=Buf(hRSI,0,sh);
  double w=Buf(hWPR,0,sh);
  double m=Buf(hMACD,0,sh);
  double ms=Buf(hMACD,1,sh);
  double roc=CalcROC(ROC_Period,sh);
  double close=iClose(_Symbol,_Period,sh);
  if(ema==EMPTY_VALUE || r==EMPTY_VALUE || w==EMPTY_VALUE) return;

  bool buy=(close>ema && r>=50);
  bool sell=(close<ema && r<=50);

  // Confirmações leves; não usar SL/TP.
  if(Williams_Period>0){
    buy = buy && (w > -80);
    sell = sell && (w < -20);
  }

  datetime signalTime=iTime(_Symbol,_Period,sh);
  double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
  double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);

  if(buy){
    SendValidation("CALL",signalTime,ask,ema,sma,r,roc,w,m,ms);
    if(trade.Buy(Lot,_Symbol,ask,0,0,"ForexIA Validation CALL")){
      pendingTicket=trade.ResultOrder();
      pendingBars=0;
    }
  }else if(sell){
    SendValidation("PUT",signalTime,bid,ema,sma,r,roc,w,m,ms);
    if(trade.Sell(Lot,_Symbol,bid,0,0,"ForexIA Validation PUT")){
      pendingTicket=trade.ResultOrder();
      pendingBars=0;
    }
  }
}

void OnDeinit(const int reason){
   bool ok1 = PublishTmpAsFinal(CsvTmpFile(), CsvFile());
   bool ok2 = true;
   if(Gravar_Auditoria) ok2 = PublishTmpAsFinal(AuditTmpFile(), AuditFile());
   Print("FOREX IA v115 FINALIZADO. CSV=", CsvFile(), " publicado=", ok1, " audit=", ok2, " reason=", reason);
}
//+------------------------------------------------------------------+
`;
}



function saveRobotFolderMq5(r, code, fileName){
  const rec=writeRobotFolder(r).record;
  const dir=robotFolder(rec.id);
  fs.writeFileSync(path.join(dir,fileName),code,'utf8');
  fs.writeFileSync(path.join(dir,'last_validation_mq5.txt'),fileName,'utf8');
  return {id:rec.id,dir,fileName};
}


function fallbackRecoveredRobot(id){
  const known = {
    "11a7c27c-a05b-40ce-b610-3602e4a81c63": {
      id:"11a7c27c-a05b-40ce-b610-3602e4a81c63",
      name:"Teste Metatrader",
      json:{
        name:"Teste Metatrader",
        voiceStrategy:{
          mode:"trend",
          indicators:[
            {type:"macd",period:20},
            {type:"rsi",period:14},
            {type:"ema",period:20}
          ]
        },
        filters:{startHour:"00:00",endHour:"23:59"},
        strategy:"voice"
      },
      recovered:true,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    }
  };
  if(known[id]) return known[id];

  // Fallback genérico para não bloquear o download.
  // Depois o usuário pode salvar o robô novamente na tela Criar Robô.
  return {
    id:String(id||crypto.randomUUID()),
    name:"Robo_Recuperado",
    json:{
      name:"Robo_Recuperado",
      voiceStrategy:{
        mode:"trend",
        indicators:[
          {type:"ema",period:20},
          {type:"rsi",period:14},
          {type:"macd",period:20}
        ]
      },
      filters:{startHour:"00:00",endHour:"23:59"},
      strategy:"voice"
    },
    recovered:true,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
}



// =========================
// MQ5 VALIDATION REPLAY v115 - CSV temporário e finalização no OnDeinit
// =========================
function qMql(v){ return String(v ?? '').replace(/\\/g,'\\\\').replace(/"/g,'\\"'); }
function nMql(v,d){ const x=Number(v); return Number.isFinite(x)?x:d; }
function buildValidationMq5V91(robot, cfg){
  const safe=mqlSafeName(cfg.name||robot?.name||'ForexIA_Validation');
  const robotId=String(cfg.robotId||robot?.id||'default');
  const rawInds=(cfg.indicators&&cfg.indicators.length?cfg.indicators:((cfg.voiceStrategy&&cfg.voiceStrategy.indicators)||[]));
  let inds=Array.isArray(rawInds)?rawInds.slice(0,10):[];
  if(!inds.length){ inds=[{type:'ema',period:20},{type:'rsi',period:14},{type:'macd',period:20}]; }
  const globalMode=String((cfg.voiceStrategy&&cfg.voiceStrategy.mode)||cfg.mode||'trend').toLowerCase();
  const startH=Number(String(cfg.filters?.startHour||'00:00').slice(0,2))||0;
  const endH=Number(String(cfg.filters?.endHour||'23:59').slice(0,2))||23;
  const indFns = {
    type: inds.map((x,i)=>`   if(idx==${i}) return "${qMql(String(x.type||'').toLowerCase())}";`).join('\n'),
    mode: inds.map((x,i)=>`   if(idx==${i}) return "${qMql(String((x.mode||globalMode)||'trend').toLowerCase())}";`).join('\n'),
    period: inds.map((x,i)=>`   if(idx==${i}) return ${Math.max(1,Math.floor(nMql(x.period,14)))};`).join('\n'),
    buy: inds.map((x,i)=>`   if(idx==${i}) return ${nMql(x.buy,50)};`).join('\n'),
    sell: inds.map((x,i)=>`   if(idx==${i}) return ${nMql(x.sell,50)};`).join('\n'),
    threshold: inds.map((x,i)=>`   if(idx==${i}) return ${nMql(x.threshold,20)};`).join('\n'),
    pattern: inds.map((x,i)=>`   if(idx==${i}) return "${qMql(String(x.pattern||'engolfo').toLowerCase())}";`).join('\n')
  };
  const typesList = inds.map(x=>String(x.type||'').toUpperCase()).join(', ');
  return `//+------------------------------------------------------------------+
//| ${safe}_VALIDATION_v115.mq5                                      |
//| Forex IA v115 - CSV temporario durante backtest         |
//| Não abre ordens. Apenas gera CSV para validação.                  |
//+------------------------------------------------------------------+
#property strict
#property version   "113.00"
#property description "Forex IA Validation v115: grava TMP e publica CSV final no OnDeinit."

input string RobotName = "${qMql(cfg.name||robot?.name||safe)}";
input string Validation_RunId = "${qMql(robotId)}";
input int HoraInicio = ${startH};
input int HoraFim = ${endH};
input bool Apagar_CSV_Ao_Iniciar = true;
input bool Gravar_Auditoria = true;
input bool Gravar_Somente_Sinais = true;
input int Min_Barras_Aquecimento = 60;

// Filtros opcionais. Deixe vazio para usar apenas o período do Strategy Tester.
input string DataInicial = ""; // formato 2026.03.28
input string DataFinal = "";   // formato 2026.06.26
input bool Usar_Segunda = true;
input bool Usar_Terca = true;
input bool Usar_Quarta = true;
input bool Usar_Quinta = true;
input bool Usar_Sexta = true;
input bool Usar_Sabado = true;
input bool Usar_Domingo = true;

datetime lastBar = 0;

string SafeName(string s){
   string r = "";
   for(int i=0; i<StringLen(s); i++){
      ushort ch = StringGetCharacter(s, i);
      bool bad = (ch==32 || ch==47 || ch==92 || ch==58 || ch==42 || ch==63 || ch==34 || ch==60 || ch==62 || ch==124);
      if(bad) r += "_"; else r += CharToString((uchar)ch);
   }
   return r;
}
string RobotFileBase(){ string n=SafeName(RobotName); if(StringLen(n)<1) n=Validation_RunId; return n; }
string CsvFile(){ return "ForexIA_MT5_VALIDATION_" + RobotFileBase() + ".csv"; }
string CsvTmpFile(){ return "ForexIA_MT5_VALIDATION_" + RobotFileBase() + ".tmp"; }
string AuditFile(){ return "ForexIA_MT5_AUDIT_" + RobotFileBase() + ".csv"; }
string AuditTmpFile(){ return "ForexIA_MT5_AUDIT_" + RobotFileBase() + ".tmp"; }
string TF(){ return EnumToString(_Period); }

int IndicatorCount(){ return ${inds.length}; }
string IndType(int idx){
${indFns.type}
   return "";
}
string IndMode(int idx){
${indFns.mode}
   return "trend";
}
int IndPeriod(int idx){
${indFns.period}
   return 14;
}
double IndBuy(int idx){
${indFns.buy}
   return 50.0;
}
double IndSell(int idx){
${indFns.sell}
   return 50.0;
}
double IndThreshold(int idx){
${indFns.threshold}
   return 20.0;
}
string IndPattern(int idx){
${indFns.pattern}
   return "engolfo";
}

double CloseAt(int shift){ return iClose(_Symbol, _Period, shift); }
double OpenAt(int shift){ return iOpen(_Symbol, _Period, shift); }
double HighAt(int shift){ return iHigh(_Symbol, _Period, shift); }
double LowAt(int shift){ return iLow(_Symbol, _Period, shift); }

bool InHour(datetime t){
   MqlDateTime dt; TimeToStruct(t, dt);
   if(HoraInicio <= HoraFim) return (dt.hour >= HoraInicio && dt.hour <= HoraFim);
   return (dt.hour >= HoraInicio || dt.hour <= HoraFim);
}

bool DateStringToTime(string s, datetime &out){
   if(StringLen(s) < 10) return false;
   string x=s; StringReplace(x,"-","."); StringReplace(x,"/",".");
   out = StringToTime(x + " 00:00");
   return out > 0;
}

bool InDate(datetime t){
   datetime a,b;
   if(DateStringToTime(DataInicial,a) && t < a) return false;
   if(DateStringToTime(DataFinal,b) && t > b + 86399) return false;
   return true;
}

bool InWeekday(datetime t){
   MqlDateTime dt; TimeToStruct(t, dt);
   if(dt.day_of_week==0) return Usar_Domingo;
   if(dt.day_of_week==1) return Usar_Segunda;
   if(dt.day_of_week==2) return Usar_Terca;
   if(dt.day_of_week==3) return Usar_Quarta;
   if(dt.day_of_week==4) return Usar_Quinta;
   if(dt.day_of_week==5) return Usar_Sexta;
   if(dt.day_of_week==6) return Usar_Sabado;
   return true;
}

bool InFilters(datetime t){ return InHour(t) && InDate(t) && InWeekday(t); }

double SMA_JS(int shift, int period){
   int bars=Bars(_Symbol,_Period);
   if(period<=1) return CloseAt(shift);
   if(shift + period - 1 >= bars) return EMPTY_VALUE;
   double sum=0.0;
   for(int s=shift+period-1; s>=shift; s--) sum += CloseAt(s);
   return sum/period;
}

double EMA_JS(int shift, int period){
   if(period <= 1) return CloseAt(shift);
   int bars = Bars(_Symbol, _Period);
   if(shift + period - 1 >= bars) return EMPTY_VALUE;
   double k = 2.0 / (period + 1.0);
   double prev = CloseAt(shift + period - 1);
   for(int s = shift + period - 1; s >= shift; s--){
      double v = CloseAt(s);
      prev = v * k + prev * (1.0 - k);
   }
   return prev;
}

double WMA_JS(int shift, int period){
   int bars=Bars(_Symbol,_Period);
   if(period<=1) return CloseAt(shift);
   if(shift + period - 1 >= bars) return EMPTY_VALUE;
   double sum=0.0, wsum=0.0; int w=1;
   for(int s=shift+period-1; s>=shift; s--){ sum += CloseAt(s)*w; wsum += w; w++; }
   return wsum>0.0 ? sum/wsum : 0.0;
}

double MA_JS(string kind, int shift, int period){
   if(kind=="sma") return SMA_JS(shift,period);
   if(kind=="wma") return WMA_JS(shift,period);
   if(kind=="hma") return WMA_JS(shift, MathMax(1,(int)MathRound(period/2.0)));
   return EMA_JS(shift,period);
}

double RSI_JS(int shift, int period){
   int bars = Bars(_Symbol, _Period);
   if(shift + period + 1 >= bars) return 50.0;
   double gain = 0.0, loss = 0.0;
   for(int s = shift + period + 1; s > shift; s--){
      double prev = CloseAt(s);
      double cur  = CloseAt(s-1);
      double d = cur - prev;
      if(d >= 0.0) gain += d; else loss -= d;
   }
   if(loss == 0.0) return 100.0;
   double rs = gain / loss;
   return 100.0 - (100.0 / (1.0 + rs));
}

double ATR_JS(int shift, int period){
   int bars=Bars(_Symbol,_Period);
   if(period<=1) period=1;
   if(shift + period - 1 >= bars) return 0.0;
   double sum=0.0; double prevClose=CloseAt(shift+period-1);
   for(int s=shift+period-1; s>=shift; s--){
      double hi=HighAt(s), lo=LowAt(s);
      double tr=MathMax(hi-lo, MathMax(MathAbs(hi-prevClose), MathAbs(lo-prevClose)));
      sum += tr;
      prevClose=CloseAt(s);
   }
   return sum/period;
}

double ADX_JS(int shift, int period){
   double atr=ATR_JS(shift,period);
   if(atr<=0.0) return 0.0;
   double ma=EMA_JS(shift,period);
   if(ma==EMPTY_VALUE) return 0.0;
   return MathMin(60.0, MathAbs(CloseAt(shift)-ma)/atr*10.0);
}

double MACD_Main_JS(int shift){
   double fast = EMA_JS(shift, 12);
   double slow = EMA_JS(shift, 26);
   if(fast == EMPTY_VALUE || slow == EMPTY_VALUE) return EMPTY_VALUE;
   return fast - slow;
}

double MACD_Signal_JS(int shift){
   int bars = Bars(_Symbol, _Period);
   if(shift + 9 + 26 >= bars) return EMPTY_VALUE;
   double sum = 0.0; int count = 0;
   for(int s = shift + 8; s >= shift; s--){
      double m = MACD_Main_JS(s);
      if(m == EMPTY_VALUE) return EMPTY_VALUE;
      sum += m; count++;
   }
   return count > 0 ? sum / count : EMPTY_VALUE;
}

double Stoch_JS(int shift, int period){
   int bars=Bars(_Symbol,_Period);
   if(shift + period - 1 >= bars) return 50.0;
   double hi=HighAt(shift), lo=LowAt(shift);
   for(int s=shift+period-1; s>=shift; s--){ hi=MathMax(hi,HighAt(s)); lo=MathMin(lo,LowAt(s)); }
   if(hi==lo) return 50.0;
   return (CloseAt(shift)-lo)/(hi-lo)*100.0;
}

double DonchianUpper_JS(int shift, int period){
   int bars=Bars(_Symbol,_Period); if(shift + period - 1 >= bars) return EMPTY_VALUE;
   double hi=HighAt(shift); for(int s=shift+period-1; s>=shift; s--) hi=MathMax(hi,HighAt(s)); return hi;
}
double DonchianLower_JS(int shift, int period){
   int bars=Bars(_Symbol,_Period); if(shift + period - 1 >= bars) return EMPTY_VALUE;
   double lo=LowAt(shift); for(int s=shift+period-1; s>=shift; s--) lo=MathMin(lo,LowAt(s)); return lo;
}

double ROC_JS(int shift, int period){
   int bars = Bars(_Symbol, _Period);
   if(shift + period >= bars) return 0.0;
   double price = CloseAt(shift);
   double old = CloseAt(shift + period);
   if(old == 0.0) return 0.0;
   return (price - old) / old * 100.0;
}

bool EvalIndicatorCondition(int idx, int shift, bool isBuy){
   string type=IndType(idx), mode=IndMode(idx); int p=IndPeriod(idx); double price=CloseAt(shift);
   if(type=="ema" || type=="sma" || type=="wma" || type=="hma"){
      double ma=MA_JS(type,shift,p); if(ma==EMPTY_VALUE) return false;
      return mode=="bear" ? price<ma : price>ma;
   }
   if(type=="alligator" || type=="ichimoku"){
      double ma=SMA_JS(shift,34); if(ma==EMPTY_VALUE) return false;
      return mode=="bear" ? price<ma : price>ma;
   }
   if(type=="rsi"){
      double r=RSI_JS(shift,p);
      if(mode=="reversal") return isBuy ? (r < IndBuy(idx)) : (r > IndSell(idx));
      return isBuy ? (r > IndBuy(idx)) : (r < IndSell(idx));
   }
   if(type=="adx") return ADX_JS(shift,p) > IndThreshold(idx);
   if(type=="macd"){
      double m=MACD_Main_JS(shift), sig=MACD_Signal_JS(shift); if(m==EMPTY_VALUE || sig==EMPTY_VALUE) return false;
      double hist=m-sig; return isBuy ? hist>0.0 : hist<0.0;
   }
   if(type=="stochastic"){
      double s=Stoch_JS(shift,p); return isBuy ? s<IndBuy(idx) : s>IndSell(idx);
   }
   if(type=="roc" || type=="momentum"){
      double roc=ROC_JS(shift,p); return isBuy ? roc>0.0 : roc<0.0;
   }
   if(type=="williams"){
      double w=Stoch_JS(shift,p)-100.0; return isBuy ? w < -80.0 : w > -20.0;
   }
   if(type=="atr") return ATR_JS(shift,p)>0.0;
   if(type=="supertrend"){
      double ma=EMA_JS(shift,p), atr=ATR_JS(shift,p); if(ma==EMPTY_VALUE) return false;
      return mode=="bear" ? price<ma-atr : price>ma+atr;
   }
   if(type=="donchian"){
      double up=DonchianUpper_JS(shift,p), lo=DonchianLower_JS(shift,p); if(up==EMPTY_VALUE || lo==EMPTY_VALUE) return false;
      return isBuy ? price>=up : price<=lo;
   }
   return true;
}

string ReasonForSide(bool isBuy){
   string r = isBuy ? "CALL:" : "PUT:";
   for(int i=0; i<IndicatorCount(); i++){ r += IndType(i); if(i<IndicatorCount()-1) r += "+"; }
   return r;
}

bool SideOK(int shift, bool isBuy){
   for(int i=0; i<IndicatorCount(); i++) if(!EvalIndicatorCondition(i,shift,isBuy)) return false;
   return true;
}

void WriteValidationCSV(string signal, datetime barTime, double entry){
   string file = CsvTmpFile(); bool exists = FileIsExist(file, FILE_COMMON);
   int h = FileOpen(file, FILE_READ|FILE_WRITE|FILE_CSV|FILE_COMMON|FILE_ANSI, ';');
   if(h == INVALID_HANDLE){ Print("FOREX IA v115 ERRO CSV TMP: ", GetLastError(), " arquivo=", file); return; }
   FileSeek(h, 0, SEEK_END);
   if(!exists || FileTell(h) == 0) FileWrite(h, "runId", "symbol", "timeframe", "time", "signal", "price");
   FileWrite(h, Validation_RunId, _Symbol, TF(), TimeToString(barTime, TIME_DATE|TIME_MINUTES), signal, DoubleToString(entry, _Digits));
   FileFlush(h); FileClose(h);
}

void WriteAuditCSV(datetime barTime, int shift, string signal, string reason, bool inFilter, bool warmupOK, double entry){
   if(!Gravar_Auditoria) return;
   string file = AuditTmpFile(); bool exists = FileIsExist(file, FILE_COMMON);
   int h = FileOpen(file, FILE_READ|FILE_WRITE|FILE_CSV|FILE_COMMON|FILE_ANSI, ';');
   if(h == INVALID_HANDLE){ Print("FOREX IA v115 ERRO AUDIT TMP: ", GetLastError(), " arquivo=", file); return; }
   FileSeek(h, 0, SEEK_END);
   if(!exists || FileTell(h) == 0){
      FileWrite(h,"runId","symbol","timeframe","barTime","shift","open","high","low","close","entryPrice","signal","reason","inFilter","warmupOK","indicators");
   }
   FileWrite(h, Validation_RunId, _Symbol, TF(), TimeToString(barTime,TIME_DATE|TIME_MINUTES), shift,
      DoubleToString(OpenAt(shift),_Digits), DoubleToString(HighAt(shift),_Digits), DoubleToString(LowAt(shift),_Digits), DoubleToString(CloseAt(shift),_Digits), DoubleToString(entry,_Digits),
      signal, reason, inFilter?1:0, warmupOK?1:0, "${qMql(typesList)}");
   FileFlush(h); FileClose(h);
}

bool PublishTmpAsFinal(string tmpFile, string finalFile){
   if(!FileIsExist(tmpFile, FILE_COMMON)) return false;
   FileDelete(finalFile, FILE_COMMON);
   int src = FileOpen(tmpFile, FILE_READ|FILE_TXT|FILE_COMMON|FILE_ANSI);
   if(src == INVALID_HANDLE){ Print("FOREX IA v115 ERRO abrir TMP: ", GetLastError(), " arquivo=", tmpFile); return false; }
   int dst = FileOpen(finalFile, FILE_WRITE|FILE_TXT|FILE_COMMON|FILE_ANSI);
   if(dst == INVALID_HANDLE){ Print("FOREX IA v115 ERRO criar CSV FINAL: ", GetLastError(), " arquivo=", finalFile); FileClose(src); return false; }
   while(!FileIsEnding(src)){
      string line = FileReadString(src);
      if(StringLen(line) > 0 || !FileIsEnding(src)) FileWriteString(dst, line + "\\r\\n");
   }
   FileFlush(dst);
   FileClose(dst);
   FileClose(src);
   FileDelete(tmpFile, FILE_COMMON);
   return true;
}

int OnInit(){
   if(Apagar_CSV_Ao_Iniciar){ FileDelete(CsvFile(), FILE_COMMON); FileDelete(AuditFile(), FILE_COMMON); FileDelete(CsvTmpFile(), FILE_COMMON); FileDelete(AuditTmpFile(), FILE_COMMON); }
   Print("FOREX IA v115 iniciado. Robo=", RobotName, " TMP=", CsvTmpFile(), " FINAL=", CsvFile(), " Indicadores=${qMql(typesList)}");
   return INIT_SUCCEEDED;
}

void OnTick(){
   datetime currentBar = iTime(_Symbol, _Period, 0);
   if(currentBar == 0 || currentBar == lastBar) return;
   lastBar = currentBar;
   int sh = 1;
   int bars = Bars(_Symbol, _Period);
   datetime barTime = iTime(_Symbol, _Period, sh);
   if(barTime == 0) return;
   bool inFilter = InFilters(barTime);
   bool warmupOK = (sh + Min_Barras_Aquecimento < bars);
   // v1.1: sinal continua no candle fechado, mas a entrada usa a abertura do candle novo.
   double entry = OpenAt(0);
   bool buyOK=false, sellOK=false;
   string signal="NONE", reason="NO_SIGNAL";
   if(warmupOK){
      buyOK = SideOK(sh,true);
      sellOK = SideOK(sh,false);
      if(buyOK && !sellOK){ signal="CALL"; reason=ReasonForSide(true); }
      else if(sellOK && !buyOK){ signal="PUT"; reason=ReasonForSide(false); }
      else if(buyOK && sellOK){ reason="AMBOS_VERDADEIROS"; }
   } else reason="WARMUP";
   if(inFilter) WriteAuditCSV(barTime, sh, signal, reason, inFilter, warmupOK, entry);
   if(!inFilter || !warmupOK) return;
   if(signal=="CALL" || signal=="PUT"){
      WriteValidationCSV(signal, barTime, entry);
      Print("FOREX IA v115 TMP: ", signal, " ", TimeToString(barTime,TIME_DATE|TIME_MINUTES), " entry=", DoubleToString(entry,_Digits));
   } else if(!Gravar_Somente_Sinais){
      WriteValidationCSV(signal, barTime, entry);
   }
}

void OnDeinit(const int reason){
   bool ok1 = PublishTmpAsFinal(CsvTmpFile(), CsvFile());
   bool ok2 = true;
   if(Gravar_Auditoria) ok2 = PublishTmpAsFinal(AuditTmpFile(), AuditFile());
   Print("FOREX IA v115 FINALIZADO. CSV=", CsvFile(), " publicado=", ok1, " audit=", ok2, " reason=", reason);
}
//+------------------------------------------------------------------+
`;
}

app.get('/api/robots/:id/validation-mq5',(req,res)=>{
  try{
    let r=findRobotUnified(req.params.id) || findRobotCompat(req.params.id);
    if(!r){
      const p=readProjects().find(x=>x.id===req.params.id || x.name===req.params.id);
      if(p) r=p;
    }
    if(!r){
      migrateRobotsToProjects();
      r=findRobotUnified(req.params.id) || findRobotCompat(req.params.id) || readProjects().find(x=>x.id===req.params.id || x.name===req.params.id);
    }
    if(!r){ r=fallbackRecoveredRobot(req.params.id); writeRobotFolder(r); }
    const cfg=normalizeRobotConfig(r,req.query||{});
    const code=buildValidationMq5V91(r,cfg).replace(/\n/g,'\r\n');
    const fileName=mqlSafeName(cfg.name||r.name||'ForexIA')+'_VALIDATION_v115.mq5';
    saveRobotFolderMq5(r,code,fileName);
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${fileName}"`);
    res.send(code);
  }catch(e){
    res.status(500).send('// Erro ao gerar MQ5 Validation: '+e.message);
  }
});

// MT5 VALIDATION WIZARD v67
// =========================
const validationSessions = {};
function sessionFor(runId){
  if(!validationSessions[runId]){
    validationSessions[runId] = {
      runId,
      createdAt:new Date().toISOString(),
      status:'aguardando_mt5',
      message:'🤖 IA aguardando operações do MetaTrader...',
      mt5Count:0,
      platformCount:0,
      lastOperation:null
    };
  }
  return validationSessions[runId];
}

app.get('/api/validation/wizard/:runId/status',(req,res)=>{
  const s=sessionFor(req.params.runId);
  res.json({ok:true,...s});
});

app.post('/api/validation/wizard/:runId/reset',(req,res)=>{
  validationSessions[req.params.runId] = {
    runId:req.params.runId,
    createdAt:new Date().toISOString(),
    status:'aguardando_mt5',
    message:'🤖 IA aguardando operações do MetaTrader...',
    mt5Count:0,
    platformCount:0,
    lastOperation:null
  };
  res.json({ok:true,...validationSessions[req.params.runId]});
});

// Envolve rota antiga do MT5: se ela existir depois, o EA continua enviando.
// Esta rota garante que o wizard também receba sinais.
app.post('/api/validation/mt5/trade-wizard',(req,res)=>{
  const runId=req.body?.runId || req.body?.robotId || 'default';
  const s=sessionFor(runId);
  s.mt5Count++;
  s.lastOperation=req.body || {};
  s.status='recebendo_operacoes';
  s.message=`🤖 IA recebeu ${s.mt5Count} operação(ões) do MetaTrader...`;
  res.json({ok:true,...s});
});

// v2: bridge de produção read-only fica isolada do legado de backtest/validação.
require('./v2/mt5-production-bridge.cjs')({app,dataDir:DATA_DIR,version:VERSION,logger:console});

app.listen(PORT,()=>console.log(`API Forex IA v${VERSION} em http://localhost:${PORT}`));
