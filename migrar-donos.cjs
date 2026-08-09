// Migração única: registros criados antes da separação por usuário não têm dono, o que os
// deixava visíveis para todas as contas. Passa todos para a conta indicada em DONO_EMAIL.
// Uso: node migrar-donos.cjs
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const DONO_EMAIL = 'arthurcbrandao2013@gmail.com';
const DATA = path.join(__dirname, 'data');
const DB = path.join(DATA, 'db.json');

async function buscarIdDoDono() {
  const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${U}/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(DONO_EMAIL)}&limit=1`,
    { headers: { apikey: K, Authorization: 'Bearer ' + K } });
  const j = await r.json();
  if (!j?.[0]?.id) throw new Error(`Conta ${DONO_EMAIL} não encontrada no Supabase.`);
  return j[0].id;
}

function marcarLista(lista, userId) {
  let n = 0;
  for (const item of (Array.isArray(lista) ? lista : [])) {
    if (!item.userId) { item.userId = userId; n++; }
  }
  return n;
}

function marcarPastas(dir, userId) {
  let n = 0;
  if (!fs.existsSync(dir)) return n;
  for (const f of fs.readdirSync(dir)) {
    const jf = path.join(dir, f, 'robot.json');
    if (!fs.existsSync(jf)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(jf, 'utf8'));
      if (!j.userId) { j.userId = userId; fs.writeFileSync(jf, JSON.stringify(j, null, 2), 'utf8'); n++; }
    } catch (_e) { /* arquivo corrompido: ignora */ }
  }
  return n;
}

(async () => {
  const userId = await buscarIdDoDono();
  console.log('dono:', DONO_EMAIL, '->', userId);

  const backup = path.join(DATA, `db.antes-migracao-${Date.now()}.json`);
  fs.copyFileSync(DB, backup);
  console.log('backup:', path.basename(backup));

  const d = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const r = {
    estrategias: marcarLista(d.strategies, userId),
    robos: marcarLista(d.robots, userId),
    savedRobots: marcarLista(d.savedRobots, userId),
    backtests: marcarLista(d.backtests, userId),
    forwardTests: marcarLista(d.forwardTests, userId),
  };
  fs.writeFileSync(DB, JSON.stringify(d), 'utf8');

  r.pastaRobots = marcarPastas(path.join(DATA, 'robots'), userId);
  r.pastaProjects = marcarPastas(path.join(DATA, 'projects'), userId);

  console.log('registros migrados:');
  for (const [k, v] of Object.entries(r)) if (v) console.log('  ', k + ':', v);
  const total = Object.values(r).reduce((a, b) => a + b, 0);
  console.log(total ? `total: ${total}` : 'nada a migrar (tudo já tinha dono)');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
