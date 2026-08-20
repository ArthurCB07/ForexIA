
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function ensureConfigured() {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    const err = new Error('Supabase não configurado (SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY ausentes no .env).');
    err.status = 500;
    throw err;
  }
}

async function authRequest(pathname, { method = 'GET', body, accessToken } = {}) {
  ensureConfigured();
  const headers = { apikey: ANON_KEY, 'Content-Type': 'application/json' };
  headers.Authorization = accessToken ? `Bearer ${accessToken}` : `Bearer ${ANON_KEY}`;
  const r = await fetch(`${SUPABASE_URL}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!r.ok) {
    const err = new Error(data?.msg || data?.error_description || data?.error || `Falha na autenticação (HTTP ${r.status})`);
    err.status = r.status === 400 || r.status === 422 ? 400 : r.status;
    throw err;
  }
  return data;
}

function signUp({ email, password }) {
  return authRequest('/auth/v1/signup', { method: 'POST', body: { email, password } });
}

function signInWithPassword({ email, password }) {
  return authRequest('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
}

function refreshSession(refreshToken) {
  return authRequest('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } });
}

function getUser(accessToken) {
  return authRequest('/auth/v1/user', { method: 'GET', accessToken });
}

function toQuery(filter = {}) {
  return Object.entries(filter).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
}

async function pgRequest(table, { method = 'GET', query = '', body, single = false, prefer } = {}) {
  ensureConfigured();
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const qs = query ? `?${query}` : '';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${qs}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data = text ? JSON.parse(text) : (single ? null : []);
  if (!r.ok) {
    const err = new Error(data?.message || `Falha no banco (HTTP ${r.status}) em ${table}`);
    err.status = 500;
    throw err;
  }
  return data;
}

async function selectOne(table, filter) {
  const rows = await pgRequest(table, { query: `${toQuery(filter)}&limit=1` });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function selectMany(table, filter, extraQuery = '') {
  const query = [toQuery(filter), extraQuery].filter(Boolean).join('&');
  return pgRequest(table, { query });
}

async function insertRow(table, row) {
  const rows = await pgRequest(table, { method: 'POST', body: row, prefer: 'return=representation' });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function updateRows(table, filter, patch) {
  const rows = await pgRequest(table, { method: 'PATCH', query: toQuery(filter), body: patch, prefer: 'return=representation' });
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  signUp,
  signInWithPassword,
  refreshSession,
  getUser,
  selectOne,
  selectMany,
  insertRow,
  updateRows,
};
