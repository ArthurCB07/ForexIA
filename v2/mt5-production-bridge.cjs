const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch (_err) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function appendNdjson(file, value) {
  fs.appendFileSync(file, JSON.stringify(value) + '\n', 'utf8');
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function signWithToken(token, parts) {
  return sha256(String(token) + '|' + String(parts));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function nowIso() {
  return new Date().toISOString();
}

function parseBool(value, fallback = false) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'no') return false;
  }
  return fallback;
}

function parseIntSafe(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safeName(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

module.exports = function registerMt5ProductionBridgeV2({ app, dataDir, version, logger = console }) {
  const runtimeDir = path.join(dataDir, 'runtime_v2');
  const snapshotDir = path.join(runtimeDir, 'snapshots');
  const eventLogFile = path.join(runtimeDir, 'events.ndjson');
  const agentLogFile = path.join(runtimeDir, 'agents.ndjson');
  const auditLogFile = path.join(runtimeDir, 'audit.ndjson');
  const registryFile = path.join(runtimeDir, 'registry.json');

  ensureDir(runtimeDir);
  ensureDir(snapshotDir);

  function getMasterSecret() {
    return String(process.env.FOREX_IA_V2_MASTER_SECRET || '').trim();
  }

  function getAdminToken() {
    return String(process.env.FOREX_IA_V2_ADMIN_TOKEN || process.env.FOREX_IA_ADMIN_TOKEN || '').trim();
  }

  function isConfigured() {
    return !!getMasterSecret();
  }

  function loadRegistry() {
    const registry = readJson(registryFile, { agents: {} });
    registry.agents = registry.agents && typeof registry.agents === 'object' ? registry.agents : {};
    return registry;
  }

  function saveRegistry(registry) {
    writeJson(registryFile, registry);
  }

  function deriveAgentToken(agentId) {
    const secret = getMasterSecret();
    if (!secret) throw new Error('FOREX_IA_V2_MASTER_SECRET não configurado.');
    return sha256(secret + '|mt5-v2-agent-token|' + agentId);
  }

  function readAgent(agentId) {
    const registry = loadRegistry();
    return registry.agents[String(agentId || '').trim()] || null;
  }

  function saveAgent(agent) {
    const registry = loadRegistry();
    registry.agents[agent.agentId] = agent;
    saveRegistry(registry);
  }

  function appendAudit(entry) {
    appendNdjson(auditLogFile, { at: nowIso(), ...entry });
  }

  function requireAdmin(req, res) {
    const expected = getAdminToken();
    if (!expected) {
      res.status(503).json({ ok: false, error: 'FOREX_IA_V2_ADMIN_TOKEN não configurado.' });
      return false;
    }
    const provided = String(req.headers['x-admin-token'] || '').trim();
    if (provided !== expected) {
      res.status(401).json({ ok: false, error: 'Admin token inválido.' });
      return false;
    }
    return true;
  }

  function verifySignedRequest(req, expectedPath) {
    const agentId = String(req.headers['x-agent-id'] || req.body?.agentId || '').trim();
    const ts = String(req.headers['x-agent-ts'] || '').trim();
    const signature = String(req.headers['x-agent-signature'] || '').trim().toLowerCase();
    if (!agentId || !ts || !signature) {
      return { ok: false, status: 401, error: 'Headers de autenticação ausentes.' };
    }
    if (!/^\d{10,16}$/.test(ts)) {
      return { ok: false, status: 401, error: 'Timestamp do agente inválido.' };
    }
    const tsNumber = Number(ts);
    const tsMs = String(ts).length <= 10 ? tsNumber * 1000 : tsNumber;
    const ageMs = Math.abs(Date.now() - tsMs);
    if (ageMs > 5 * 60 * 1000) {
      return { ok: false, status: 401, error: 'Mensagem fora da janela de tempo aceitável.' };
    }
    if (!isConfigured()) {
      return { ok: false, status: 503, error: 'FOREX_IA_V2_MASTER_SECRET não configurado.' };
    }
    const agent = readAgent(agentId);
    if (!agent) return { ok: false, status: 404, error: 'Agente não registrado.' };
    if (agent.enabled === false) return { ok: false, status: 403, error: 'Agente desabilitado.' };
    const token = deriveAgentToken(agentId);
    const body = JSON.stringify(req.body || {});
    const payload = [ts, req.method.toUpperCase(), expectedPath, body].join('|');
    const expected = signWithToken(token, payload);
    if (expected !== signature) {
      return { ok: false, status: 401, error: 'Assinatura inválida.' };
    }
    return { ok: true, agent, agentId, token };
  }

  function buildConfigText(agent) {
    const issuedAt = nowIso();
    const configVersion = String(agent.configVersion || '1');
    const lines = [
      'agent_id=' + agent.agentId,
      'agent_label=' + String(agent.label || agent.agentId),
      'mode=read_only',
      'config_version=' + configVersion,
      'issued_at=' + issuedAt,
      'heartbeat_sec=' + parseIntSafe(agent.heartbeatSec, 5),
      'snapshot_sec=' + parseIntSafe(agent.snapshotSec, 5),
      'tick_sample_ms=' + parseIntSafe(agent.tickSampleMs, 250),
      'symbols=' + String(agent.symbols || ''),
      'candle_timeframes=' + String(agent.candleTimeframes || 'M1,M5,M15'),
      'kill_switch=' + (agent.killSwitch?.active ? '1' : '0'),
      'kill_switch_reason=' + String(agent.killSwitch?.reason || ''),
      'telemetry_enabled=' + (parseBool(agent.telemetryEnabled, true) ? '1' : '0'),
      'server_version=' + String(version || '0')
    ];
    const content = lines.join('\n');
    const token = deriveAgentToken(agent.agentId);
    const signature = signWithToken(token, 'CONFIG|' + agent.agentId + '|' + content);
    return content + '\nsignature=' + signature + '\n';
  }

  function updateSnapshot(agentId, patch) {
    const file = path.join(snapshotDir, safeName(agentId) + '.json');
    const previous = readJson(file, { agentId, createdAt: nowIso() });
    const next = { ...previous, ...patch, updatedAt: nowIso() };
    writeJson(file, next);
    return next;
  }

  function summarizeEvents(events) {
    const summary = {
      heartbeat: 0,
      account: 0,
      symbol: 0,
      positions: 0,
      orders: 0,
      ticks: 0,
      candles: 0
    };
    for (const event of events || []) {
      const type = String(event?.type || '').toLowerCase();
      if (type === 'heartbeat') summary.heartbeat += 1;
      else if (type === 'account_snapshot') summary.account += 1;
      else if (type === 'symbol_snapshot') summary.symbol += 1;
      else if (type === 'position_snapshot') summary.positions += 1;
      else if (type === 'order_snapshot') summary.orders += 1;
      else if (type === 'tick') summary.ticks += 1;
      else if (type === 'closed_candle') summary.candles += 1;
    }
    return summary;
  }

  app.get('/api/v2/bridge/health', (req, res) => {
    res.json({
      ok: true,
      version: version || '0',
      readOnly: true,
      configured: isConfigured(),
      runtimeDir
    });
  });

  app.post('/api/v2/bridge/admin/register', (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      if (!isConfigured()) return res.status(503).json({ ok: false, error: 'FOREX_IA_V2_MASTER_SECRET não configurado.' });
      const label = String(req.body?.label || 'MT5 ReadOnly Agent').trim();
      const agentId = safeName(req.body?.agentId || 'mt5_' + crypto.randomUUID());
      const existing = readAgent(agentId);
      const configVersion = String((existing?.configVersion ? Number(existing.configVersion) : 0) + 1);
      const agent = {
        agentId,
        label,
        enabled: true,
        telemetryEnabled: true,
        heartbeatSec: parseIntSafe(req.body?.heartbeatSec, 5),
        snapshotSec: parseIntSafe(req.body?.snapshotSec, 5),
        tickSampleMs: parseIntSafe(req.body?.tickSampleMs, 250),
        candleTimeframes: String(req.body?.candleTimeframes || 'M1,M5,M15'),
        symbols: String(req.body?.symbols || ''),
        accountHint: String(req.body?.accountHint || ''),
        mode: 'read_only',
        killSwitch: { active: false, reason: '', updatedAt: nowIso() },
        configVersion,
        createdAt: existing?.createdAt || nowIso(),
        updatedAt: nowIso()
      };
      saveAgent(agent);
      appendNdjson(agentLogFile, { type: 'agent_registered', at: nowIso(), agentId, label, configVersion });
      res.json({
        ok: true,
        agent: {
          ...agent,
          configUrl: '/api/v2/bridge/config/' + encodeURIComponent(agentId),
          eventsUrl: '/api/v2/bridge/events',
          token: deriveAgentToken(agentId)
        }
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/v2/bridge/admin/agents', (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      const registry = loadRegistry();
      const agents = Object.values(registry.agents || {}).map((agent) => {
        const snapshotFile = path.join(snapshotDir, safeName(agent.agentId) + '.json');
        const snapshot = readJson(snapshotFile, null);
        return { ...agent, snapshot };
      });
      res.json({ ok: true, agents });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/v2/bridge/admin/kill-switch/:agentId', (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      const agent = readAgent(req.params.agentId);
      if (!agent) return res.status(404).json({ ok: false, error: 'Agente não encontrado.' });
      agent.killSwitch = {
        active: parseBool(req.body?.active, true),
        reason: String(req.body?.reason || '').trim(),
        updatedAt: nowIso()
      };
      agent.configVersion = String(Number(agent.configVersion || 0) + 1);
      agent.updatedAt = nowIso();
      saveAgent(agent);
      appendNdjson(agentLogFile, { type: 'kill_switch_changed', at: nowIso(), agentId: agent.agentId, killSwitch: agent.killSwitch });
      res.json({ ok: true, agent });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  function serveAgentConfig(agentId, token, res) {
    try {
      if (!isConfigured()) return res.status(503).send('error=FOREX_IA_V2_MASTER_SECRET não configurado.\n');
      const expected = deriveAgentToken(agentId);
      if (token !== expected) return res.status(401).send('error=agent token inválido.\n');
      const agent = readAgent(agentId);
      if (!agent) return res.status(404).send('error=agente não encontrado.\n');
      const text = buildConfigText(agent);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(text);
    } catch (err) {
      res.status(500).send('error=' + err.message + '\n');
    }
  }

  app.get('/api/v2/bridge/config/:agentId', (req, res) => {
    serveAgentConfig(String(req.params.agentId || '').trim(), String(req.headers['x-agent-token'] || '').trim(), res);
  });

  app.post('/api/v2/bridge/config', (req, res) => {
    serveAgentConfig(String(req.body?.agentId || '').trim(), String(req.headers['x-agent-token'] || '').trim(), res);
  });

  app.post('/api/v2/bridge/events', (req, res) => {
    try {
      const auth = verifySignedRequest(req, '/api/v2/bridge/events');
      if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

      const body = req.body || {};
      const events = Array.isArray(body.events) ? body.events : [];
      const seq = parseIntSafe(body.seq, 0);
      const receivedAt = nowIso();
      const summary = summarizeEvents(events);
      const lastHeartbeat = events.filter((x) => String(x?.type || '') === 'heartbeat').slice(-1)[0] || null;
      const lastAccount = events.filter((x) => String(x?.type || '') === 'account_snapshot').slice(-1)[0] || null;
      const lastSymbol = events.filter((x) => String(x?.type || '') === 'symbol_snapshot').slice(-1)[0] || null;
      const positions = events.filter((x) => String(x?.type || '') === 'position_snapshot');
      const orders = events.filter((x) => String(x?.type || '') === 'order_snapshot');

      appendNdjson(eventLogFile, {
        kind: 'bridge_batch',
        version: version || '0',
        receivedAt,
        agentId: auth.agentId,
        seq,
        configVersion: String(body.configVersion || ''),
        eventCount: events.length,
        summary,
        events
      });

      const snapshot = updateSnapshot(auth.agentId, {
        mode: 'read_only',
        seq,
        configVersion: String(body.configVersion || ''),
        receivedAt,
        eventCount: events.length,
        summary,
        lastHeartbeat,
        lastAccount,
        lastSymbol,
        positions,
        orders,
        lastTick: events.filter((x) => String(x?.type || '') === 'tick').slice(-1)[0] || null,
        lastCandle: events.filter((x) => String(x?.type || '') === 'closed_candle').slice(-1)[0] || null
      });

      const agent = readAgent(auth.agentId);
      if (agent) {
        agent.lastSeenAt = receivedAt;
        agent.lastSeq = seq;
        agent.updatedAt = receivedAt;
        saveAgent(agent);
      }

      res.json({
        ok: true,
        accepted: true,
        receivedAt,
        agentId: auth.agentId,
        seq,
        summary,
        killSwitch: !!agent?.killSwitch?.active,
        snapshot
      });
    } catch (err) {
      logger.error('mt5-production-v2 events error', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/v2/bridge/state/:agentId', (req, res) => {
    try {
      const file = path.join(snapshotDir, safeName(req.params.agentId) + '.json');
      const snapshot = readJson(file, null);
      if (!snapshot) return res.status(404).json({ ok: false, error: 'Snapshot não encontrado.' });
      res.json({ ok: true, snapshot });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
};
