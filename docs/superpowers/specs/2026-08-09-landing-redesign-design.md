# Redesign da Landing Page + camada de feedback do sistema

Data: 2026-08-09
Status: aprovado (direção validada com o usuário)

## Problema

A landing atual (`Landing` em [src/main.tsx](../../../src/main.tsx), estilos em `/* v126 */` de [src/styles.css](../../../src/styles.css)) funciona, mas não convence:

1. **Copy genérica.** A H1 ("Transforme sua estratégia em um robô de MetaTrader 5 — sem escrever código") é a mesma promessa de qualquer concorrente. Os títulos de seção ("Tudo o que você precisa para validar uma estratégia") não afirmam nada verificável. Nada na página comunica a diferença real do produto.
2. **Ícones são emojis do sistema.** `LP_FEATURES` usa 📥🧠🎙️🧪⚙️✅📡🏆 e a "logo" é 🤖 + texto. A renderização varia por sistema operacional e o resultado lê como rascunho.
3. **Sem tipografia própria.** Nenhuma família é declarada: a página cai na fonte de sistema. É o fator isolado que mais faz um layout parecer template.
4. **Ciano sem hierarquia.** `--cyan #00e5ff` aparece em saturação máxima em títulos, marca, números, bordas e sombras, quase sempre acompanhado de `text-shadow: 0 0 Npx`. Com tudo brilhando, nada se destaca.
5. **Animação mínima.** O repertório inteiro é `transition:.18s`, `translateY(-1px)` no hover e um `@keyframes lpFloat` na carinha de robô.
6. **Feedback do sistema pobre.** Erros aparecem como `<p className="warn">` estático, botões longos (backtest, otimizador) não têm estado de carregamento próprio, e não existe padrão de toast, skeleton ou progresso.

## Escopo

Dentro do escopo:

- Redesenho completo da landing page: estrutura, copy, tipografia, paleta, ícones, logo e animações.
- Sistema de tokens de movimento reutilizável (durações, curvas, utilitários de revelação).
- Camada de feedback do usuário nas telas do sistema: toast, botão com carregamento, skeleton, progresso do otimizador, erro de saldo insuficiente.

Fora do escopo:

- Redesenho visual geral das telas internas do sistema (dashboard, lab, otimizador etc.). Só a camada de feedback é tocada.
- Backend. Nenhuma rota, contrato de API ou schema muda.
- Qualquer coisa sob `v2/` ou `mt5/` (bridge de produção).
- As cópias obsoletas em `/main.tsx`, `/styles.css` e `patch/` continuam obsoletas e não devem ser editadas.

## Decisões de direção

Tomadas com o usuário antes do design:

| Eixo | Decisão |
|---|---|
| Direção visual | Refinar a identidade ciano existente (não trocar por paleta nova) |
| Escopo de animação | Landing + pontos de feedback do sistema |
| Ícones | Biblioteca — `lucide-react`, que já é dependência do projeto |
| Logo | Marca (símbolo) + wordmark |

## Design

### 1. Tokens de cor

O ciano passa a ser sinal, não superfície. Escala nova em `:root`, mantendo os nomes atuais para não quebrar as telas do sistema:

```
--bg        #05090F
--surface   #0B121C
--surface-2 #101A26
--line      #1B2A3A
--cy-500    #00C2D6   /* interativo: bordas, links, estados de foco */
--cyan      #00e5ff   /* um destaque por seção; nunca em texto corrido */
--txt       #E6F1F5
--muted     #7E97A8
--green     #2BD98A
--red       #FF5A5F
```

Regras:

- Nenhum `text-shadow` de brilho em texto. O glow fica reservado ao CTA primário e ao indicador de dado ao vivo.
- `--green` e `--red` só aparecem em dados de resultado e risco, nunca como decoração.
- `--muted` atual (`#8fb5c6`) é ciano diluído e azula todo o texto secundário; o novo valor é neutro.

Os valores antigos de `--cyan`, `--txt`, `--muted`, `--green`, `--red` continuam existindo com os mesmos nomes, então as telas internas seguem funcionando sem edição — mudam apenas de tom.

### 2. Tipografia

Três papéis, carregados via pacotes `@fontsource` instalados por npm (sem CDN em runtime, coerente com o caráter local-first do projeto):

- **Display — Archivo**, pesos 700/800, `letter-spacing: -0.02em`. Usada em H1, H2 e na wordmark.
- **Corpo — IBM Plex Sans**, pesos 400/500/600. Registro de engenharia, contraste claro com a display.
- **Dados — IBM Plex Mono**, com `font-variant-numeric: tabular-nums`. Aplicada a **todo** número, métrica, percentual e valor em reais, na landing e nas métricas do sistema.

O uso de mono tabular nos números é a decisão tipográfica central: é o que faz a interface ler como instrumento de medição, e é verdadeiro sobre o produto.

### 3. Copy

A tese da página passa a ser a afirmação incomum e verificável do produto: **o backtest reconcilia com o Strategy Tester do MetaTrader 5**. Isso corresponde à funcionalidade real de Validação MT5 e é o que nenhum concorrente afirma.

Hero:

- H1: "O backtest só vale se bater com o do MetaTrader 5."
- Subtítulo: "Importe os candles do seu próprio broker pela ponte EA, monte a estratégia sem código, otimize com algoritmo genético e exporte o Expert Advisor. Depois coloque os números lado a lado com o Strategy Tester."
- Micro: "1º robô e 1º backtest grátis · sem mensalidade · recarga por PIX"

Demais mudanças de copy:

- Títulos de seção passam a afirmar algo específico em vez de descrever a categoria.
- A FAQ é reposicionada como quebra de objeção. A objeção mais forte — "o robô opera sozinho?" — é respondida com a arquitetura real: o Expert Advisor executa dentro do MT5 do usuário, e a plataforma nunca fica no caminho crítico da ordem.
- Preços ganham um exemplo concreto de custo total: estratégia de 3 indicadores → criar R$ 0,78, backtest R$ 0,30, otimizar R$ 1,50. Os preços unitários vêm de `BILLING_PRICES` em [billing/routes.cjs](../../../billing/routes.cjs) e devem ser conferidos contra o código na implementação.
- Nenhum número de prova social inventado. A faixa de estatísticas usa apenas fatos verificáveis do produto (quantidade de telas, formato de export, preço por indicador).

### 4. Elemento-assinatura

O sparkline decorativo do hero sai. Entra um **painel de reconciliação**: duas colunas lado a lado, "Forex IA Studio" e "MT5 Strategy Tester", com as mesmas métricas em mono tabular. Na entrada da página os números contam até o valor e travam alinhados, e um selo de conferência aparece. É a tese da página em forma animada, não um gráfico de enfeite.

O painel deve ser rotulado como ilustrativo, do mesmo modo que o mock atual já faz com "exemplo ilustrativo".

### 5. Ícones

`lucide-react` já é dependência e já é usado no `Sidebar`, então nenhuma dependência nova entra e a família de ícones fica consistente entre landing e sistema.

Para não ler como template, os ícones não aparecem soltos: cada um vai dentro de uma **placa flat** — quadrado sólido de canto arredondado, preenchimento tintado, ícone em contraste. A tinta varia por categoria (dados, criação, análise, execução), o que dá ao conjunto de recursos uma taxonomia visível.

Mapeamento previsto de `LP_FEATURES`: `DownloadCloud` (Smart Import), `Brain` (Criar Robô), `Mic` (Agente de Voz), `FlaskConical` (Backtest Lab), `Dna` (Otimizador Genético), `ShieldCheck` (Validação MT5), `RadioTower` (Teste Real), `Trophy` (Ranking).

### 6. Logo

Marca: **três barras crescentes cortadas por uma linha horizontal de execução** — gráfico mais nível de entrada. Geometria simples o bastante para permanecer legível a 16px.

Entregáveis: componente SVG inline em React, versão monocromática e versão com o ciano de destaque, favicon, e wordmark tipográfica em Archivo (`FOREX IA` com `STUDIO` como etiqueta pequena espaçada). Substitui o 🤖 da `.lpBrand` e a carinha de robô `.lpFace` do hero.

A marca também substitui o emoji no `.brand` do sidebar e no `.authLogo` do card de autenticação, para a identidade não divergir depois do login.

### 7. Sistema de movimento

Tokens em `:root`:

```
--e-out    cubic-bezier(.22, 1, .36, 1)
--e-in-out cubic-bezier(.65, 0, .35, 1)
--t-1 120ms   /* press, mudança de cor */
--t-2 180ms   /* hover, foco */
--t-3 260ms   /* entrada de elemento */
--t-4 420ms   /* transição de seção, contadores */
```

Landing:

- Sequência de entrada com stagger (nav, H1, subtítulo, CTAs, painel de reconciliação).
- Revelação por scroll via `IntersectionObserver`: fade mais 8px de deslocamento, uma única vez por elemento, sem paralaxe.
- Contadores animados nas métricas do painel e da faixa de estatísticas.
- Sparkline desenhado por `stroke-dasharray` quando entra em viewport.
- FAQ com altura animada em vez do `<details>` seco.
- Estados de hover, press e foco em todos os controles.

Sistema (feedback):

- Toast para sucesso e erro, com entrada e saída animadas.
- Botão com estado de carregamento inline (spinner + rótulo alterado + desabilitado) para as ações longas: salvar robô, backtest, otimizador.
- Skeleton com shimmer para listas e painéis enquanto carregam.
- Progresso do otimizador exibindo a geração atual.
- Erro de saldo insuficiente (`INSUFFICIENT_CREDITS`, tratado hoje por `billingErrorInfo()`) com CTA animada para o Perfil.

Acessibilidade: `@media (prefers-reduced-motion: reduce)` zera durações e desliga transformações. O foco visível existente (`outline: 3px solid var(--cyan)`) é preservado, apenas atualizado para a nova escala de ciano.

### 8. Estrutura da página

1. Nav — logo nova, links de âncora, CTA
2. Hero — tese + painel de reconciliação (assinatura)
3. Faixa de fatos do produto
4. Como funciona — 4 passos (a numeração fica porque a ordem é real e informativa)
5. Recursos — 8 cards com placas de ícone
6. Objeções — a FAQ atual, reescrita e reposicionada
7. Preços — com exemplo concreto de custo
8. CTA final
9. Rodapé com aviso de risco (texto atual preservado)

## Arquitetura da implementação

O arquivo [src/main.tsx](../../../src/main.tsx) já tem cerca de 1.130 linhas e concentra a aplicação inteira. Este trabalho acrescenta uma landing bem maior, uma marca e uma camada de feedback, o que empurraria o arquivo para muito além do que é confortável de manter ou editar com segurança.

Por isso a implementação extrai três módulos novos, apenas nas fronteiras que este trabalho cria:

- `src/brand.tsx` — marca, wordmark e favicon. Sem dependência do resto da aplicação.
- `src/landing.tsx` — o componente `Landing` e seus dados (`LP_STEPS`, `LP_FEATURES`, `LP_FAQ`, novo conteúdo). Importa `AuthCard` de `main.tsx` e a marca de `brand.tsx`.
- `src/feedback.tsx` — toast, botão com carregamento, skeleton, barra de progresso. Consumido por `main.tsx`.

`src/main.tsx` mantém tudo o mais e passa a importar esses três. Nenhum outro corte é feito: refatorar as telas do sistema está fora do escopo.

Os estilos seguem em `src/styles.css`, em blocos comentados por área, acompanhando a convenção atual do arquivo.

O estilo denso de código de `main.tsx` (componentes em uma linha, sem espaçamento idiomático) é preservado nos módulos novos, conforme [CLAUDE.md](../../../CLAUDE.md).

## Verificação

Não há suíte de testes, lint ou typecheck configurados no projeto, então a verificação é feita pelo navegador, com o servidor rodando:

- A landing carrega sem erro de console e sem requisição de rede falhando.
- Login e cadastro pelo modal continuam funcionando, incluindo o fechamento por Escape e por clique fora.
- A página responde corretamente em 375px, 768px e 1280px, sem scroll horizontal.
- A navegação por teclado percorre todos os controles com foco visível.
- Com `prefers-reduced-motion: reduce` ativo, nenhuma animação de entrada ou transformação ocorre.
- Os estados de feedback são exercitados de verdade: um backtest real mostra o botão em carregamento, e um erro de saldo insuficiente mostra o toast com a CTA para o Perfil.
- Capturas de tela antes e depois para comparação.

## Riscos

- **Mudança de tokens vaza para o sistema.** Alterar `--muted` e `--cyan` afeta todas as telas. É intencional (a identidade deve ser coerente), mas exige uma passada visual pelas telas principais depois da mudança.
- **Peso das fontes.** Três famílias podem pesar. Mitigação: só os pesos efetivamente usados são importados, com `font-display: swap`.
- **Preços podem sair de sincronia.** Os valores da seção de preços são texto na landing, mas a verdade está em `BILLING_PRICES`. A implementação deve conferi-los contra [billing/routes.cjs](../../../billing/routes.cjs) e o texto deve deixar claro que são preços por indicador.
