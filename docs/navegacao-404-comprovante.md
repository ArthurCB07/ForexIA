# Links internos, endereço inexistente e comprovante de recarga

Três coisas entraram juntas porque resolvem o mesmo problema: a pessoa chegava ao fim de uma tela
(ou a um endereço errado) sem nenhum caminho de saída.

## Links internos

**Landing.** O rodapé passou a ter um mapa em três colunas, agrupado pelo momento da decisão:
_A plataforma_ (como funciona, o que tem dentro, relatório diário, corretora vinculada),
_Antes de decidir_ (como fica na prática, preços, dúvidas) e _Sua conta_ (criar conta, entrar,
recarga por PIX). São os mesmos destinos da barra de cima — quem chega ao fim da página não precisa
subir de volta para achar para onde ir.

Cada pergunta do FAQ pode declarar um destino no terceiro item da tupla de `LP_OBJ`:

```js
['Quanto vou gastar de verdade?', 'Você paga por ação e por indicador…', ['precos','Ver a tabela de preços']]
```

A resposta curta resolve a dúvida; o link resolve o assunto. Cinco das oito perguntas têm destino.

**Dentro do app.** O componente `ProximoPasso` (em [src/main.tsx](../src/main.tsx)) rende uma lista
de destinos com rótulo e uma linha de explicação. Está no fim do Dashboard (Criar Robô · Backtest
Lab · Instalação) e no comprovante de recarga. Use-o em qualquer tela que termine sem dizer o que
vem depois — ele recebe `itens: [{rotulo, desc, onClick}]`.

## Endereço inexistente (404)

A plataforma é uma página só, então qualquer caminho fora de `CAMINHOS` (`/` e `/index.html`) cai em
`NotFound`, antes mesmo da verificação de sessão. A navegação interna usa `history.pushState` +
`popstate`, então o botão Voltar continua funcionando.

A tela usa o vocabulário do produto em vez de um "ops, não encontrado": uma série de velas com um
**buraco no meio** — que é exatamente o que o endereço pedido é — o caminho tentado em mono, e os
destinos que existem (seções da landing e, se houver sessão, Dashboard e Perfil). Fecha com a
"fita": a linha `GET /caminho · sem correspondência`, no formato em que a ponte MT5 imprime no
terminal.

**Status HTTP:** o servidor de arquivos devolve o `index.html` com **200** para caminhos
desconhecidos (fallback de SPA), então quem sinaliza a situação para buscadores é a própria página:
enquanto o `NotFound` está montado, ele injeta `<meta name="robots" content="noindex,follow">` e
troca o `<title>`. Se um dia a hospedagem permitir, devolver 404 de verdade nesses caminhos é melhor.

## Comprovante de recarga

Antes, a recarga aprovada virava um `<p>` verde no meio do Perfil. Agora `PerfilPage` guarda o saldo
anterior (que só existe antes do `loadProfile`) e manda para a página `obrigado`, que não fica no
menu — só se chega a ela por um crédito aprovado, seja pelo polling do PIX ou pela aprovação
simulada em modo teste.

É um comprovante, não uma comemoração: carimbo em mono (`crédito confirmado`), e os mesmos campos
que ficam no extrato, na mesma ordem — valor, forma de pagamento, identificador, saldo antes, saldo
agora, data e hora. Depois, um `ProximoPasso` com o que fazer com o saldo.

## A "fita"

`<Fita hora="18:12:09">texto</Fita>` é a única peça decorativa das telas novas, e é um artefato real
do produto: a linha que o Expert Advisor imprime no terminal do MetaTrader. Aparece três vezes —
topo do Dashboard (última vela recebida), 404 (o GET sem correspondência) e comprovante (o
lançamento na carteira). Se virar enfeite em toda tela, perde a função.

## O que mudou para o app parecer menos gerado por máquina

- **Emoji fora da interface**: sumiram `🤖`, `🧬` e `🧪` de overlays, títulos e botões.
- **Menos teatro de IA**: "🤖 Inteligência Artificial executando o backtest…" virou "Rodando o
  backtest…"; "Backtest Lab Inteligente" virou "Backtest Lab"; o overlay não afirma mais que "a
  inteligência artificial está processando" quando está salvando um arquivo.
- **Topo do Dashboard**: saiu o rosto de robô com olhos brilhando e o `<h1>` "ROBOTWIZARD v67" com um
  changelog interno embaixo. No lugar, o estado real da base — se a ponte está enviando, qual foi a
  última vela e há quantos segundos — e dois botões que dependem desse estado (ligar a ponte, ou
  criar um robô).
- **Log MT5 vazio** agora diz o que fazer em vez de ficar em branco.

## Verificado no navegador

404 renderizando em `/rota-que-nao-existe` com título, `robots=noindex,follow`, os dois trechos da
série separados pelo corte, os 5 destinos e a fita com o caminho tentado; mapa do rodapé com as 3
colunas e 10 links; os 5 links contextuais do FAQ apontando para as seções certas; Dashboard sem o
rosto de robô, com a fita e os dois botões condicionais; comprovante com carimbo, as 6 linhas e os 4
próximos passos; zero rolagem horizontal em 1280px e 375px; nenhum emoji restante na interface.

O fluxo real de PIX (gerar cobrança → aprovar → cair no comprovante) **não foi exercido**: exige
sessão e pagamento, e a sessão desta máquina foi perdida durante os testes. O comprovante foi
verificado renderizando a página diretamente, com os campos vazios.
