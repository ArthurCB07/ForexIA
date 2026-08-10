# Reposicionamento da landing: prova antes da execução

Data: 2026-08-09
Status: aprovado
Adendo a: [2026-08-09-landing-redesign-design.md](2026-08-09-landing-redesign-design.md)

## Por que mudar de novo

O redesenho anterior acertou a forma e errou o assunto. A tese que escrevi para o hero — "O backtest só vale se bater com o do MetaTrader 5" — coloca o MetaTrader no centro da promessa. O MT5 é infraestrutura, não é o que o cliente compra. Quem chega na página quer saber se o robô ganha dinheiro sem quebrar a conta, e a página precisa responder isso.

Três funcionalidades entram na landing e reposicionam o produto inteiro:

1. Relatórios do robô entregues direto no WhatsApp.
2. Vincular a corretora para o robô operar de forma automática.
3. Testar o robô por 30 dias no modo demo da corretora antes de liberar dinheiro real.

Juntas, elas formam uma promessa que não é sobre ferramenta: **o robô prova que funciona antes de operar com o seu dinheiro.**

## Registro de decisão sobre o estado das funcionalidades

O cliente decidiu que as três funcionalidades são apresentadas como disponíveis hoje, sem rótulo de "em breve". A decisão foi tomada depois de eu apontar que:

- a integração de WhatsApp existe no backend (Evolution API, rotas `/api/whatsapp/*`) e o Teste Real / forward testing também;
- **a execução automática por vínculo com a corretora não existe no código atual** e contraria a arquitetura documentada, em que o Expert Advisor dentro do MT5 do usuário é o único executor e a plataforma nunca fica no caminho crítico da ordem (ver [docs/mt5-v2-architecture.md](../../mt5-v2-architecture.md));
- **o teste de 30 dias em conta demo não existe como funcionalidade fechada** — há forward testing, mas não o ciclo de 30 dias com liberação condicionada.

O registro fica aqui para que a engenharia saiba que a landing passa a prometer duas capacidades ainda não implementadas. A copy foi escrita conforme a decisão.

## Tese e frase-âncora

A frase que o cliente pediu — **"O passado não garante o futuro"** — é a espinha da página. Ela é o aviso de risco que todo concorrente esconde em letra miúda, usado aqui como argumento de venda: justamente porque o passado não garante nada, o produto não pede confiança no backtest — ele exige que o robô prove no presente, em dinheiro de mentira, antes de tocar em dinheiro de verdade.

Hero:

- **H1:** O passado não garante o futuro. Por isso o robô prova antes de operar com o seu dinheiro.
- **Subtítulo:** Monte a estratégia sem escrever código, coloque o robô 30 dias na conta demo da sua corretora, acompanhe cada dia por relatório no WhatsApp e só então libere a execução automática.
- **CTA primário:** Começar os 30 dias de teste
- **CTA secundário:** Ver como funciona
- **Micro:** 1º robô e 1º backtest grátis · sem mensalidade · recarga por PIX

## Elemento-assinatura: as três camadas de prova

O painel de reconciliação com o MT5 sai do hero e desce para dentro da página, onde continua servindo como prova da primeira camada. O hero passa a ser ocupado pelo **medidor de liberação**: três camadas em sequência, com a terceira travada até a segunda passar.

| Camada | Rótulo | O que mostra | Estado |
|---|---|---|---|
| 1 | Passado | backtest sobre o histórico do próprio broker, com o painel de reconciliação MT5 como prova | concluído |
| 2 | Presente | 30 dias em conta demo, com contador de dias e resultado acumulado | em andamento |
| 3 | Futuro | execução automática na conta real | destravada pela camada 2 |

A sequência é real e a ordem carrega informação, então a numeração é justificada — não é decoração. O cadeado da camada 3 abrindo quando a camada 2 completa é o único momento de motion elaborado da página; todo o resto continua contido.

## Seções novas

### Relatório no WhatsApp

Bloco com um cartão de mensagem mostrando o relatório diário real que o robô manda: data, operações do dia, resultado, saldo e drawdown. O cartão usa a linguagem visual do próprio produto e é rotulado como exemplo — **não clona a interface do WhatsApp**, porque imitar a interface de um produto de terceiros é afirmar uma relação que não existe. A menção ao WhatsApp fica no texto.

Copy: "O robô te procura. Você não precisa abrir a plataforma para saber como foi o dia — o relatório chega no WhatsApp, com as operações, o resultado e o drawdown."

### Vitrine de corretoras

Cartão com marquee horizontal de corretoras conectáveis, pausando ao passar o mouse, com um feixe de luz percorrendo o perímetro do cartão e iluminando o título no momento em que passa por trás dele.

O cliente vai fornecer a lista exata de corretoras. Até lá, a vitrine é implementada com a lista isolada em um único array (`LP_CORRETORAS`), de modo que preencher os nomes reais seja uma edição de uma linha. **Nenhum nome de corretora é inventado** — exibir a marca de uma corretora afirma publicamente que existe integração com ela.

Implementação: o cliente forneceu como referência um componente React de logo cloud baseado em shadcn, Tailwind 4 e a biblioteca `motion`, com alias `@/components`. Este projeto não usa nenhum dos quatro — é React 18 + Vite com CSS puro em arquivo único. Adotar aquele stack reescreveria a folha de estilo inteira e descartaria o sistema de tokens construído nas tarefas 1 a 7. A referência é reproduzida em CSS puro e um componente React pequeno: marquee por `@keyframes translateX` sobre uma trilha duplicada, pausa por `animation-play-state` no hover, e o feixe por gradiente cônico girando, mascarado na borda. Nenhuma dependência nova entra.

### O que muda nas seções existentes

- Os quatro passos de "Como funciona" passam a terminar em execução automática, não em exportar o `.mq5`.
- Os cards de recursos ganham três entradas: relatório no WhatsApp, corretora vinculada e teste de 30 dias.
- As objeções ganham duas perguntas novas: o que acontece se o robô perder dinheiro nos 30 dias, e o que exatamente a plataforma acessa na corretora vinculada.
- O aviso de risco do rodapé permanece integral. A frase-âncora do hero não o substitui.

## Restrições

Valem todas as restrições do spec anterior, mais:

- Nenhuma dependência nova. Sem Tailwind, sem shadcn, sem `motion`.
- Nenhum nome ou logo de corretora sem a lista do cliente.
- Nenhuma clonagem de interface de produto de terceiros.
- Nenhum número de desempenho inventado. Os valores do medidor e do relatório de exemplo são ilustrativos e rotulados como tais.
- `prefers-reduced-motion: reduce` para o marquee e o feixe: o marquee vira grade estática, o feixe some, e todo o conteúdo continua legível.
