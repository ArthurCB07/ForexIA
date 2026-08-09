//+------------------------------------------------------------------+
//| Robo_Recuperado_VALIDATION_v92_JS_100.mq5                      |
//| Forex IA v92 - Lógica JS exata do Backtest Lab             |
//| Não abre ordens. Apenas gera CSV para validação.                  |
//+------------------------------------------------------------------+
#property strict
#property version   "92.00"
#property description "Forex IA Validation v92: replay sem ordens, regra EMA trend igual ao JS, CSV comum."

input string Validation_RunId = "0c723bd7-a02d-447d-b5d6-424c11ad3432";
input int EMA_Period = 20;
input int RSI_Period = 14;
input bool Use_MACD = true;
input int MACD_Fast = 12;
input int MACD_Slow = 26;
input int MACD_Signal = 9;
input int HoraInicio = 0;
input int HoraFim = 23;
input bool Apagar_CSV_Ao_Iniciar = true;
input bool Gravar_Auditoria = true;
input bool Gravar_Somente_Sinais = true;
input int Min_Barras_Aquecimento = 60;

input string DataInicial = ""; // opcional: 2026.03.28
input string DataFinal = "";   // opcional: 2026.06.26
input bool Usar_Segunda = true;
input bool Usar_Terca = true;
input bool Usar_Quarta = true;
input bool Usar_Quinta = true;
input bool Usar_Sexta = true;
input bool Usar_Sabado = true;
input bool Usar_Domingo = true;

datetime lastBar = 0;
string CsvFile(){ return "ForexIA_MT5_VALIDATION_" + Validation_RunId + ".csv"; }
string AuditFile(){ return "ForexIA_MT5_AUDIT_" + Validation_RunId + ".csv"; }
string TF(){ return EnumToString(_Period); }

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

// EMA igual ao getMA(c,i,'ema',period) do server.cjs: janela curta de N fechamentos.
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

// RSI igual ao getRSI(c,i,period) do server.cjs.
// O JS usa slice(i-period-1, i+1), logo são period+1 variações.
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

double MACD_Main_JS(int shift){
   double fast = EMA_JS(shift, MACD_Fast);
   double slow = EMA_JS(shift, MACD_Slow);
   if(fast == EMPTY_VALUE || slow == EMPTY_VALUE) return EMPTY_VALUE;
   return fast - slow;
}

// Igual ao getMACD(): macdSignal = média simples dos últimos 9 MACDs.
double MACD_Signal_JS(int shift){
   int bars = Bars(_Symbol, _Period);
   if(shift + MACD_Signal + MACD_Slow >= bars) return EMPTY_VALUE;
   double sum = 0.0;
   int count = 0;
   for(int s = shift + MACD_Signal - 1; s >= shift; s--){
      double m = MACD_Main_JS(s);
      if(m == EMPTY_VALUE) return EMPTY_VALUE;
      sum += m;
      count++;
   }
   return count > 0 ? sum / count : EMPTY_VALUE;
}

double ROC_JS(int shift, int period=20){
   int bars = Bars(_Symbol, _Period);
   if(shift + period >= bars) return 0.0;
   double price = CloseAt(shift);
   double old = CloseAt(shift + period);
   if(old == 0.0) return 0.0;
   return (price - old) / old * 100.0;
}

void WriteValidationCSV(string signal, datetime barTime, double entry, double ema, double rsi, double macd, double macdSignal, double roc){
   string file = CsvFile();
   bool exists = FileIsExist(file, FILE_COMMON);
   int h = FileOpen(file, FILE_READ|FILE_WRITE|FILE_CSV|FILE_COMMON|FILE_ANSI, ';');
   if(h == INVALID_HANDLE){ Print("FOREX IA v92 ERRO CSV: ", GetLastError(), " arquivo=", file); return; }
   FileSeek(h, 0, SEEK_END);
   if(!exists || FileTell(h) == 0){
      FileWrite(h, "runId", "symbol", "timeframe", "time", "signal", "price", "ema", "sma", "rsi", "roc", "williams", "macd", "macdSignal");
   }
   FileWrite(h, Validation_RunId, _Symbol, TF(), TimeToString(barTime, TIME_DATE|TIME_MINUTES), signal,
      DoubleToString(entry, _Digits), DoubleToString(ema, 8), DoubleToString(ema, 8), DoubleToString(rsi, 4),
      DoubleToString(roc, 6), DoubleToString(0.0, 4), DoubleToString(macd, 8), DoubleToString(macdSignal, 8));
   FileClose(h);
}

void WriteAuditCSV(datetime barTime, int sh, double open, double high, double low, double close, double entry,
                   string signal, string reason, bool inFilter, bool warmupOK, double ema, double rsi,
                   double macd, double macdSignal, double hist, double roc,
                   bool cGt, bool cLt, bool rGt, bool rLt, bool mUp, bool mDown, bool buyOK, bool sellOK){
   if(!Gravar_Auditoria) return;
   string file = AuditFile();
   bool exists = FileIsExist(file, FILE_COMMON);
   int h = FileOpen(file, FILE_READ|FILE_WRITE|FILE_CSV|FILE_COMMON|FILE_ANSI, ';');
   if(h == INVALID_HANDLE){ Print("FOREX IA v92 ERRO AUDIT: ", GetLastError(), " arquivo=", file); return; }
   FileSeek(h, 0, SEEK_END);
   if(!exists || FileTell(h) == 0){
      FileWrite(h,"runId","symbol","timeframe","barTime","shift","barIndexFromNow","open","high","low","close","entryPrice","signal","reason","inHour","warmupOK","ema","rsi","macd","macdSignal","macdHist","roc","condCloseGtEma","condCloseLtEma","condRsiGt50","condRsiLt50","condMacdUp","condMacdDown","buyOK","sellOK","useMACD","emaPeriod","rsiPeriod","macdFast","macdSlow","macdSignalPeriod");
   }
   FileWrite(h, Validation_RunId, _Symbol, TF(), TimeToString(barTime,TIME_DATE|TIME_MINUTES), sh, sh,
      DoubleToString(open,_Digits), DoubleToString(high,_Digits), DoubleToString(low,_Digits), DoubleToString(close,_Digits), DoubleToString(entry,_Digits),
      signal, reason, inFilter?1:0, warmupOK?1:0, DoubleToString(ema,8), DoubleToString(rsi,4), DoubleToString(macd,8), DoubleToString(macdSignal,8), DoubleToString(hist,8), DoubleToString(roc,6),
      cGt?1:0, cLt?1:0, rGt?1:0, rLt?1:0, mUp?1:0, mDown?1:0, buyOK?1:0, sellOK?1:0, Use_MACD?1:0, EMA_Period, RSI_Period, MACD_Fast, MACD_Slow, MACD_Signal);
   FileClose(h);
}

int OnInit(){
   if(Apagar_CSV_Ao_Iniciar){
      FileDelete(CsvFile(), FILE_COMMON);
      FileDelete(AuditFile(), FILE_COMMON);
      Print("FOREX IA v92: CSVs antigos apagados.");
   }
   Print("FOREX IA v92 JS_100 iniciado. Sem ordens. RunId=", Validation_RunId, " Symbol=", _Symbol, " TF=", TF());
   return INIT_SUCCEEDED;
}

void OnTick(){
   datetime currentBar = iTime(_Symbol, _Period, 0);
   if(currentBar == 0) return;
   if(currentBar == lastBar) return;
   lastBar = currentBar;

   int sh = 1;
   int bars = Bars(_Symbol, _Period);
   datetime barTime = iTime(_Symbol, _Period, sh);
   if(barTime == 0) return;

   bool inFilter = InFilters(barTime);
   bool warmupOK = (bars >= Min_Barras_Aquecimento + MACD_Slow + MACD_Signal + 5) && (sh + Min_Barras_Aquecimento < bars);

   double open = OpenAt(sh), high = HighAt(sh), low = LowAt(sh), close = CloseAt(sh), entry = open;
   double ema = EMPTY_VALUE, rsi = 50.0, macd = EMPTY_VALUE, macdSig = EMPTY_VALUE, hist = 0.0, roc = 0.0;
   bool cGt=false,cLt=false,rGt=false,rLt=false,mUp=false,mDown=false,buyOK=false,sellOK=false;
   string signal="NONE", reason="NO_SIGNAL";

   if(warmupOK){
      ema = EMA_JS(sh, EMA_Period);
      rsi = RSI_JS(sh, RSI_Period);
      macd = MACD_Main_JS(sh);
      macdSig = MACD_Signal_JS(sh);
      roc = ROC_JS(sh, 20);
      if(ema != EMPTY_VALUE && macd != EMPTY_VALUE && macdSig != EMPTY_VALUE){
         hist = macd - macdSig;
         cGt = close > ema; cLt = close < ema;
         rGt = rsi > 50.0; rLt = rsi < 50.0;
         mUp = hist > 0.0; mDown = hist < 0.0;

         // IMPORTANTE v92:
         // O Backtest Lab JS, em voiceStrategy.mode="trend", aplica a EMA como filtro de tendência
         // igual para CALL e PUT: price > EMA. A direção é definida por RSI e MACD.
         // Antes o MQ5 usava PUT com close < EMA, gerando quase o dobro de sinais.
         bool emaTrendOK = cGt;
         buyOK  = emaTrendOK && rGt && (!Use_MACD || mUp);
         sellOK = emaTrendOK && rLt && (!Use_MACD || mDown);

         if(buyOK && !sellOK){ signal="CALL"; reason="CALL:close>ema+rsi>50+macdHist>0"; }
         else if(sellOK && !buyOK){ signal="PUT"; reason="PUT:close>ema+rsi<50+macdHist<0"; }
         else if(!emaTrendOK){ reason="NO_SIGNAL:close<=ema"; }
         else if(!rGt && !rLt){ reason="NO_SIGNAL:rsi=50"; }
         else if(Use_MACD && !mUp && !mDown){ reason="NO_SIGNAL:macdHist=0"; }
         else { reason="NO_SIGNAL:conditions_not_aligned"; }
      }else reason="INDICADOR_EMPTY";
   }else reason="WARMUP";

   if(inFilter) WriteAuditCSV(barTime, sh, open, high, low, close, entry, signal, reason, inFilter, warmupOK, ema, rsi, macd, macdSig, hist, roc, cGt,cLt,rGt,rLt,mUp,mDown,buyOK,sellOK);

   if(!inFilter || !warmupOK) return;
   if(signal=="CALL" || signal=="PUT"){
      WriteValidationCSV(signal, barTime, entry, ema, rsi, macd, macdSig, roc);
      Print("FOREX IA v92 CSV: ", signal, " ", TimeToString(barTime,TIME_DATE|TIME_MINUTES), " entry=", DoubleToString(entry,_Digits), " close=", DoubleToString(close,_Digits), " ema=", DoubleToString(ema,8), " rsi=", DoubleToString(rsi,4), " hist=", DoubleToString(hist,8));
   }else if(!Gravar_Somente_Sinais){
      WriteValidationCSV(signal, barTime, entry, ema, rsi, macd, macdSig, roc);
   }
}
//+------------------------------------------------------------------+
