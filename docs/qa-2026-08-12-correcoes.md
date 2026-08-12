# Auditoria de QA e correções — 12/08/2026

Registro do que foi auditado na landing pública e na área logada, o que estava quebrado e como
foi corrigido. Serve de referência para não reintroduzir os mesmos problemas.

Método: navegação real no app rodando (`npm start`, Vite 5173 + Express 3001), medição via
DOM/CSSOM, leitura das rotas em `server.cjs` e `billing/routes.cjs`. Nada que gastasse crédito do
usuário foi executado (`/api/backtest`, `/api/strategy/save`, `/api/optimizer/genetic`,
`/api/forward/setup`, PIX) — esses caminhos foram verificados por leitura de código.

## 1. Segurança e multiusuário

| Rota | Problema | Correção |
| --- | --- | --- |
| `DELETE /api/strategies/:id` | Sem `authMiddleware` e sem checagem de dono: qualquer chamador não autenticado apagava o robô de qualquer conta. | `authMiddleware` + 404 se não existir + 403 via `ehDono`. |
| `POST /api/robots/current`, `POST /api/robots/clear-current` | Sem autenticação e com estado global `d.currentRobotId`, que vazava a seleção entre contas. | `authMiddleware` + estado por usuário em `d.currentRobotByUser[userId]`. |
| `GET /api/robots/current` | Registrada **depois** de `GET /api/robots/:id`, que capturava `id='current'` e devolvia 404 sempre. O "robô atual" nunca era restaurado no Criar Robô nem no Backtest Lab (erro engolido em `catch{}`). | Rota movida para **antes** de `/api/robots/:id`, com `authMiddleware` e busca restrita aos robôs do usuário. |
| `POST /api/validation/platform` | Sem autenticação: qualquer chamador sobrescrevia o resultado de validação de qualquer robô. | `authMiddleware` + 403 quando o robô é de outra conta. |
| `DELETE /api/validation/mt5/:runId` | Sem autenticação. | `authMiddleware`. |
| `GET /api/mt5/overview` | Público e com `robots: (d.strategies||[]).length` global — o card "Robôs" do Dashboard mostrava robôs de outras contas (17 com a lista do usuário vazia). | `authMiddleware` + `somenteDoUsuario(...)`. |

No frontend, as chamadas correspondentes usavam `fetch` cru (sem `Authorization`) e passaram a usar o
helper `api()`, que anexa o token e trata renovação de sessão.

## 2. Cobrança indevida

- **Backtest com 0 candles era cobrado.** A trava lia `preview.count`, mas
  `/api/dataset/:id/filter-preview` devolve `{total, afterFilters, ok}` — o campo `count` nunca
  existiu. O `alert` e o `disabled` do botão jamais disparavam; `chargeWallet` roda antes do
  backtest. Passou a usar `preview.ok`, com a contagem real na mensagem.
- **Exportação `.mq5` baixava arquivo corrompido.** O `fetch` cru não mandava `Authorization` e a
  rota exige login: o navegador salvava um `.mq5` de 50 bytes contendo
  `{"ok":false,"error":"Faça login para continuar."}`, sem checar `res.ok`. Criado o helper
  `baixarMq5()` em `src/main.tsx`, que anexa o token e transforma erro em exceção antes de virar
  arquivo.
- **Salvar e depois exportar cobrava duas vezes.** O payload do Criar Robô não levava o `id` do robô
  salvo, então `/api/robot/export-mt5` tratava a exportação como criação nova. O `id` passou a ser
  enviado, e `loadCurrentRobot` marca o robô como salvo.
- **O custo da exportação não aparecia em lugar nenhum.** A tabela "Custo antes de continuar" ganhou
  a linha `Gerar arquivo .mq5`, com os estados "Usa seu 1º robô grátis" / "Grátis (robô já salvo)" /
  valor cheio, e a explicação de que salvar primeiro deixa a exportação sem custo.
- **Backtest Lab não mostrava custo** antes de "Executar Backtest". Passou a exibir o mesmo bloco de
  custo, restrito à ação de backtest.
- **Otimizador imprimia `0.50` fixo** em vez de `pricing.optimizerPerIndicator` do `/api/profile`, e
  não dizia que ele é cobrado desde a primeira vez. Agora lê o preço real e informa a regra.
- **Tabela de cobrança do Perfil mostrava R$ 0,00** enquanto o perfil carregava (dizia ao usuário que
  tudo era grátis). Passou a mostrar `...`, como já fazia o `WalletMini`.

## 3. Interpretação de estratégia por voz

`numberAfter()` montava a regex com `new RegExp(w+'\D{0,30}(\d{1,3})','i')`. Em string literal,
`'\D'` vira `D` e `'\d'` vira `d`: o padrão virava `emaD{0,30}(d{1,3})` e nunca casava. Todo período
ditado ("EMA 50") era descartado e caía no fallback — o robô cobrado saía diferente do pedido.
Escapes corrigidos para `'\\D'` / `'\\d'`.

## 4. Performance

`db()` fazia `readFileSync` + `JSON.parse` dos ~33 MB de `data/db.json` a cada requisição, com o
Dashboard chamando 3 rotas a cada 8 s (pico medido de 4.258 ms em `/api/profile`).

- Criado `dbRO()`: cache do último parse, invalidado por `mtime`/tamanho e por `save()`. Usado
  apenas nas rotas que **somente leem** (`/api/mt5/overview`, `/api/mt5/status`, `/api/datasets`,
  `/api/backtests`, `/api/strategies`, `allRobotsUnified`). Handlers que gravam continuam em
  `db()` + `save()` — o objeto de `dbRO()` é compartilhado e não pode ser mutado.
- `overview()` fazia 52 `statSync` por chamada só para o tamanho em disco; passou a usar um cache de
  30 s (`tamanhoDatasetsMB`).

## 5. Landing pública

- **Âncoras quebradas até 980px.** A `.lpNav` é sticky e cresce no mobile (149px em 375px), sem
  `scroll-margin-top`/`scroll-padding-top` em lugar nenhum: o `h2` de destino ficava 100% coberto em
  `#como`, `#precos` e `#objecoes`. O `Landing` publica a altura real em `--lpNavH` e o CSS usa
  `html{scroll-padding-top:calc(var(--lpNavH,73px) + 16px)}`. Medido depois: 0px coberto nas 6 seções.
- **Modal de login/cadastro** sem `role="dialog"`, `aria-modal` ou nome acessível, sem gestão de foco
  (o Tab percorria a landing inteira antes do formulário) e sem travar a rolagem do fundo. Agora tem
  os atributos ARIA, foco inicial no campo de e-mail, focus trap, `body.navLock` (+ `html:has(...)`,
  porque só o `body` não trava) e devolve o foco ao botão que abriu.
- `AuthCard` usava `<h1>`, criando um segundo `h1` com o modal aberto — virou `<h2 id="authTitulo">`,
  referenciado pelo `aria-labelledby` do diálogo.
- Formulário com `noValidate` e validação própria de e-mail: a bolha nativa aparecia junto com a
  mensagem do React, com textos diferentes.
- Faixa de links do mobile rolava na horizontal com a barra escondida — "Preços" e "Dúvidas" ficavam
  fora da tela sem nenhuma pista. Adicionado degradê na borda direita.
- `<main>` adicionado, hash da seção passa a ser gravado (link copiável, botão Voltar funciona),
  "broker" padronizado para "corretora", "camada 2" trocado por "passo 02 (Presente)".
- **Promessas alinhadas ao produto:** o CTA "Começar os 30 dias de teste" virou "Criar conta grátis"
  (não existe teste de 30 dias da plataforma; os 30 dias são o período em conta demo), e o card
  Grátis passou a dizer "Exportação em .mq5 do robô que você criou no teste grátis", já que exportar
  um robô não salvo é cobrado.

## 6. Usabilidade para quem está começando

- **Instalação** era a primeira tela e falava em `CTRL+C` e `npm install`, sem explicar de onde vêm
  os candles. Reescrita: explica o que é a ponte (Expert Advisor), 7 passos com os menus reais do
  MetaTrader (`Arquivo → Abrir Pasta de Dados`, `MQL5\Experts`, WebRequest para
  `http://127.0.0.1:3001`, compilar, arrastar para o gráfico), bloco de "não aparece nada?" e a
  ordem do caminho. A parte de migração foi para um bloco "Avançado" recolhível.
- **Smart Import** não importa nada — só define quanto histórico guardar — mas o estado vazio do
  Datasets mandava o usuário para lá, criando um beco sem saída. A tela passou a dizer isso na
  primeira linha, avisa quando nenhum candle chegou e leva para Instalação; "Compactar banco atual"
  pede confirmação explicando que apaga dados.
- **Datasets vazio** agora aponta para Instalação, que é de onde os dados realmente vêm.
- Estados vazios criados em **Ranking** e no **Extrato** do Perfil (antes: tela em branco).
- `LoadingOverlay` deixou de dizer "processando os candles" ao salvar robô ou gerar MQ5.

## 7. Responsivo e acessibilidade

- Tabelas (Datasets, Visualizar, Perfil) e caminhos longos estouravam o `body` em 375px
  (+176px, +151px, +34px). Envolvidas em `.tabelaRolavel` (`overflow-x:auto`) e
  `overflow-wrap:anywhere` nos textos do painel. Medido depois: 0 em todas.
- Gaveta de navegação fechada no mobile só saía por `translateX(-100%)`: os 16 botões continuavam na
  ordem de tabulação. Passou a receber `inert` + `aria-hidden` abaixo de 900px.
- `aria-label` nos selects e textarea que não tinham nome acessível.
- Zoom do gráfico lia `janela`/`inicio` do render atual, então cliques rápidos se anulavam (5 cliques
  = 1 passo). Passou a usar refs: 5 cliques rápidos → 306%.
- Formatação pt-BR no `diskMB` (334,45 MB) e barras invertidas duplicadas (`Common\\Files`)
  corrigidas.
- Filtros de data do **Comparar** eram `<input>` de texto com máscara `dd/mm/aaaa`, mas o backend só
  aceita ISO: o filtro era silenciosamente ignorado (2.304 vs 100.033 candles no mesmo período).
  Viraram `type="date"` / `type="time"`, como no Backtest Lab.

## Conhecido, não corrigido

- A promessa de "corretora vinculada" e do contador "Dia 18 de 30" da landing não tem tela
  correspondente no app (Teste Real só agenda o relatório diário).
- A tela **Validação MT5** ainda expõe diagnóstico interno (Run ID, changelog de versão, URLs de API).
- Não há termos de uso nem política de privacidade em lugar nenhum.
- Vocabulário de opção binária no Backtest Lab (Expiração, Payout, MHI) num produto vendido como
  forex/MT5, e campos sem unidade.
- Versões conflitantes na interface (`v67`, `v111`, `v119`, `124.0.0`).
- `RobotSelector` e `ValidationWizard` continuam definidos e não usados.
