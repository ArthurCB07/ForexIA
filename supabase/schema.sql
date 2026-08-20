-- Forex IA Studio - carteira/pagamentos PIX
-- Rode este arquivo uma vez no SQL Editor do painel Supabase (projeto ihmyggjchrzeceepuccz).

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A tabela profiles pode já existir de outro projeto no mesmo Supabase, então as colunas da
-- carteira entram por ALTER: `create table if not exists` sozinho não adiciona coluna nova.
alter table profiles add column if not exists email text;
alter table profiles add column if not exists wallet_balance numeric(12,2) not null default 0;
alter table profiles add column if not exists free_robot_used boolean not null default false;
alter table profiles add column if not exists free_backtest_used boolean not null default false;
alter table profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,             -- 'credit' | 'debit'
  kind text not null,             -- 'topup' | 'create' | 'backtest' | 'optimizer'
  description text,
  amount numeric(12,2) not null,  -- negativo em débitos
  balance_after numeric(12,2) not null,
  payment_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  mp_payment_id text not null unique,
  status text not null default 'pending',
  amount numeric(12,2) not null,
  credited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_id_idx on wallet_transactions(user_id);
create index if not exists payments_user_id_idx on payments(user_id);

alter table profiles enable row level security;
alter table wallet_transactions enable row level security;
alter table payments enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for select using (auth.uid() = id);

drop policy if exists "own transactions" on wallet_transactions;
create policy "own transactions" on wallet_transactions for select using (auth.uid() = user_id);

drop policy if exists "own payments" on payments;
create policy "own payments" on payments for select using (auth.uid() = user_id);
