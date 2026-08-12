const { v4: uuidv4 } = require('uuid');
const supabase = require('./supabase-client.cjs');

const BILLING_PRICES = { createRobotPerIndicator: 0.26, backtestPerIndicator: 0.10, optimizerPerIndicator: 0.50 };
const MP_BASE = 'https://api.mercadopago.com';
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const IS_TEST_MODE = /^TEST-/.test(MP_ACCESS_TOKEN);
let moduleLogger = console;

function money2(v) { return Math.round(Number(v || 0) * 100) / 100; }

async function mpCreatePixPayment({ amount, email, description, idempotencyKey }) {
  const r = await fetch(`${MP_BASE}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ transaction_amount: amount, description, payment_method_id: 'pix', payer: { email } }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const bruto = data?.message || data?.cause?.[0]?.description || '';
    const transitorio = /internal_error|timeout|unavailable/i.test(bruto) || r.status >= 500;
    const err = new Error(transitorio
      ? 'O Mercado Pago não respondeu agora. Tente gerar o PIX novamente em alguns segundos.'
      : (bruto || 'Não foi possível gerar o PIX. Confira o valor e tente novamente.'));
    err.status = 502;
    moduleLogger.error('Mercado Pago recusou o PIX:', r.status, bruto || JSON.stringify(data).slice(0, 200));
    throw err;
  }
  return data;
}

async function mpGetPayment(id) {
  const r = await fetch(`${MP_BASE}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.message || 'Falha ao consultar pagamento no Mercado Pago.');
    err.status = 502;
    throw err;
  }
  return data;
}

async function ensureProfile(id, email) {
  let profile = await supabase.selectOne('profiles', { id });
  if (!profile) {
    profile = await supabase.insertRow('profiles', {
      id, email: email || '', wallet_balance: 0, free_robot_used: false, free_backtest_used: false,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
  }
  return profile;
}

async function creditWalletFromPayment(payment) {
  const profile = await ensureProfile(payment.user_id);
  if (payment.credited) return { credited: true, balance: money2(profile.wallet_balance) };
  const amount = Number(payment.amount);
  const newBalance = money2(Number(profile.wallet_balance || 0) + amount);
  await supabase.updateRows('profiles', { id: payment.user_id }, { wallet_balance: newBalance, updated_at: new Date().toISOString() });
  await supabase.insertRow('wallet_transactions', {
    user_id: payment.user_id, type: 'credit', kind: 'topup', description: 'Recarga PIX aprovada',
    amount, balance_after: newBalance, payment_id: payment.id, created_at: new Date().toISOString(),
  });
  await supabase.updateRows('payments', { id: payment.id }, { status: 'approved', credited: true, updated_at: new Date().toISOString() });
  return { credited: true, balance: newBalance };
}

async function chargeWallet(user, kind, indicatorCount, description) {
  const profile = await ensureProfile(user.id, user.email);
  const indicators = Math.max(1, Number(indicatorCount || 1));
  const balance = Number(profile.wallet_balance || 0);

  if (kind === 'create' && !profile.free_robot_used) {
    await supabase.updateRows('profiles', { id: user.id }, { free_robot_used: true, updated_at: new Date().toISOString() });
    await supabase.insertRow('wallet_transactions', {
      user_id: user.id, type: 'credit', kind, description: `${description || kind} (teste grátis)`,
      amount: 0, balance_after: money2(balance), created_at: new Date().toISOString(),
    });
    return { cost: 0, indicators, balanceAfter: money2(balance), freeTrial: true };
  }
  if (kind === 'backtest' && !profile.free_backtest_used) {
    await supabase.updateRows('profiles', { id: user.id }, { free_backtest_used: true, updated_at: new Date().toISOString() });
    await supabase.insertRow('wallet_transactions', {
      user_id: user.id, type: 'credit', kind, description: `${description || kind} (teste grátis)`,
      amount: 0, balance_after: money2(balance), created_at: new Date().toISOString(),
    });
    return { cost: 0, indicators, balanceAfter: money2(balance), freeTrial: true };
  }

  const priceMap = { create: BILLING_PRICES.createRobotPerIndicator, backtest: BILLING_PRICES.backtestPerIndicator, optimizer: BILLING_PRICES.optimizerPerIndicator };
  const price = priceMap[kind] || 0;
  const amount = money2(price * indicators);
  if (amount > 0 && balance + 1e-9 < amount) {
    const err = new Error(`Crédito insuficiente. Custo: R$ ${amount.toFixed(2).replace('.', ',')}. Saldo: R$ ${money2(balance).toFixed(2).replace('.', ',')}.`);
    err.status = 402; err.code = 'INSUFFICIENT_CREDITS'; err.cost = amount; err.balance = money2(balance);
    throw err;
  }
  const newBalance = money2(balance - amount);
  await supabase.updateRows('profiles', { id: user.id }, { wallet_balance: newBalance, updated_at: new Date().toISOString() });
  await supabase.insertRow('wallet_transactions', {
    user_id: user.id, type: 'debit', kind, description: description || kind,
    amount: -amount, balance_after: newBalance, created_at: new Date().toISOString(),
  });
  return { cost: amount, indicators, balanceAfter: newBalance, freeTrial: false };
}

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ ok: false, error: 'Faça login para continuar.' });
    const user = await supabase.getUser(token);
    if (!user?.id) return res.status(401).json({ ok: false, error: 'Sessão inválida. Faça login novamente.' });
    req.user = { id: user.id, email: user.email };
    next();
  } catch (e) {
    if (e?.status === 401 || e?.status === 403) return res.status(401).json({ ok: false, error: 'Sessão inválida. Faça login novamente.' });
    moduleLogger.error('Falha ao validar sessão no Supabase:', e?.message || e);
    res.status(503).json({ ok: false, error: 'Não foi possível validar sua sessão agora. Tente novamente em instantes.' });
  }
}

module.exports = function mountBilling({ app, logger = console } = {}) {
  moduleLogger = logger;
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email) return res.status(400).json({ ok: false, error: 'Informe um e-mail.' });
      if (password.length < 6) return res.status(400).json({ ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' });
      const data = await supabase.signUp({ email, password });
      const newUser = data?.user || data;
      if (!newUser?.id) return res.status(400).json({ ok: false, error: 'Não foi possível criar a conta.' });
      await ensureProfile(newUser.id, email);
      const accessToken = data.session?.access_token || data.access_token;
      const refreshToken = data.session?.refresh_token || data.refresh_token;
      if (accessToken) {
        return res.json({ ok: true, session: { access_token: accessToken, refresh_token: refreshToken }, user: { id: newUser.id, email } });
      }
      res.json({ ok: true, needsEmailConfirmation: true, email });
    } catch (e) {
      res.status(e.status || 500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const data = await supabase.signInWithPassword({ email, password });
      if (!data?.access_token) return res.status(401).json({ ok: false, error: 'E-mail ou senha inválidos.' });
      await ensureProfile(data.user.id, data.user.email);
      res.json({ ok: true, session: { access_token: data.access_token, refresh_token: data.refresh_token }, user: { id: data.user.id, email: data.user.email } });
    } catch (e) {
      res.status(e.status === 400 ? 401 : (e.status || 401)).json({ ok: false, error: e.status === 400 ? 'E-mail ou senha inválidos.' : e.message });
    }
  });

  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const refreshToken = String(req.body?.refresh_token || '').trim();
      if (!refreshToken) return res.status(401).json({ ok: false, error: 'Sessão expirada. Faça login novamente.' });
      const data = await supabase.refreshSession(refreshToken);
      if (!data?.access_token) return res.status(401).json({ ok: false, error: 'Sessão expirada. Faça login novamente.' });
      res.json({ ok: true, session: { access_token: data.access_token, refresh_token: data.refresh_token }, user: { id: data.user?.id, email: data.user?.email } });
    } catch (_e) {
      res.status(401).json({ ok: false, error: 'Sessão expirada. Faça login novamente.' });
    }
  });

  app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
      const profile = await ensureProfile(req.user.id, req.user.email);
      const ledger = await supabase.selectMany('wallet_transactions', { user_id: req.user.id }, 'order=created_at.desc&limit=50');
      res.json({
        ok: true,
        user: { id: req.user.id, email: req.user.email },
        wallet: { balance: money2(profile.wallet_balance), freeRobotUsed: !!profile.free_robot_used, freeBacktestUsed: !!profile.free_backtest_used },
        pricing: BILLING_PRICES,
        ledger,
        testMode: IS_TEST_MODE,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/wallet/topup/pix', authMiddleware, async (req, res) => {
    try {
      const amount = money2(req.body?.amount);
      if (!(amount >= 1)) return res.status(400).json({ ok: false, error: 'Informe um valor de recarga de pelo menos R$ 1,00.' });
      const mpPayment = await mpCreatePixPayment({ amount, email: req.user.email, description: 'Recarga de créditos Forex IA Studio', idempotencyKey: uuidv4() });
      const qr = mpPayment?.point_of_interaction?.transaction_data || {};
      await supabase.insertRow('payments', {
        user_id: req.user.id, mp_payment_id: String(mpPayment.id), status: mpPayment.status || 'pending',
        amount, credited: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      res.json({ ok: true, paymentId: String(mpPayment.id), status: mpPayment.status, amount, qrCode: qr.qr_code || '', qrCodeBase64: qr.qr_code_base64 || '', testMode: IS_TEST_MODE });
    } catch (e) {
      res.status(e.status || 500).json({ ok: false, error: e.message || 'Falha ao gerar PIX.' });
    }
  });

  app.get('/api/wallet/topup/pix/:id/status', authMiddleware, async (req, res) => {
    try {
      const payment = await supabase.selectOne('payments', { mp_payment_id: req.params.id });
      if (!payment || payment.user_id !== req.user.id) return res.status(404).json({ ok: false, error: 'Pagamento não encontrado.' });
      if (payment.credited) return res.json({ ok: true, status: 'approved', credited: true });
      const mpPayment = await mpGetPayment(req.params.id);
      const status = mpPayment?.status || payment.status;
      if (status !== payment.status) await supabase.updateRows('payments', { id: payment.id }, { status, updated_at: new Date().toISOString() });
      if (status === 'approved') {
        const result = await creditWalletFromPayment(payment);
        return res.json({ ok: true, status: 'approved', credited: true, balance: result.balance });
      }
      res.json({ ok: true, status, credited: false });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/wallet/webhook/mercadopago', async (req, res) => {
    try {
      const id = req.body?.data?.id || req.query?.id || req.body?.id;
      if (!id) return res.status(200).json({ ok: true });
      const payment = await supabase.selectOne('payments', { mp_payment_id: String(id) });
      if (!payment || payment.credited) return res.status(200).json({ ok: true });
      const mpPayment = await mpGetPayment(id);
      if (mpPayment?.status === 'approved') await creditWalletFromPayment(payment);
      res.status(200).json({ ok: true });
    } catch (e) {
      logger.error('Erro no webhook Mercado Pago:', e.message);
      res.status(200).json({ ok: true });
    }
  });

  app.post('/api/wallet/topup/pix/:id/simulate-approve', authMiddleware, async (req, res) => {
    try {
      if (!IS_TEST_MODE) return res.status(403).json({ ok: false, error: 'Simulação disponível apenas com credenciais de teste do Mercado Pago.' });
      const payment = await supabase.selectOne('payments', { mp_payment_id: req.params.id });
      if (!payment || payment.user_id !== req.user.id) return res.status(404).json({ ok: false, error: 'Pagamento não encontrado.' });
      const result = await creditWalletFromPayment(payment);
      res.json({ ok: true, status: 'approved', credited: true, balance: result.balance });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return { authMiddleware, chargeWallet };
};
