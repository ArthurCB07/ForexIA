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

---

# Faixas de fundo e o robô da marca

## Divisão entre as seções

As seções flutuavam todas sobre o mesmo gradiente do `body` e escorriam umas nas outras. Agora cada
`.lpSec` desenha uma **faixa de largura total** com uma linha no topo, e os tons alternam:

```css
.lp{overflow-x:clip}
.lpSec{position:relative;padding:64px 22px 68px}
.lpSec::before{position:absolute;inset:0 auto;left:50%;width:100vw;transform:translateX(-50%);border-top:1px solid var(--line)}
section.lpSec:nth-of-type(odd)::before{ /* tom de superfície */ }
section.lpSec:nth-of-type(even)::before{ /* tom do fundo da página */ }
```

Dois detalhes que precisam continuar assim:

- `overflow-x:**clip**` no `.lp`, não `hidden`: os `100vw` do `::before` sobram alguns pixels por
  causa da barra de rolagem, e `hidden` transformaria o `.lp` em container de rolagem, quebrando o
  `position:sticky` da barra de cima. `clip` apara sem esse efeito colateral.
- O `padding` da seção passou a ter topo **e** base (64/68px, 46/50px no mobile), porque agora ele é
  o respiro dentro da faixa — antes o espaçamento vinha só do topo da seção seguinte.

O contraste entre faixas é baixo de propósito: quem divide é a linha; o tom só confirma. Hero, faixa
de números e o bloco final continuam sem faixa, sobre o gradiente da página.

## `Robo3D` — o robô da marca

Substituiu o emoji `🤖`. Vive em [src/brand.tsx](../src/brand.tsx) porque é peça de marca: a cabeça
carrega o mesmo motivo do `Mark` — três barras crescentes cortadas pela linha de execução — então o
visor do robô **é** o logo.

São três camadas montadas em CSS com `preserve-3d`, e é daí que vem o volume quando ele gira:

| Camada | Papel |
| --- | --- |
| `.roboPlaca` | `translateZ(-7px) scale(.86)` — dá corpo ao girar e serve de sombra de frente |
| `.roboCorpo` | casco, antena e as duas placas laterais |
| `.roboVisor` | `translateZ(7px)` — as três barras e a linha de execução |

Otimizado: vetor puro, ~20 nós, sem imagem, sem biblioteca, escala em qualquer tamanho e herda a cor
por `--bot`. A perspectiva vem de `.lpRankItem{perspective:460px}` — sem ela o `translateZ` não
vira profundidade.

Personalização por linha do ranking: `LP_RANKING` traz `cor` e `barras` de cada robô. A cor é um dos
tons da paleta (ciano no 1º, verde, violeta, âmbar) e **a altura das três barras do visor acompanha
a posição** — o robô do primeiro lugar mostra o degrau mais alto, o do quarto o mais baixo. Só o
primeiro flutua continuamente.

## Verificado no navegador

Faixas de 1280px de largura em 1280px de viewport e de 375px em 375px, com a linha de topo em todas
e os dois tons alternando; barra de cima continua grudando (`top:0`) com o `overflow-x:clip` no
ancestral; 4 robôs renderizados com 3 camadas cada, cores e alturas de barra distintas por posição
(`6/9/13` no 1º até `4/6/8` no 4º), `translateZ` de -7px e +7px aplicados; nenhum emoji restante na
página; zero rolagem horizontal nas duas larguras.

---

# Correção: costura das faixas e animação do robô

## Por que a divisão parecia dura

A primeira versão usava `border-top:1px solid var(--line)` de ponta a ponta, e o tom da faixa
começava no valor cheio no topo e sumia em 78%. Ou seja: o rodapé transparente de uma faixa
encostava no topo opaco da seguinte, com um traço sólido no meio — dois degraus somados.

Agora:

- **Sem borda sólida.** A costura é um `::after` de 1px que se dissolve nas pontas
  (`transparent → linha → um toque de ciano no centro → linha → transparent`).
- **O tom entra e sai em degradê** (`transparent → tom em 16% → tom até 72% → transparent`), então o
  fim de uma faixa e o começo da próxima se encontram no mesmo valor. Não existe degrau.
- A entrada das linhas do ranking também ficou mais curta e mais lenta: `rotateY(12deg)` e 40px de
  profundidade em 0,72s, no lugar de `rotateY(26deg)` e 90px em 0,58s.

## Por que o robô estava bugado

Três causas, todas confirmadas no CSSOM:

1. **`filter` matava o 3D.** `.lpRankBot` tinha `filter:drop-shadow(...)` **e**
   `transform-style:preserve-3d`. Filtro é propriedade de agrupamento: força o achatamento das
   camadas filhas. As três placas viravam uma só, o `translateZ` não valia nada e a placa de trás
   aparecia como um borrão atrás da cabeça. A sombra passou para o `.roboCorpo` (uma camada só, já
   plana) e o invólucro ficou só com a perspectiva.
2. **Meia-volta brigando com o giro da linha.** O robô entrava em `rotateY(-180deg) scale(.6)` ao
   mesmo tempo que a própria linha girava 26° — dois eixos disputando. Virou um quarto de volta
   saindo do fundo (`rotateY(-46deg) translateZ(-30px)`), aplicado no `.robo3d`, que tem perspectiva
   própria e não depende mais do transform da linha.
3. **Pulo quando a flutuação assumia.** O keyframe começava em `rotateY(-10deg)`, diferente do
   transform de repouso, então o robô do 1º lugar dava um salto no instante em que a animação
   entrava (1,4s). Agora `0%` e `100%` são exatamente o repouso (`rotateY(0) translateZ(0)
   translateY(0)`), e o meio é um deslocamento pequeno (9° e 3px em 6s).

## Verificado no navegador

`filter:none` e `perspective:520px` no invólucro; `preserve-3d` sem filtro no `.robo3d`; camadas em
`translateZ` de −6px e +6px de verdade; sombra no corpo; `lpBotFlutua` só no primeiro colocado e
partindo do transform de repouso; costura de 1px com degradê nas pontas e sem borda sólida; tom das
faixas transparente nas duas extremidades; zero rolagem horizontal em 1280px e 375px.

Continua valendo o aviso das outras seções: o painel de navegador desta sessão não compõe frames,
então a suavidade em movimento não foi observada — o que foi verificado é a geometria e as regras
que a produzem.
