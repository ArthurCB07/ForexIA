//+------------------------------------------------------------------+
//| ForexIA_Bridge_v26.mq5                                           |
//| MT5 Desktop -> Forex IA Studio v26 Backtest Lab                  |
//+------------------------------------------------------------------+
#property strict
#property version "2.60"

input string UrlServidor = "http://127.0.0.1:3001";
input string Pares = "EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,NZDUSD,EURGBP,EURJPY,GBPJPY,AUDJPY,CADJPY";
input string Timeframes = "M1,M5,M15,H1,D1";
input int AnosHistorico = 1;
input int LoteBarras = 500;
input int AtualizarACadaSegundos = 60;
input bool EnviarHistoricoAoIniciar = true;

ENUM_TIMEFRAMES TfFromString(string tf){StringToUpper(tf); if(tf=="M1")return PERIOD_M1; if(tf=="M5")return PERIOD_M5; if(tf=="M15")return PERIOD_M15; if(tf=="M30")return PERIOD_M30; if(tf=="H1")return PERIOD_H1; if(tf=="H4")return PERIOD_H4; if(tf=="D1")return PERIOD_D1; return PERIOD_CURRENT;}
string Trim(string s){StringTrimLeft(s); StringTrimRight(s); return s;}
string JsonEscape(string s){StringReplace(s,"\\","\\\\"); StringReplace(s,"\"","\\\""); return s;}

bool PostJson(string endpoint,string json){
   char data[], result[]; string headers="Content-Type: application/json\r\n", result_headers;
   StringToCharArray(json,data,0,WHOLE_ARRAY,CP_UTF8);
   if(ArraySize(data)>0) ArrayResize(data,ArraySize(data)-1);
   ResetLastError();
   int code=WebRequest("POST",UrlServidor+endpoint,headers,30000,data,result,result_headers);
   if(code==-1){Print("WebRequest falhou. Erro: ",GetLastError()," URL: ",UrlServidor); return false;}
   Print("HTTP ",code," | ",endpoint," | ",CharArrayToString(result));
   return(code>=200 && code<300);
}
void EnviarStatus(string etapa){
   string json="{";
   json+="\"bridge\":\"v26\",";
   json+="\"terminal\":\"MetaTrader 5 Desktop\",";
   json+="\"account\":"+IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN))+",";
   json+="\"server\":\""+JsonEscape(AccountInfoString(ACCOUNT_SERVER))+"\",";
   json+="\"balance\":"+DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2)+",";
   json+="\"equity\":"+DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2)+",";
   json+="\"etapa\":\""+JsonEscape(etapa)+"\",";
   json+="\"time\":\""+TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS)+"\"}";
   PostJson("/api/mt5/status",json);
}
void EnviarPacote(string symbol,string tfText,MqlRates &rates[],int inicio,int fim){
   int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   string json="{\"bridge\":\"v26\",\"source\":\"MT5_BRIDGE_V26\",\"symbol\":\""+JsonEscape(symbol)+"\",\"timeframe\":\""+JsonEscape(tfText)+"\",\"candles\":[";
   for(int i=inicio;i<fim;i++){
      if(i>inicio) json+=",";
      json+="{\"time\":\""+TimeToString(rates[i].time,TIME_DATE|TIME_MINUTES)+"\",\"open\":"+DoubleToString(rates[i].open,digits)+",\"high\":"+DoubleToString(rates[i].high,digits)+",\"low\":"+DoubleToString(rates[i].low,digits)+",\"close\":"+DoubleToString(rates[i].close,digits)+",\"volume\":"+IntegerToString((long)rates[i].tick_volume)+"}";
   }
   json+="]}";
   if(PostJson("/api/mt5/candles",json)) Print("V26 OK: ",symbol," ",tfText," ",inicio," ate ",fim-1);
}
void EnviarHistorico(string symbol,string tfText,ENUM_TIMEFRAMES tf,bool completo){
   if(!SymbolSelect(symbol,true)){Print("Simbolo nao encontrado: ",symbol); return;}
   datetime ate=TimeCurrent();
   datetime de=completo ? ate-(datetime)(AnosHistorico*365*24*60*60) : ate-(datetime)(3*24*60*60);
   MqlRates rates[]; ArraySetAsSeries(rates,false);
   int copied=CopyRates(symbol,tf,de,ate,rates);
   if(copied<=0){Print("Sem dados: ",symbol," ",tfText," erro ",GetLastError()); return;}
   Print("V26 enviando: ",symbol," ",tfText," candles: ",copied);
   for(int start=0; start<copied; start+=LoteBarras){int end=MathMin(start+LoteBarras,copied); EnviarPacote(symbol,tfText,rates,start,end); Sleep(150);}
}
void EnviarTodos(bool completo){
   string symbols[],tfs[]; int ns=StringSplit(Pares,',',symbols), nt=StringSplit(Timeframes,',',tfs);
   for(int i=0;i<ns;i++){string sym=Trim(symbols[i]); if(sym=="")continue;
      for(int j=0;j<nt;j++){string tfText=Trim(tfs[j]); ENUM_TIMEFRAMES tf=TfFromString(tfText); if(tf==PERIOD_CURRENT)continue; EnviarStatus("Sincronizando "+sym+" "+tfText); EnviarHistorico(sym,tfText,tf,completo);}
   }
   EnviarStatus("Sincronizacao concluida");
}
int OnInit(){Print("FOREX IA BRIDGE V26 INICIADO"); EventSetTimer(AtualizarACadaSegundos); EnviarStatus("EA v26 iniciado"); if(EnviarHistoricoAoIniciar) EnviarTodos(true); return INIT_SUCCEEDED;}
void OnTimer(){EnviarTodos(false);}
void OnDeinit(const int reason){EventKillTimer(); EnviarStatus("EA v26 finalizado");}
