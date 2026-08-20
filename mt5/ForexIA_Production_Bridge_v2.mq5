//+------------------------------------------------------------------+
//| ForexIA_Production_Bridge_v2.mq5                                 |
//| v2 read-only bridge: telemetria autenticada, sem ordens reais.   |
//+------------------------------------------------------------------+
#property strict
#property version "2.00"
#property description "Forex IA v2 production bridge - read only, signed telemetry, no orders."

input string ApiBaseUrl = "http://127.0.0.1:3001";
input string AgentId = "";
input string AgentToken = "";
input int FallbackHeartbeatSec = 5;
input int FallbackSnapshotSec = 5;
input int FallbackTickSampleMs = 250;
input string FallbackCandleTimeframes = "M1,M5,M15";
input bool EnableTickTelemetry = true;
input bool EnableCandleTelemetry = true;
input bool EnableLocalLog = true;

string ConfigVersion = "bootstrap";
bool KillSwitch = false;
string KillSwitchReason = "";
bool TelemetryEnabled = true;
int HeartbeatSec = 5;
int SnapshotSec = 5;
int TickSampleMs = 250;
string CandleTfText = "M1,M5,M15";

string CandleTfNames[];
ENUM_TIMEFRAMES CandleTfEnums[];
datetime LastClosedBars[];

string PendingEvents[];
ulong SequenceNo = 0;
datetime LastConfigPull = 0;
datetime LastHeartbeatAt = 0;
ulong LastTickSampleAt = 0;
string LastTickEvent = "";

string TrimText(string s){ StringTrimLeft(s); StringTrimRight(s); return s; }
string JsonEscape(string s){ StringReplace(s,"\\","\\\\"); StringReplace(s,"\"","\\\""); StringReplace(s,"\r",""); StringReplace(s,"\n"," "); return s; }
string LogFile(){ return "ForexIA_PROD_BRIDGE_" + AgentId + ".log"; }

void LogLine(string text){
   string line = TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + " | " + text;
   Print(line);
   if(!EnableLocalLog) return;
   int h = FileOpen(LogFile(), FILE_READ|FILE_WRITE|FILE_TXT|FILE_COMMON|FILE_ANSI);
   if(h == INVALID_HANDLE) return;
   FileSeek(h, 0, SEEK_END);
   FileWriteString(h, line + "\r\n");
   FileFlush(h);
   FileClose(h);
}

string Sha256Hex(string value){
   uchar src[], hash[];
   uchar key[1];
   key[0] = 0;
   StringToCharArray(value, src, 0, WHOLE_ARRAY, CP_UTF8);
   if(ArraySize(src) > 0) ArrayResize(src, ArraySize(src) - 1);
   if(!CryptEncode(CRYPT_HASH_SHA256, src, key, hash)) return "";
   string out = "";
   for(int i=0; i<ArraySize(hash); i++) out += StringFormat("%02x", hash[i]);
   return out;
}

string SignPayload(string ts, string method, string path, string body){
   return Sha256Hex(AgentToken + "|" + ts + "|" + method + "|" + path + "|" + body);
}

void QueueEvent(string eventJson){
   int n = ArraySize(PendingEvents);
   ArrayResize(PendingEvents, n + 1);
   PendingEvents[n] = eventJson;
   if(ArraySize(PendingEvents) > 200){
      for(int i=1; i<ArraySize(PendingEvents); i++) PendingEvents[i-1] = PendingEvents[i];
      ArrayResize(PendingEvents, 199);
      LogLine("Queue capped at 200 events; oldest item dropped.");
   }
}

bool HttpText(string method, string endpoint, string body, string &response){
   char data[], result[];
   string headers = "Content-Type: " + (method=="GET" ? "text/plain" : "application/json") + "\r\n";
   if(method == "GET"){
      headers += "x-agent-token: " + AgentToken + "\r\n";
      ArrayResize(data, 0);
   }else{
      string ts = IntegerToString((long)TimeGMT());
      string sig = SignPayload(ts, method, endpoint, body);
      headers += "x-agent-id: " + AgentId + "\r\n";
      headers += "x-agent-ts: " + ts + "\r\n";
      headers += "x-agent-signature: " + sig + "\r\n";
      StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
      if(ArraySize(data) > 0) ArrayResize(data, ArraySize(data) - 1);
   }
   string resultHeaders;
   ResetLastError();
   int code = WebRequest(method, ApiBaseUrl + endpoint, headers, 10000, data, result, resultHeaders);
   int lastErr = GetLastError();
   response = ArraySize(result) > 0 ? CharArrayToString(result) : "";
   if(code == -1){
      // v1.2: preserva o erro real do WebRequest antes de tocar no buffer de resposta.
      LogLine("HTTP fail " + endpoint + " err=" + IntegerToString(lastErr));
      return false;
   }
   if(code < 200 || code >= 300){
      LogLine("HTTP " + IntegerToString(code) + " " + endpoint + " body=" + response);
      return false;
   }
   return true;
}

ENUM_TIMEFRAMES TfFromString(string tf){
   StringToUpper(tf);
   if(tf=="M1") return PERIOD_M1;
   if(tf=="M5") return PERIOD_M5;
   if(tf=="M15") return PERIOD_M15;
   if(tf=="M30") return PERIOD_M30;
   if(tf=="H1") return PERIOD_H1;
   if(tf=="H4") return PERIOD_H4;
   if(tf=="D1") return PERIOD_D1;
   return PERIOD_CURRENT;
}

void ParseConfiguredTimeframes(string raw){
   string parts[];
   int total = StringSplit(raw, ',', parts);
   ArrayResize(CandleTfNames, 0);
   ArrayResize(CandleTfEnums, 0);
   ArrayResize(LastClosedBars, 0);
   for(int i=0; i<total; i++){
      string name = TrimText(parts[i]);
      if(name == "") continue;
      ENUM_TIMEFRAMES tf = TfFromString(name);
      if(tf == PERIOD_CURRENT) continue;
      int pos = ArraySize(CandleTfNames);
      ArrayResize(CandleTfNames, pos + 1);
      ArrayResize(CandleTfEnums, pos + 1);
      ArrayResize(LastClosedBars, pos + 1);
      CandleTfNames[pos] = name;
      CandleTfEnums[pos] = tf;
      LastClosedBars[pos] = 0;
   }
}

bool ApplyRemoteConfig(string response){
   string normalized = response;
   StringReplace(normalized, "\r", "");
   string lines[];
   int total = StringSplit(normalized, '\n', lines);
   string signature = "";
   string content = "";
   string version = ConfigVersion;
   bool killSwitch = KillSwitch;
   string killReason = KillSwitchReason;
   bool telemetry = TelemetryEnabled;
   int hb = FallbackHeartbeatSec;
   int snapshot = FallbackSnapshotSec;
   int tickMs = FallbackTickSampleMs;
   string tfText = FallbackCandleTimeframes;

   for(int i=0; i<total; i++){
      string line = TrimText(lines[i]);
      if(line == "") continue;
      if(StringFind(line, "signature=") == 0){
         signature = StringSubstr(line, 10);
         continue;
      }
      content += (content == "" ? "" : "\n") + line;
      int eq = StringFind(line, "=");
      if(eq <= 0) continue;
      string key = StringSubstr(line, 0, eq);
      string value = StringSubstr(line, eq + 1);
      if(key == "config_version") version = value;
      else if(key == "kill_switch") killSwitch = (value == "1");
      else if(key == "kill_switch_reason") killReason = value;
      else if(key == "telemetry_enabled") telemetry = (value != "0");
      else if(key == "heartbeat_sec") hb = (int)StringToInteger(value);
      else if(key == "snapshot_sec") snapshot = (int)StringToInteger(value);
      else if(key == "tick_sample_ms") tickMs = (int)StringToInteger(value);
      else if(key == "candle_timeframes") tfText = value;
   }

   string expected = Sha256Hex(AgentToken + "|CONFIG|" + AgentId + "|" + content);
   if(signature == "" || expected != signature){
      LogLine("Config signature invalid for agent " + AgentId);
      return false;
   }

   ConfigVersion = version;
   KillSwitch = killSwitch;
   KillSwitchReason = killReason;
   TelemetryEnabled = telemetry;
   HeartbeatSec = MathMax(1, hb);
   SnapshotSec = MathMax(1, snapshot);
   TickSampleMs = MathMax(50, tickMs);
   CandleTfText = tfText;
   ParseConfiguredTimeframes(CandleTfText);
   EventKillTimer();
   EventSetTimer(MathMax(1, SnapshotSec));
   LogLine("Config applied version=" + ConfigVersion + " killSwitch=" + (KillSwitch ? "1" : "0") + " timeframes=" + CandleTfText);
   return true;
}

bool PullRemoteConfig(){
   string response = "";
   if(AgentId == "" || AgentToken == "") return false;
   string body = "{\"agentId\":\"" + JsonEscape(AgentId) + "\"}";
   bool ok = HttpText("POST", "/api/v2/bridge/config", body, response);
   if(!ok) return false;
   LastConfigPull = TimeCurrent();
   return ApplyRemoteConfig(response);
}

string BuildHeartbeatEvent(){
   int connected = (int)TerminalInfoInteger(TERMINAL_CONNECTED);
   int tradeAllowed = (int)TerminalInfoInteger(TERMINAL_TRADE_ALLOWED);
   int ping = (int)TerminalInfoInteger(TERMINAL_PING_LAST);
   string json = "{";
   json += "\"type\":\"heartbeat\",";
   json += "\"ts\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
   json += "\"agentId\":\"" + JsonEscape(AgentId) + "\",";
   json += "\"mode\":\"read_only\",";
   json += "\"killSwitch\":" + (KillSwitch ? "true" : "false") + ",";
   json += "\"connected\":" + IntegerToString(connected) + ",";
   json += "\"tradeAllowed\":" + IntegerToString(tradeAllowed) + ",";
   json += "\"pingMs\":" + IntegerToString(ping);
   json += "}";
   return json;
}

string BuildAccountEvent(){
   string server = AccountInfoString(ACCOUNT_SERVER);
   long login = (long)AccountInfoInteger(ACCOUNT_LOGIN);
   long leverage = (long)AccountInfoInteger(ACCOUNT_LEVERAGE);
   string json = "{";
   json += "\"type\":\"account_snapshot\",";
   json += "\"ts\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
   json += "\"login\":" + IntegerToString((int)login) + ",";
   json += "\"server\":\"" + JsonEscape(server) + "\",";
   json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   json += "\"marginFree\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   json += "\"leverage\":" + IntegerToString((int)leverage);
   json += "}";
   return json;
}

string BuildSymbolEvent(){
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double spreadPoints = point > 0.0 ? (ask - bid) / point : 0.0;
   string json = "{";
   json += "\"type\":\"symbol_snapshot\",";
   json += "\"ts\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
   json += "\"symbol\":\"" + JsonEscape(_Symbol) + "\",";
   json += "\"timeframe\":\"" + JsonEscape(EnumToString(_Period)) + "\",";
   json += "\"bid\":" + DoubleToString(bid, digits) + ",";
   json += "\"ask\":" + DoubleToString(ask, digits) + ",";
   json += "\"spreadPoints\":" + DoubleToString(spreadPoints, 1);
   json += "}";
   return json;
}

void QueuePositionEvents(){
   for(int i=PositionsTotal()-1; i>=0; i--){
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      string symbol = PositionGetString(POSITION_SYMBOL);
      int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      string json = "{";
      json += "\"type\":\"position_snapshot\",";
      json += "\"ts\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
      json += "\"ticket\":" + IntegerToString((int)ticket) + ",";
      json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      json += "\"positionType\":" + IntegerToString((int)PositionGetInteger(POSITION_TYPE)) + ",";
      json += "\"volume\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
      json += "\"priceOpen\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), digits) + ",";
      json += "\"priceCurrent\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), digits) + ",";
      json += "\"profit\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2);
      json += "}";
      QueueEvent(json);
   }
}

void QueueOrderEvents(){
   for(int i=OrdersTotal()-1; i>=0; i--){
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0) continue;
      if(!OrderSelect(ticket)) continue;
      string symbol = OrderGetString(ORDER_SYMBOL);
      int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      string json = "{";
      json += "\"type\":\"order_snapshot\",";
      json += "\"ts\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
      json += "\"ticket\":" + IntegerToString((int)ticket) + ",";
      json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      json += "\"orderType\":" + IntegerToString((int)OrderGetInteger(ORDER_TYPE)) + ",";
      json += "\"state\":" + IntegerToString((int)OrderGetInteger(ORDER_STATE)) + ",";
      json += "\"volumeInitial\":" + DoubleToString(OrderGetDouble(ORDER_VOLUME_INITIAL), 2) + ",";
      json += "\"priceOpen\":" + DoubleToString(OrderGetDouble(ORDER_PRICE_OPEN), digits);
      json += "}";
      QueueEvent(json);
   }
}

void CaptureTickEvent(){
   if(!EnableTickTelemetry || !TelemetryEnabled || KillSwitch) return;
   ulong nowMs = GetTickCount64();
   if(nowMs - LastTickSampleAt < (ulong)TickSampleMs) return;
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick)) return;
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   LastTickSampleAt = nowMs;
   LastTickEvent = "{";
   LastTickEvent += "\"type\":\"tick\",";
   LastTickEvent += "\"ts\":\"" + TimeToString((datetime)tick.time, TIME_DATE|TIME_SECONDS) + "\",";
   LastTickEvent += "\"symbol\":\"" + JsonEscape(_Symbol) + "\",";
   LastTickEvent += "\"bid\":" + DoubleToString(tick.bid, digits) + ",";
   LastTickEvent += "\"ask\":" + DoubleToString(tick.ask, digits) + ",";
   LastTickEvent += "\"last\":" + DoubleToString(tick.last, digits) + ",";
   LastTickEvent += "\"volume\":" + IntegerToString((int)tick.volume_real);
   LastTickEvent += "}";
}

void CaptureClosedCandles(){
   if(!EnableCandleTelemetry || !TelemetryEnabled || KillSwitch) return;
   for(int i=0; i<ArraySize(CandleTfEnums); i++){
      datetime closedBar = iTime(_Symbol, CandleTfEnums[i], 1);
      if(closedBar == 0 || closedBar == LastClosedBars[i]) continue;
      LastClosedBars[i] = closedBar;
      int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
      string json = "{";
      json += "\"type\":\"closed_candle\",";
      json += "\"ts\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
      json += "\"symbol\":\"" + JsonEscape(_Symbol) + "\",";
      json += "\"timeframe\":\"" + JsonEscape(CandleTfNames[i]) + "\",";
      json += "\"barTime\":\"" + TimeToString(closedBar, TIME_DATE|TIME_MINUTES) + "\",";
      json += "\"open\":" + DoubleToString(iOpen(_Symbol, CandleTfEnums[i], 1), digits) + ",";
      json += "\"high\":" + DoubleToString(iHigh(_Symbol, CandleTfEnums[i], 1), digits) + ",";
      json += "\"low\":" + DoubleToString(iLow(_Symbol, CandleTfEnums[i], 1), digits) + ",";
      json += "\"close\":" + DoubleToString(iClose(_Symbol, CandleTfEnums[i], 1), digits) + ",";
      json += "\"tickVolume\":" + IntegerToString((int)iVolume(_Symbol, CandleTfEnums[i], 1));
      json += "}";
      QueueEvent(json);
   }
}

bool FlushTelemetry(){
   if(AgentId == "" || AgentToken == "") return false;
   string eventsJson = BuildHeartbeatEvent();
   eventsJson += "," + BuildAccountEvent();
   eventsJson += "," + BuildSymbolEvent();
   if(LastTickEvent != "") eventsJson += "," + LastTickEvent;
   for(int i=0; i<ArraySize(PendingEvents); i++) eventsJson += "," + PendingEvents[i];

   string body = "{";
   body += "\"agentId\":\"" + JsonEscape(AgentId) + "\",";
   body += "\"seq\":" + IntegerToString((int)(SequenceNo + 1)) + ",";
   body += "\"configVersion\":\"" + JsonEscape(ConfigVersion) + "\",";
   body += "\"mode\":\"read_only\",";
   body += "\"events\":[" + eventsJson + "]";
   body += "}";

   string response = "";
   bool ok = HttpText("POST", "/api/v2/bridge/events", body, response);
   if(!ok){
      LogLine("Telemetry flush failed.");
      return false;
   }

   SequenceNo++;
   ArrayResize(PendingEvents, 0);
   LastTickEvent = "";
   LastHeartbeatAt = TimeCurrent();
   LogLine("Telemetry batch sent seq=" + IntegerToString((int)SequenceNo));
   return true;
}

int OnInit(){
   HeartbeatSec = MathMax(1, FallbackHeartbeatSec);
   SnapshotSec = MathMax(1, FallbackSnapshotSec);
   TickSampleMs = MathMax(50, FallbackTickSampleMs);
   CandleTfText = FallbackCandleTimeframes;
   ParseConfiguredTimeframes(CandleTfText);
   EventSetTimer(MathMax(1, SnapshotSec));
   LogLine("Bridge init read-only.");
   if(AgentId == "" || AgentToken == ""){
      LogLine("AgentId/AgentToken missing. Configure after provisioning.");
      return INIT_SUCCEEDED;
   }
   PullRemoteConfig();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason){
   EventKillTimer();
   LogLine("Bridge stopped reason=" + IntegerToString(reason));
}

void OnTick(){
   if(!TelemetryEnabled) return;
   CaptureTickEvent();
   CaptureClosedCandles();
}

void OnTimer(){
   if(AgentId == "" || AgentToken == "") return;
   if(LastConfigPull == 0 || (TimeCurrent() - LastConfigPull) >= 30) PullRemoteConfig();
   QueuePositionEvents();
   QueueOrderEvents();
   FlushTelemetry();
}
