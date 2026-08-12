# Seção "Como fica na prática" — avaliações ilustrativas com 3D

Seção `#prova` da landing ([src/landing.tsx](../src/landing.tsx), estilos em
[src/styles.css](../src/styles.css), bloco `v129`). Fica entre `#corretora` e `#precos`, e tem link
próprio na navegação ("Avaliações").

## Regra editorial (não remover)

Os três cartões são **personas fictícias**, não depoimentos de clientes. Isso está declarado em dois
lugares visíveis — no subtítulo da seção (`São exemplos ilustrativos, não depoimentos de clientes
reais.`) e na nota abaixo dos cartões (`Personas e valores fictícios… Resultado passado, real ou
simulado, não garante resultado futuro.`) — além do comentário no topo de `LP_AVALIACOES`.

Apresentar depoimento inventado como se fosse de cliente real é propaganda enganosa (CDC art. 37) e
some com a credibilidade do resto da página, que já rotula os painéis do hero como "números
ilustrativos". Se um dia entrarem depoimentos reais, troque os dados **e** remova os dois avisos —
não misture os dois tipos no mesmo bloco.

O avatar é composto pelas iniciais em um círculo, de propósito: não usa foto de pessoa nenhuma.

## Dados

`LP_AVALIACOES` é uma lista de tuplas:

```
[nome, iniciais, meta, texto, lucro, cenário, estrelas, curva]
```

`curva` é um array de 18 valores de 0 a 100 que vira a `<polyline>` da mini curva de capital
(`points` calculado no render, viewBox `0 0 100 44`). Cada persona cobre um trecho diferente da
promessa do produto: validação contra o Strategy Tester, relatório diário no WhatsApp e ajuste no
otimizador depois de um mês ruim na demo.

## Animações

Tudo é `transform`/`opacity` — nada anima largura, altura ou posição, então o navegador compõe na
GPU e não faz reflow.

| Efeito | Como funciona |
| --- | --- |
| Entrada em cascata 3D | `.lpProvaCena` tem `perspective:1400px`. Os cartões entram de `rotateX(-24deg) translate3d(0,42px,-140px)` com `opacity:0` e vão para o lugar quando a seção recebe `.on`, com `transition-delay:calc(var(--i)*140ms)`. |
| Gatilho | `IntersectionObserver` (`threshold:.25`) marca `ativo` uma vez. Há um `setTimeout` de 4s como rede de segurança: sem ele, um observer que não dispara deixaria a seção **invisível** (os cartões nascem com `opacity:0`). |
| Inclinação no hover | `useTilt()` escreve `--rx`/`--ry` (rotação, máx. 9°) e `--gx`/`--gy` (posição do brilho) direto no `style` do cartão a cada `mousemove`. Não há `setState` no movimento do mouse — zero re-render do React. |
| Brilho | `.lpProvaBrilho` é um `radial-gradient` posicionado em `--gx/--gy`, com `opacity` só no `:hover`/`:focus-within`. |
| Profundidade interna | Cabeçalho, estrelas, texto e bloco de lucro têm `translateZ` diferentes (24/18/12/30px) dentro de um cartão com `transform-style:preserve-3d` — é o que dá o efeito de camadas ao inclinar. |
| Virada do bloco de lucro | `.lpLucro` gira `rotateY(180deg)` no hover; frente (resultado) e verso (curva de capital) ocupam o mesmo espaço com `backface-visibility:hidden`. |
| Traço da curva | `stroke-dasharray/dashoffset` animados no hover (`@keyframes lpTraco`). |
| Avatar e estrelas | Anel pulsando (`lpAnel`, 3,4s) e estrelas entrando uma a uma (`lpEstrela`, delay por `--i`). |
| Contagem do lucro | Reaproveita o `useCountUp` já existente, que preserva a formatação pt-BR do valor. |

## Comportamentos que o código precisa manter

- **Celular (≤520px)**: não existe hover, então a perspectiva é desligada e as duas faces do bloco de
  lucro passam a conviver empilhadas (`position:static`), com o traço do SVG já desenhado
  (`stroke-dashoffset:0`). Sem isso, a curva de capital seria inalcançável no toque.
- **`prefers-reduced-motion`**: cartões já entram no lugar, nada gira nem pulsa, o traço aparece
  pronto e a inclinação do hover é anulada.
- **Teclado**: as regras de hover são espelhadas em `:focus-within`, então o efeito também acontece
  quando o foco entra no cartão.

## Verificado no navegador

3 cartões renderizados, link `#prova` na navegação, âncora parando 0px abaixo da barra sticky,
`--rx/--ry/--gx/--gy` mudando com o ponteiro (5,43° / 6,28° / 84,9% / 19,8% num teste em 1280px),
`animation-name` correto em estrelas e anel, 3 colunas em 1280px e 1 coluna em 375px, sem rolagem
horizontal em nenhuma das duas larguras. As transições em si não foram observadas visualmente: o
painel de navegador desta sessão não compõe frames (screenshots indisponíveis, `visibilityState`
travado em `hidden`), o que congela transição e `IntersectionObserver`.

---

# Ranking dos robôs (seção `#ranking`)

Entrou depois das avaliações, entre `#prova` e `#precos`, com link na navegação e no mapa do rodapé.

Mesma regra editorial das avaliações: **os quatro robôs são exemplos ilustrativos**, declarado no
subtítulo e na nota abaixo da lista. O ranking real vive dentro da plataforma (`/api/backtests`, por
conta) — a landing é pública e não tem acesso a ele.

Aqui a numeração `01/02/03` não é decoração: a lista é ordenada por **profit factor**, e o subtítulo
diz isso explicitamente ("não pelo lucro bruto, que qualquer estratégia arriscada infla"). Cada
linha traz nome do robô, par e timeframe, número de operações, lucro do período e as três métricas
que sustentam a posição (profit factor, acerto, drawdown).

## Animação

- **Revelação em cascata**: cada linha entra de `rotateY(26deg) translate3d(-24px,0,-90px)` com
  `transform-origin:left center`, atrasada em 120ms por posição — o efeito é de cartas girando para
  a frente, uma depois da outra.
- **Robô 3D**: o emoji é tratado como peça sólida — entra de `rotateY(-180deg) scale(.6)` (gira de
  costas para a frente) com `drop-shadow`, 160ms depois da linha. Só o primeiro colocado ganha uma
  flutuação contínua (`lpBotFlutua`, 4,2s, `translateY` + `rotateY`); os outros ficam parados, para
  o movimento significar posição em vez de virar ruído.
- **Lucro animado**: contagem pelo mesmo `useCountUp` das avaliações, preservando o formato pt-BR.
- Gatilho por `IntersectionObserver` com o mesmo timeout de 4s como rede de segurança, e
  `prefers-reduced-motion` desligando cascata, giro e flutuação.

## Mobile

Abaixo de 900px a linha vira três faixas: posição + robô + nome, o lucro logo abaixo, e as métricas
numa faixa própria separada por uma linha, distribuídas com `space-between`.

## Correção de layout junto

A landing estava deslocada 275px para a direita: a regra `main{margin-left:275px;width:calc(100% -
275px)}`, escrita para o layout do app (barra lateral fixa), pegava também o `<main id="conteudo">`
da página pública. As duas regras (desktop e mobile) passaram a ser `.app main`, escopo do
aplicativo. Depois da correção, hero, seções e rodapé alinham na mesma coluna de 1160px, e o app
continua com `aside` de 275px encostado no `main` de 990px.
