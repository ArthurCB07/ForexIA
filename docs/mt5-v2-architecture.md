# MT5 v2 Hybrid Architecture

## Target components

```text
[Frontend React/Vite]
  -> config, status, logs, pnl, monitor only
  -> never decides entry, never approves order in real time

[Backend SaaS Node/Express v2]
  -> auth
  -> licensing
  -> signed config
  -> telemetry ingest
  -> audit trail
  -> remote kill switch
  -> reconciliation
  -> reports / alerts / history
  -> outside the critical order path

[MT5 EA / Local or VPS agent]
  -> tick/candle read
  -> strategy decision
  -> local risk gate
  -> order send
  -> position management
  -> fail-safe rules
  -> resilient local logs
  -> source of truth for execution timing

[Broker / MT5 server]
  -> actual execution venue
```

## End-to-end flow

```text
1. Admin/user provisions agent in backend
2. Backend issues agent_id + derived token + signed config
3. EA loads config and verifies signature locally
4. EA reads market data locally from MT5
5. EA computes signal locally
6. EA applies local risk model
7. EA sends order directly to MT5/broker
8. EA writes local execution log first
9. EA publishes telemetry/audit event batch to backend asynchronously
10. Backend stores telemetry, updates monitoring state and audit trail
11. Frontend only renders status/history
```

## Contracts

### EA -> backend

- `POST /api/v2/bridge/events`
- signed headers:
  - `x-agent-id`
  - `x-agent-ts`
  - `x-agent-signature`
- body:
  - `agentId`
  - `seq`
  - `configVersion`
  - `mode`
  - `events[]`

### Backend -> EA

- `GET /api/v2/bridge/config/:agentId`
- header:
  - `x-agent-token`
- response:
  - line-oriented signed config
  - `config_version`
  - `issued_at`
  - `kill_switch`
  - `heartbeat_sec`
  - `snapshot_sec`
  - `tick_sample_ms`
  - `candle_timeframes`
  - `signature`

## Event model

- `heartbeat`
- `account_snapshot`
- `symbol_snapshot`
- `position_snapshot`
- `order_snapshot`
- `tick`
- `closed_candle`

Future phases add:

- `signal_decision`
- `risk_decision`
- `order_submit`
- `order_ack`
- `order_reject`
- `position_close`

## Signed config model

- backend generates deterministic config text
- signature = keyed hash over config content
- EA verifies before applying
- every config carries:
  - version
  - issued_at
  - kill_switch flag
  - telemetry controls

## Local risk model (future execution phases)

- trading session window
- max trades/day
- max daily loss
- max spread
- max concurrent positions
- duplicate entry guard
- stale tick protection
- fail-closed on config/auth mismatch

## Kill switch model

- backend toggles `kill_switch`
- EA fetches signed config and applies locally
- in future trading mode:
  - no new entries
  - optional forced close policy by config
- in read-only mode:
  - telemetry may continue with suspended status

## Heartbeat model

- frequent timer, default 5s in phase 1
- includes:
  - terminal connectivity
  - trade permission state
  - ping
  - agent mode
  - kill switch state

## Reconciliation plan

- EA is source of truth for local execution timeline
- backend stores:
  - append-only event batches
  - latest snapshot per agent
- future reconcile job compares:
  - open positions in MT5
  - known backend positions/orders
  - missing sequence ranges
  - config version used during each execution

## Legacy handling

Keep:

- current frontend shell
- current MT5 monitoring views
- current WhatsApp/reporting pieces
- current backtest/validation/import features as non-critical modules

Isolate as legacy:

- validation EAs
- CSV/AppData import logic
- backtest comparison pipeline
- JSON local app state for product workflows

## New modules created in phase 1

- `v2/mt5-production-bridge.cjs`
- `mt5/ForexIA_Production_Bridge_v2.mq5`
- `docs/mt5-v2-architecture.md`
